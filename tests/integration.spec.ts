import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { WorkspaceDirectoriesProvider } from '../src/index.ts'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { canonicalizePath } from '../src/service.ts'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ToolDispatchExecution, ToolExecutionToken } from '@deepseek-ai/dsh-tools'

describe('WorkspaceDirectoriesProvider (dsh-plugin-addir) integration', () => {
  const testRoot = canonicalizePath(join(tmpdir(), `dsh-test-integ-${Date.now()}`))
  mkdirSync(testRoot, { recursive: true })

  const mainDir = canonicalizePath(join(testRoot, 'main'))
  const subDir = canonicalizePath(join(testRoot, 'sub'))
  mkdirSync(mainDir, { recursive: true })
  mkdirSync(subDir, { recursive: true })

  it('mounts with zero configuration and provides default values', async () => {
    const ctx = new Context()
    // No config passed: all defaults should be enabled
    await ctx.plugin(WorkspaceDirectoriesProvider)

    const addirService = ctx.addir
    expect(Boolean(addirService)).toBe(true)

    const list = addirService.list()
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0]?.alias).toBe('primary')
  })

  it('mounts with custom config and injects service', async () => {
    const ctx = new Context()
    await ctx.plugin(WorkspaceDirectoriesProvider, {
      defaultDirectories: [
        { path: subDir, alias: 'sub', description: 'Sub module' },
      ],
      enableTools: false,
      enableContextInjection: true,
    })

    const addirService = ctx.addir
    expect(Boolean(addirService)).toBe(true)
    const list = addirService.list()
    expect(list.length).toBeGreaterThanOrEqual(2)

    const sub = addirService.get('sub')
    expect(sub).toBeDefined()
    expect(sub?.path).toBe(subDir)
  })

  it('triggers agent/pre-step and enriches messages', async () => {
    const ctx = new Context()
    await ctx.plugin(WorkspaceDirectoriesProvider, {
      defaultDirectories: [
        { path: subDir, alias: 'sub-service' },
      ],
      enableTools: false,
      enableContextInjection: true,
    })

    const mockAgent = {
      session: {
        id: 'test-agent-session',
        header: {
          cwd: mainDir,
        },
      },
    }

    // Simulate pre-step waterfall dispatch
    const originalMessages = [
      { id: 'msg-1', content: [{ type: 'text', text: 'Hello' }], source: { kind: 'user' } },
    ]

    const result = await ctx.waterfall('agent/pre-step', {
      agent: mockAgent as any,
      messages: originalMessages as any,
      turn: 1,
      step: 1,
      signal: new AbortController().signal,
    }, async () => ({
      kind: 'enter',
      messages: originalMessages as any,
    }))

    expect(result.kind).toBe('enter')
    if (result.kind === 'enter') {
      // Should have injected the workspace-directories message
      expect(result.messages.length).toBe(2)
      const contextMsg = result.messages[0]!
      expect(contextMsg.source.kind).toBe('workspace-directories')
      expect((contextMsg.content[0] as any).text).toContain('# Active Workspace Directories')
      expect((contextMsg.content[0] as any).text).toContain('[sub-service]')
    }
  })

  it('delegates permitted tool calls and disposes tool registrations', async () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    const disposeTool = vi.fn()
    const register = vi.fn(() => disposeTool)
    ctx.provide('tools', { register })
    const plugin = ctx.plugin(WorkspaceDirectoriesProvider, {
      defaultDirectories: [{ path: subDir, alias: 'readonly', readOnly: true }],
      enableContextInjection: false,
    })
    await plugin.await()
    expect(register).toHaveBeenCalledTimes(3)
    const execution: ToolDispatchExecution = {
      callId: 'test-call' as ToolCallId, rootCallId: 'test-call' as ToolCallId,
      token: Symbol('execution') as ToolExecutionToken,
      name: 'read', arguments: { path: join(subDir, 'file.txt') }, signal: new AbortController().signal,
    }
    const result = { isError: false as const, value: 'read result', content: [] }
    const next = vi.fn(async () => result)
    expect(await ctx.waterfall('tools/execute', execution, next)).toEqual(result)
    expect(next).toHaveBeenCalledOnce()
    next.mockClear()
    await expect(ctx.waterfall('tools/execute', { ...execution, name: 'write' }, next)).rejects.toThrow('read-only')
    expect(next).not.toHaveBeenCalled()
    await plugin.dispose()
    expect(disposeTool).toHaveBeenCalledTimes(3)
  })
})
