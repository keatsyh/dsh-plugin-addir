import { describe, expect, it } from 'vitest'
import { createAddTool, createListTool, createRemoveTool } from '../src/tools.ts'
import { WorkspaceDirectoriesServiceImpl } from '../src/service.ts'
import { resolveConfig } from '../src/config.ts'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('agent tools', () => {
  const testRoot = join(tmpdir(), `dsh-test-tools-${Date.now()}`)
  mkdirSync(testRoot, { recursive: true })

  const mainDir = join(testRoot, 'main')
  const extDir = join(testRoot, 'ext')
  mkdirSync(mainDir, { recursive: true })
  mkdirSync(extDir, { recursive: true })

  const mockExec = {
    agent: {
      session: {
        id: 'test-session',
      },
    },
    signal: new AbortController().signal,
  } as any

  it('lists directories with createListTool', async () => {
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), mainDir)
    const listTool = createListTool(service)
    expect(listTool.name).toBe('addir_list')

    const result = await listTool.execute({}, mockExec)
    expect(Array.isArray(result)).toBe(true)
    expect((result as any[]).length).toBe(1)

    const rendered = listTool.output?.render?.({}, result as any)
    const block = rendered?.[0]
    expect(block?.type).toBe('text')
    if (block?.type === 'text') {
      expect(block.text).toContain('### Associated Workspace Directories:')
      expect(block.text).toContain('(Primary Root)')
    }
  })

  it('adds and removes directories with tools', async () => {
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), mainDir)
    const addTool = createAddTool(service)
    const removeTool = createRemoveTool(service)
    expect(addTool.name).toBe('addir_add')
    expect(removeTool.name).toBe('addir_remove')

    // Add tool
    const addResult = await addTool.execute(
      {
        path: extDir,
        alias: 'extension',
        description: 'Extension modules',
        readOnly: true,
      },
      mockExec,
    )
    expect((addResult as any).alias).toBe('extension')
    expect((addResult as any).readOnly).toBe(true)

    const addRendered = addTool.output?.render?.({}, addResult as any)
    const addBlock = addRendered?.[0]
    expect(addBlock?.type).toBe('text')
    if (addBlock?.type === 'text') {
      expect(addBlock.text).toContain('Successfully linked directory: [extension]')
      expect(addBlock.text).toContain('(Read-Only)')
    }

    // Remove tool
    const removeResult = await removeTool.execute(
      {
        pathOrAlias: 'extension',
      },
      mockExec,
    )
    expect(removeResult).toBe(true)

    const removeRendered = removeTool.output?.render?.({ pathOrAlias: 'extension' }, removeResult as any)
    const removeBlock = removeRendered?.[0]
    expect(removeBlock?.type).toBe('text')
    if (removeBlock?.type === 'text') {
      expect(removeBlock.text).toContain('Successfully unlinked directory "extension".')
    }
  })
})
