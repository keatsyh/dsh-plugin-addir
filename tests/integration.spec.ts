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

  it('registers one stable runtime-context table for the session directories', async () => {
    const ctx = new Context()
    const registrations: Array<{
      name: string
      order: number
      required?: boolean
      interpolate?: boolean
      text: (context: { agent?: unknown }) => string
    }> = []
    ctx.provide('systemPrompt', {
      context: (entry: typeof registrations[number]) => {
        registrations.push(entry)
        return () => {}
      },
    })
    await ctx.plugin(WorkspaceDirectoriesProvider, {
      defaultDirectories: [
        { path: subDir, alias: 'sub-service' },
      ],
      enableTools: false,
      enableContextInjection: true,
    })

    // One contribution, not one message per step: the loop re-sends the
    // snapshot only when this text changes.
    expect(registrations).toHaveLength(1)
    const registration = registrations[0]!
    expect(registration.name).toBe('working-directories:linked')
    expect(registration.required).toBe(true)
    expect(registration.interpolate).toBe(false)

    const agent = { session: { id: 'test-agent-session', header: { cwd: mainDir } } }
    const table = registration.text({ agent })
    expect(table).toContain('# Active Workspace Directories')
    expect(table).toContain('[sub-service]')
    expect(registration.text({ agent })).toBe(table)
    expect(registration.text({})).toBe('')
  })

  it('leaves pre-step messages untouched and only re-syncs the session primary', async () => {
    const ctx = new Context()
    ctx.provide('systemPrompt', { context: () => () => {} })
    await ctx.plugin(WorkspaceDirectoriesProvider, {
      defaultDirectories: [{ path: subDir, alias: 'sub-service' }],
      enableContextInjection: false,
    })

    const claimed = [{ id: 'msg-1', content: [{ type: 'text', text: 'Hello' }], source: { kind: 'user' } }]
    const agent = { session: { id: 'pre-step-session', header: { cwd: mainDir } } }
    const result = await ctx.waterfall('agent/pre-step', {
      agent: agent as never,
      messages: claimed as never,
      turn: 1,
      step: 1,
      signal: new AbortController().signal,
    }, async () => ({ kind: 'enter', messages: claimed as never }))

    expect(result.kind).toBe('enter')
    if (result.kind === 'enter') expect(result.messages).toEqual(claimed)
    expect(ctx.addir.list('pre-step-session').some(entry => entry.path === mainDir)).toBe(true)
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
