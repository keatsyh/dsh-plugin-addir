/**
 * Implementation of the WorkspaceDirectoriesService.
 *
 * @module dsh-plugin-workspace-directories/service
 */

import { existsSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, isAbsolute, resolve } from 'node:path'
import type { AddDirectoryOptions, LinkedDirectory, WorkspaceDirectoriesService } from './types.ts'
import type { ResolvedConfig } from './config.ts'

import { dirname, join } from 'node:path'
import { AddirStorage, type StoredDirectoryEntry } from './storage.ts'

/**
 * Resolve path to native canonical form with symlinks dereferenced.
 * If the path does not exist, dereferences its nearest existing ancestor.
 */
export function canonicalizePath(rawPath: string): string {
  const abs = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath)
  try {
    return realpathSync.native(abs)
  } catch {
    let current = abs
    const trailingParts: string[] = []
    while (true) {
      const parent = dirname(current)
      if (parent === current) {
        return abs
      }
      trailingParts.unshift(basename(current))
      current = parent
      try {
        const canonicalParent = realpathSync.native(current)
        return join(canonicalParent, ...trailingParts)
      } catch {
        // Continue going up
      }
    }
  }
}

/**
 * Check whether a target path is located inside a root directory.
 */
export function isSubPath(target: string, root: string): boolean {
  const cTarget = canonicalizePath(target)
  const cRoot = canonicalizePath(root)
  if (cTarget === cRoot) return true
  const sep = cRoot.endsWith('/') ? '' : '/'
  return cTarget.startsWith(`${cRoot}${sep}`)
}

/** Harness home environment variable, resolved the way the launcher resolves it. */
const DSH_HOME_ENV = 'DSH_HOME'

/** Expand a leading `~` against the operating-system home. */
function expandHome(value: string): string {
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return join(homedir(), value.slice(2))
  return value
}

/**
 * Whether a path is the Harness profile tree or lies inside it. A Desktop Host runs
 * with its working directory set to its own profile directory, so an inferred
 * primary would otherwise advertise application state as a workspace root.
 * @param target - path to test.
 * @returns true when the path lies inside `<Harness home>/profiles`.
 */
export function isHarnessProfilePath(target: string): boolean {
  const configured = process.env[DSH_HOME_ENV]?.trim()
  const home = configured === undefined || configured === '' ? join(homedir(), '.dsh') : expandHome(configured)
  return isSubPath(target, join(home, 'profiles'))
}

export class WorkspaceDirectoriesServiceImpl implements WorkspaceDirectoriesService {
  /**
   * Global directory map: canonicalPath -> LinkedDirectory
   */
  private readonly globalEntries = new Map<string, LinkedDirectory>()

  /**
   * Session-scoped directory entries: sessionId -> (canonicalPath -> LinkedDirectory)
   */
  private readonly sessionEntries = new Map<string, Map<string, LinkedDirectory>>()

  /**
   * Session primary cwd: sessionId -> canonicalPath
   */
  private readonly sessionPrimaries = new Map<string, string>()

  /**
   * Global primary cwd fallback
   */
  private defaultPrimaryPath: string

  /**
   * Persistent storage engine
   */
  readonly storage: AddirStorage

  constructor(
    private readonly config: ResolvedConfig,
    defaultCwd: string = process.cwd(),
    storage?: AddirStorage,
  ) {
    this.storage = storage ?? new AddirStorage()
    this.defaultPrimaryPath = canonicalizePath(defaultCwd)
    // A Desktop Host's working directory is its profile directory; registering that
    // would advertise application state as a workspace root in every prompt.
    if (!isHarnessProfilePath(this.defaultPrimaryPath)) {
      this.registerPrimary(this.defaultPrimaryPath)
      this.loadFromStorageForWorkspace(this.defaultPrimaryPath, this.globalEntries)
    }
    this.loadConfigDefaults()
  }

  private loadFromStorageForWorkspace(workspaceRoot: string, targetMap: Map<string, LinkedDirectory>): void {
    for (const [path, entry] of targetMap) {
      if (entry.source === 'dynamic') targetMap.delete(path)
    }
    try {
      const stored = this.storage.getDirectories(workspaceRoot)
      for (const item of stored) {
        const canonical = canonicalizePath(item.path)
        if (!existsSync(canonical) || !statSync(canonical).isDirectory()) {
          continue
        }
        const entry: LinkedDirectory = {
          path: canonical,
          alias: this.ensureUniqueAlias(item.alias, targetMap),
          ...(item.description ? { description: item.description } : {}),
          readOnly: item.readOnly,
          addedAt: item.addedAt || Date.now(),
          source: 'dynamic',
        }
        targetMap.set(canonical, entry)
      }
    } catch {
      // Ignore storage loading errors gracefully
    }
  }

  private loadConfigDefaults(): void {
    for (const dir of this.config.defaultDirectories) {
      try {
        const canonical = canonicalizePath(dir.path)
        if (!existsSync(canonical) || !statSync(canonical).isDirectory()) {
          continue
        }
        const alias = dir.alias || basename(canonical)
        const entry: LinkedDirectory = {
          path: canonical,
          alias: this.ensureUniqueAlias(alias, this.globalEntries),
          ...(dir.description ? { description: dir.description } : {}),
          readOnly: dir.readOnly ?? false,
          addedAt: Date.now(),
          source: 'config',
        }
        this.globalEntries.set(canonical, entry)
      } catch {
        // Skip invalid static configurations gracefully
      }
    }
  }

  private registerPrimary(cwd: string): LinkedDirectory {
    const canonical = canonicalizePath(cwd)
    const entry: LinkedDirectory = {
      path: canonical,
      alias: 'primary',
      description: 'Primary workspace root (cwd)',
      readOnly: false,
      addedAt: Date.now(),
      source: 'primary',
    }
    this.globalEntries.set(canonical, entry)
    return entry
  }

  private ensureUniqueAlias(desiredAlias: string, entries: Map<string, LinkedDirectory>): string {
    const existingAliases = new Set(Array.from(entries.values()).map(e => e.alias))
    if (!existingAliases.has(desiredAlias)) return desiredAlias

    let counter = 1
    while (existingAliases.has(`${desiredAlias}-${counter}`)) {
      counter++
    }
    return `${desiredAlias}-${counter}`
  }

  private getSessionMap(sessionId?: string): Map<string, LinkedDirectory> {
    if (!sessionId) return this.globalEntries
    let map = this.sessionEntries.get(sessionId)
    if (!map) {
      map = new Map(this.globalEntries)
      this.sessionEntries.set(sessionId, map)
    }
    return map
  }

  private getPrimaryPath(sessionId?: string): string {
    if (sessionId) {
      return this.sessionPrimaries.get(sessionId) ?? this.defaultPrimaryPath
    }
    return this.defaultPrimaryPath
  }

  setPrimary(cwd: string, sessionId?: string): LinkedDirectory {
    const canonical = canonicalizePath(cwd)
    const entry: LinkedDirectory = {
      path: canonical,
      alias: 'primary',
      description: 'Primary workspace root (cwd)',
      readOnly: false,
      addedAt: Date.now(),
      source: 'primary',
    }
    if (sessionId) {
      this.sessionPrimaries.set(sessionId, canonical)
      const map = this.getSessionMap(sessionId)
      map.set(canonical, entry)
      this.loadFromStorageForWorkspace(canonical, map)
    } else {
      this.defaultPrimaryPath = canonical
      this.globalEntries.set(canonical, entry)
      this.loadFromStorageForWorkspace(canonical, this.globalEntries)
    }
    return entry
  }

  getDirectoriesForWorkspace(workspacePath: string): readonly LinkedDirectory[] {
    const canonicalWorkspace = canonicalizePath(workspacePath)
    const stored = this.storage.getDirectories(canonicalWorkspace)
    return stored.map(s => ({
      path: s.path,
      alias: s.alias,
      description: s.description,
      readOnly: s.readOnly,
      addedAt: s.addedAt,
      source: 'dynamic' as const,
    }))
  }

  replaceWorkspaceDirectories(workspacePath: string, directories: readonly AddDirectoryOptions[]): readonly LinkedDirectory[] {
    const workspace = canonicalizePath(workspacePath)
    const previous = this.storage.getDirectories(workspace)
    const paths = new Set<string>([workspace])
    const aliases = new Set<string>(['primary'])
    const entries = directories.map((directory): StoredDirectoryEntry => {
      const path = canonicalizePath(isAbsolute(directory.path) ? directory.path : resolve(workspace, directory.path))
      if (!directory.path.trim() || !existsSync(path) || !statSync(path).isDirectory()) {
        throw new Error(`Directory does not exist: "${directory.path}"`)
      }
      if (paths.has(path)) throw new Error(`Duplicate or primary directory: "${path}"`)
      const explicitAlias = directory.alias?.trim()
      let alias = explicitAlias || basename(path)
      if (explicitAlias && aliases.has(alias)) throw new Error(`Duplicate directory alias: "${alias}"`)
      const baseAlias = alias
      let suffix = 1
      while (aliases.has(alias)) alias = `${baseAlias}-${suffix++}`
      paths.add(path)
      aliases.add(alias)
      return {
        path, alias, readOnly: directory.readOnly ?? false,
        ...(directory.description?.trim() ? { description: directory.description.trim() } : {}),
        addedAt: previous.find(entry => entry.path === path)?.addedAt ?? Date.now(),
      }
    })
    const data = this.storage.load()
    data.workspaces[workspace] = entries
    this.storage.save(data)
    if (workspace === this.defaultPrimaryPath) this.loadFromStorageForWorkspace(workspace, this.globalEntries)
    for (const [sessionId, primary] of this.sessionPrimaries) {
      const map = this.sessionEntries.get(sessionId)
      if (primary === workspace && map) this.loadFromStorageForWorkspace(workspace, map)
    }
    return this.getDirectoriesForWorkspace(workspace)
  }

  async addDirectoryToWorkspace(workspacePath: string, options: AddDirectoryOptions): Promise<LinkedDirectory> {
    const canonicalWorkspace = canonicalizePath(workspacePath)
    const rawPath = options.path.trim()
    if (!rawPath) {
      throw new Error('Directory path cannot be empty')
    }

    const absPath = isAbsolute(rawPath) ? rawPath : resolve(canonicalWorkspace, rawPath)
    if (!existsSync(absPath)) {
      throw new Error(`Directory does not exist: "${rawPath}"`)
    }

    const stat = statSync(absPath)
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: "${rawPath}"`)
    }

    const canonical = canonicalizePath(absPath)
    if (canonical === canonicalWorkspace) {
      throw new Error('Cannot add primary workspace itself as an associated directory')
    }

    const currentStored = this.storage.getDirectories(canonicalWorkspace)
    const existing = currentStored.find(d => canonicalizePath(d.path) === canonical)
    if (existing) {
      return {
        path: existing.path,
        alias: existing.alias,
        description: existing.description,
        readOnly: existing.readOnly,
        addedAt: existing.addedAt,
        source: 'dynamic',
      }
    }

    const baseName = basename(canonical) || 'dir'
    const existingAliases = new Set(currentStored.map(d => d.alias))
    let uniqueAlias = (options.alias?.trim() || baseName).replace(/[^a-zA-Z0-9_-]/g, '-')
    let counter = 1
    const baseAlias = uniqueAlias
    while (existingAliases.has(uniqueAlias)) {
      uniqueAlias = `${baseAlias}-${counter}`
      counter++
    }

    const storedEntry: StoredDirectoryEntry = {
      path: canonical,
      alias: uniqueAlias,
      ...(options.description ? { description: options.description.trim() } : {}),
      readOnly: options.readOnly ?? false,
      addedAt: Date.now(),
    }

    this.storage.addDirectory(canonicalWorkspace, storedEntry)

    // If this workspace is current primary, sync to runtime map
    if (this.defaultPrimaryPath === canonicalWorkspace) {
      this.globalEntries.set(canonical, { ...storedEntry, source: 'dynamic' })
    }
    for (const [sid, primary] of this.sessionPrimaries.entries()) {
      if (primary === canonicalWorkspace) {
        const map = this.sessionEntries.get(sid)
        map?.set(canonical, { ...storedEntry, source: 'dynamic' })
      }
    }

    return {
      ...storedEntry,
      source: 'dynamic',
    }
  }

  async removeDirectoryFromWorkspace(workspacePath: string, pathOrAlias: string): Promise<boolean> {
    const canonicalWorkspace = canonicalizePath(workspacePath)
    const target = pathOrAlias.trim()
    if (!target) return false

    const ok = this.storage.removeDirectory(canonicalWorkspace, target)
    if (ok) {
      // Clean runtime maps if matched
      const clean = (map: Map<string, LinkedDirectory>) => {
        for (const [p, e] of map.entries()) {
          if (e.alias === target || e.path === target || canonicalizePath(e.path) === canonicalizePath(target)) {
            if (e.source !== 'primary') {
              map.delete(p)
            }
          }
        }
      }
      if (this.defaultPrimaryPath === canonicalWorkspace) {
        clean(this.globalEntries)
      }
      for (const [sid, primary] of this.sessionPrimaries.entries()) {
        if (primary === canonicalWorkspace) {
          const map = this.sessionEntries.get(sid)
          if (map) clean(map)
        }
      }
    }
    return ok
  }

  list(sessionId?: string): readonly LinkedDirectory[] {
    const map = this.getSessionMap(sessionId)
    return Array.from(map.values())
  }

  get(pathOrAlias: string, sessionId?: string): LinkedDirectory | undefined {
    const map = this.getSessionMap(sessionId)
    const canonical = canonicalizePath(pathOrAlias)
    const direct = map.get(canonical)
    if (direct) return direct

    for (const entry of map.values()) {
      if (entry.alias === pathOrAlias || entry.path === pathOrAlias) {
        return entry
      }
    }
    return undefined
  }

  async add(options: AddDirectoryOptions, sessionId?: string): Promise<LinkedDirectory> {
    const rawPath = options.path.trim()
    if (!rawPath) {
      throw new Error('Directory path cannot be empty')
    }

    const primary = this.getPrimaryPath(sessionId)
    const absPath = isAbsolute(rawPath) ? rawPath : resolve(primary, rawPath)
    if (!existsSync(absPath)) {
      throw new Error(`Directory does not exist: "${rawPath}"`)
    }

    const stat = statSync(absPath)
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: "${rawPath}"`)
    }

    const canonical = canonicalizePath(absPath)
    const map = this.getSessionMap(sessionId)

    const existing = map.get(canonical)
    if (existing) {
      return existing
    }

    const baseName = basename(canonical) || 'workspace-dir'
    const desiredAlias = (options.alias?.trim() || baseName).replace(/[^a-zA-Z0-9_-]/g, '-')
    const uniqueAlias = this.ensureUniqueAlias(desiredAlias, map)

    const entry: LinkedDirectory = {
      path: canonical,
      alias: uniqueAlias,
      ...(options.description ? { description: options.description.trim() } : {}),
      readOnly: options.readOnly ?? false,
      addedAt: Date.now(),
      source: sessionId ? 'dynamic' : 'config',
    }

    map.set(canonical, entry)

    // Durably store for primary workspace only when not session-scoped
    if (!sessionId) {
      this.storage.addDirectory(primary, {
        path: entry.path,
        alias: entry.alias,
        ...(entry.description ? { description: entry.description } : {}),
        readOnly: entry.readOnly,
        addedAt: entry.addedAt,
      })
    }

    return entry
  }

  async remove(pathOrAlias: string, sessionId?: string): Promise<boolean> {
    const target = pathOrAlias.trim()
    if (!target) return false

    const map = this.getSessionMap(sessionId)
    const entry = this.get(target, sessionId)
    if (!entry) return false

    // Primary directory cannot be removed
    if (entry.source === 'primary' || entry.alias === 'primary') {
      throw new Error(`Cannot remove primary workspace root: "${entry.path}"`)
    }

    if (!sessionId) {
      const primary = this.getPrimaryPath(sessionId)
      this.storage.removeDirectory(primary, entry.path)
    }

    return map.delete(entry.path)
  }

  resolvePath(target: string, sessionId?: string): string {
    const trimmed = target.trim()
    if (!trimmed) return trimmed

    // Support alias prefixes: [docs]/guide.md or docs:guide.md
    const bracketMatch = /^\[([^\]]+)\][/\\]?(.*)$/.exec(trimmed)
    if (bracketMatch) {
      const alias = bracketMatch[1]!
      const relativePart = bracketMatch[2] ?? ''
      const entry = this.get(alias, sessionId)
      if (entry) {
        return canonicalizePath(resolve(entry.path, relativePart))
      }
    }

    const colonMatch = /^([a-zA-Z0-9_-]+):(.*)$/.exec(trimmed)
    if (colonMatch) {
      const alias = colonMatch[1]!
      const relativePart = colonMatch[2] ?? ''
      const entry = this.get(alias, sessionId)
      if (entry) {
        return canonicalizePath(resolve(entry.path, relativePart))
      }
    }

    return canonicalizePath(trimmed)
  }

  isUnderWorkspace(targetPath: string, sessionId?: string): boolean {
    const list = this.list(sessionId)
    for (const dir of list) {
      if (isSubPath(targetPath, dir.path)) {
        return true
      }
    }
    return false
  }

  isReadOnly(targetPath: string, sessionId?: string): boolean {
    const list = this.list(sessionId)
    for (const dir of list) {
      if (dir.readOnly && isSubPath(targetPath, dir.path)) {
        return true
      }
    }
    return false
  }
}
