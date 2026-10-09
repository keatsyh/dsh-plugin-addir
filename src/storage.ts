/**
 * Persistent storage for workspace-to-directories mappings.
 * Saves directory associations durably under $DSH_HOME/storages/addir.json.
 *
 * @module dsh-plugin-addir/storage
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { canonicalizePath } from './service.ts'

export interface StoredDirectoryEntry {
  path: string
  alias: string
  description?: string
  readOnly: boolean
  addedAt: number
}

export interface StoredWorkspaceMap {
  /**
   * Mapping: canonicalWorkspaceRoot -> array of associated directories
   */
  workspaces: Record<string, StoredDirectoryEntry[]>
}

export function getDefaultStoragePath(): string {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(dshHome, 'storages', 'addir.json')
}

export class AddirStorage {
  private memoryData: StoredWorkspaceMap | null = null

  constructor(private readonly storageFilePath: string = getDefaultStoragePath()) {
    if (storageFilePath === ':memory:') {
      this.memoryData = { workspaces: {} }
    }
  }

  load(): StoredWorkspaceMap {
    if (this.memoryData) {
      return JSON.parse(JSON.stringify(this.memoryData))
    }
    try {
      if (!existsSync(this.storageFilePath)) {
        return { workspaces: {} }
      }
      const raw = readFileSync(this.storageFilePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.workspaces === 'object') {
        return parsed as StoredWorkspaceMap
      }
      return { workspaces: {} }
    } catch {
      return { workspaces: {} }
    }
  }

  save(data: StoredWorkspaceMap): void {
    if (this.memoryData) {
      this.memoryData = JSON.parse(JSON.stringify(data))
      return
    }
    const dir = dirname(this.storageFilePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(this.storageFilePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
  }

  getDirectories(workspacePath: string): StoredDirectoryEntry[] {
    const canonical = canonicalizePath(workspacePath)
    const data = this.load()
    return data.workspaces[canonical] ?? []
  }

  addDirectory(workspacePath: string, entry: StoredDirectoryEntry): void {
    const canonicalWorkspace = canonicalizePath(workspacePath)
    const canonicalEntryPath = canonicalizePath(entry.path)
    const data = this.load()

    const list = data.workspaces[canonicalWorkspace] ?? []
    const filtered = list.filter(item => canonicalizePath(item.path) !== canonicalEntryPath && item.alias !== entry.alias)

    filtered.push({
      ...entry,
      path: canonicalEntryPath,
    })

    data.workspaces[canonicalWorkspace] = filtered
    this.save(data)
  }

  removeDirectory(workspacePath: string, pathOrAlias: string): boolean {
    const canonicalWorkspace = canonicalizePath(workspacePath)
    const data = this.load()
    const list = data.workspaces[canonicalWorkspace]
    if (!list) return false

    const initialLen = list.length
    const canonicalTarget = canonicalizePath(pathOrAlias)
    const filtered = list.filter(
      item => item.alias !== pathOrAlias && canonicalizePath(item.path) !== canonicalTarget,
    )

    if (filtered.length !== initialLen) {
      data.workspaces[canonicalWorkspace] = filtered
      this.save(data)
      return true
    }

    return false
  }
}
