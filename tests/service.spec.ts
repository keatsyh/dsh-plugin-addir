import { describe, expect, it, onTestFinished } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { canonicalizePath, WorkspaceDirectoriesServiceImpl } from '../src/service.ts'
import { AddirStorage } from '../src/storage.ts'
import { resolveConfig } from '../src/config.ts'

describe('WorkspaceDirectoriesService', () => {
  const testRoot = canonicalizePath(join(tmpdir(), `dsh-test-wd-${Date.now()}`))
  mkdirSync(testRoot, { recursive: true })

  const dirA = canonicalizePath(join(testRoot, 'project-a'))
  const dirB = canonicalizePath(join(testRoot, 'project-b'))
  const dirReadOnly = canonicalizePath(join(testRoot, 'shared-docs'))
  mkdirSync(dirA, { recursive: true })
  mkdirSync(dirB, { recursive: true })
  mkdirSync(dirReadOnly, { recursive: true })

  it('initializes with primary directory and static config', () => {
    const config = resolveConfig({
      defaultDirectories: [
        { path: dirA, alias: 'proj-a', description: 'Project A' },
      ],
    })
    const service = new WorkspaceDirectoriesServiceImpl(config, dirB)

    const list = service.list()
    expect(list).toHaveLength(2)
    const primary = service.get('primary')
    expect(primary).toBeDefined()
    expect(primary?.path).toBe(dirB)
    expect(primary?.source).toBe('primary')

    const linkedA = service.get('proj-a')
    expect(linkedA).toBeDefined()
    expect(linkedA?.path).toBe(dirA)
    expect(linkedA?.description).toBe('Project A')
  })

  it('does not register a Harness profile directory as a workspace root', () => {
    const home = join(testRoot, 'harness-home')
    const profileDir = join(home, 'profiles', 'desktop')
    mkdirSync(profileDir, { recursive: true })
    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = home
    onTestFinished(() => {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
    })

    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), profileDir)
    expect(service.list()).toHaveLength(0)
    expect(service.get('primary')).toBeUndefined()
  })

  it('adds and removes directories dynamically', async () => {
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA)

    const added = await service.add({
      path: dirReadOnly,
      alias: 'docs',
      description: 'Documentation',
      readOnly: true,
    })

    expect(added.alias).toBe('docs')
    expect(added.readOnly).toBe(true)
    expect(service.list()).toHaveLength(2)

    // Cannot remove primary
    await expect(service.remove('primary')).rejects.toThrow('Cannot remove primary workspace root')

    // Can remove added directory
    const removed = await service.remove('docs')
    expect(removed).toBe(true)
    expect(service.list()).toHaveLength(1)
  })

  it('rejects nonexistent directories or file paths', async () => {
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA)

    await expect(service.add({ path: join(testRoot, 'nonexistent') })).rejects.toThrow('Directory does not exist')

    const filePath = join(testRoot, 'test.txt')
    writeFileSync(filePath, 'hello')
    await expect(service.add({ path: filePath })).rejects.toThrow('Path is not a directory')
  })

  it('resolves bracket and colon alias paths', async () => {
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA)
    await service.add({ path: dirB, alias: 'backend' })

    const resolvedBracket = service.resolvePath('[backend]/src/index.ts')
    expect(resolvedBracket).toBe(join(dirB, 'src/index.ts'))

    const resolvedColon = service.resolvePath('backend:src/index.ts')
    expect(resolvedColon).toBe(join(dirB, 'src/index.ts'))
  })

  it('checks workspace containment and read-only status', async () => {
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA)
    await service.add({ path: dirReadOnly, alias: 'docs', readOnly: true })

    const fileUnderA = join(dirA, 'src/file.ts')
    const fileUnderDocs = join(dirReadOnly, 'api.md')
    const externalFile = '/etc/hosts'

    expect(service.isUnderWorkspace(fileUnderA)).toBe(true)
    expect(service.isUnderWorkspace(fileUnderDocs)).toBe(true)
    expect(service.isUnderWorkspace(externalFile)).toBe(false)

    expect(service.isReadOnly(fileUnderA)).toBe(false)
    expect(service.isReadOnly(fileUnderDocs)).toBe(true)
  })

  it('supports session isolation', async () => {
    const memStorage = new AddirStorage(':memory:')
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA, memStorage)
    const sessionId = 'session-123'

    await service.add({ path: dirB, alias: 'session-b' }, sessionId)

    // Global list does not have session-b
    expect(service.get('session-b')).toBeUndefined()

    // Session list has session-b
    expect(service.get('session-b', sessionId)).toBeDefined()
  })

  it('durably persists directory links per workspace', async () => {
    const memStorage = new AddirStorage(':memory:')
    const service1 = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA, memStorage)

    await service1.addDirectoryToWorkspace(dirA, {
      path: dirB,
      alias: 'custom-b',
      readOnly: true,
      description: 'Persistent B',
    })

    const dirs = service1.getDirectoriesForWorkspace(dirA)
    expect(dirs).toHaveLength(1)
    expect(dirs[0]?.alias).toBe('custom-b')
    expect(dirs[0]?.readOnly).toBe(true)

    // New instance restoring from same storage
    const service2 = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA, memStorage)
    const restored = service2.get('custom-b')
    expect(restored).toBeDefined()
    expect(restored?.path).toBe(dirB)
    expect(restored?.readOnly).toBe(true)

    // Remove from workspace
    await service2.removeDirectoryFromWorkspace(dirA, 'custom-b')
    expect(service2.getDirectoriesForWorkspace(dirA)).toHaveLength(0)
    expect(service2.get('custom-b')).toBeUndefined()
  })

  it('saves a complete editor draft and refreshes only sessions in that workspace', async () => {
    const root = mkdtempSync(join(tmpdir(), 'addir-save-'))
    onTestFinished(() => rmSync(root, { recursive: true, force: true }))
    const storage = new AddirStorage(join(root, 'addir.json'))
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA, storage)
    await service.addDirectoryToWorkspace(dirA, { path: dirB, alias: 'old' })
    service.setPrimary(dirA, 'current')
    service.setPrimary(dirB, 'other')

    const draft = [{ path: dirReadOnly, alias: 'docs', readOnly: true }]
    service.replaceWorkspaceDirectories(dirA, draft)
    expect(service.get('old')).toBeUndefined()
    expect(service.get('old', 'current')).toBeUndefined()
    expect(service.get('docs', 'current')?.readOnly).toBe(true)
    expect(service.get('docs', 'other')).toBeUndefined()
    const restored = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA, new AddirStorage(join(root, 'addir.json')))
    expect(restored.get('docs')?.path).toBe(dirReadOnly)
    const addedAt = restored.get('docs')?.addedAt
    service.replaceWorkspaceDirectories(dirA, [{ ...draft[0]!, alias: 'renamed', readOnly: false }])
    expect(service.get('renamed')?.addedAt).toBe(addedAt)
  })

  it('leaves saved associations unchanged when any draft directory is invalid', () => {
    const storage = new AddirStorage(':memory:')
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), dirA, storage)
    service.replaceWorkspaceDirectories(dirA, [{ path: dirB, alias: 'saved' }])
    const before = storage.load()
    for (const draft of [
      [{ path: dirReadOnly }, { path: join(testRoot, 'missing') }],
      [{ path: dirA }],
      [{ path: dirB }, { path: dirB }],
      [{ path: dirB, alias: 'same' }, { path: dirReadOnly, alias: 'same' }],
    ]) {
      expect(() => service.replaceWorkspaceDirectories(dirA, draft)).toThrow()
      expect(storage.load()).toEqual(before)
      expect(service.get('saved')?.path).toBe(dirB)
    }
  })
})
