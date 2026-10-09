import { describe, expect, it } from 'vitest'
import { checkWritePermission, getWritableWorkspaceRoots } from '../src/guard.ts'
import { canonicalizePath, WorkspaceDirectoriesServiceImpl } from '../src/service.ts'
import { resolveConfig } from '../src/config.ts'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('guard and sandbox integration', () => {
  const testRoot = canonicalizePath(join(tmpdir(), `dsh-test-guard-${Date.now()}`))
  mkdirSync(testRoot, { recursive: true })

  const mainDir = canonicalizePath(join(testRoot, 'main'))
  const extWritableDir = canonicalizePath(join(testRoot, 'ext-writable'))
  const extReadOnlyDir = canonicalizePath(join(testRoot, 'ext-readonly'))
  mkdirSync(mainDir, { recursive: true })
  mkdirSync(extWritableDir, { recursive: true })
  mkdirSync(extReadOnlyDir, { recursive: true })

  it('allows write in writable directories and blocks in read-only directories', async () => {
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), mainDir)
    await service.add({ path: extWritableDir, alias: 'ext-w', readOnly: false })
    await service.add({ path: extReadOnlyDir, alias: 'ext-ro', readOnly: true })

    const okCheck = checkWritePermission(service, join(extWritableDir, 'file.txt'))
    expect(okCheck.allowed).toBe(true)
    expect(okCheck.readOnly).toBe(false)

    const deniedCheck = checkWritePermission(service, join(extReadOnlyDir, 'file.txt'))
    expect(deniedCheck.allowed).toBe(false)
    expect(deniedCheck.readOnly).toBe(true)
    expect(deniedCheck.reason).toContain('read-only workspace directory')
  })

  it('aggregates writable workspace roots for sandbox policy', async () => {
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), mainDir)
    await service.add({ path: extWritableDir, alias: 'ext-w', readOnly: false })
    await service.add({ path: extReadOnlyDir, alias: 'ext-ro', readOnly: true })

    const roots = getWritableWorkspaceRoots(service, mainDir)
    expect(roots).toContain(mainDir)
    expect(roots).toContain(extWritableDir)
    expect(roots).not.toContain(extReadOnlyDir)
  })
})
