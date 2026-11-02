/**
 * Multi-Directory Workspace plugin entry for DeepSeek Harness.
 * Inspired by Codex (--add-dir) and Google Antigravity (active multi-root workspaces).
 *
 * @module dsh-plugin-workspace-directories
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { Config, resolveConfig, type ConfigSchema } from './config.ts'
import {
  formatWorkspaceDirectoriesPrompt,
  WORKSPACE_DIRECTORIES_CONTEXT_NAME,
  WORKSPACE_DIRECTORIES_CONTEXT_ORDER,
} from './context.ts'
import { WorkspaceDirectoriesServiceImpl } from './service.ts'
import { createAddTool, createListTool, createRemoveTool } from './tools.ts'
import { registerAddirRoutes } from './api.ts'
import type { AddDirectoryOptions, AddirService, LinkedDirectory } from './types.ts'

export * from './config.ts'
export * from './context.ts'
export * from './guard.ts'
export * from './service.ts'
export * from './tools.ts'
export * from './types.ts'

export const name = 'dsh-plugin-addir'

/**
 * The `systemPrompt` registry surface this plugin contributes to. Declared
 * locally because `@deepseek-ai/dsh-system-prompt` is a Host service this
 * package only calls at runtime.
 */
interface PromptContextRegistry {
  /**
   * Register one dynamic runtime-context contribution.
   * @param entry - name, placement, and the text provider evaluated per assembly.
   * @returns the disposer of the registration.
   */
  context(entry: {
    readonly name: string
    readonly order: number
    readonly text: (context: { readonly agent?: Agent }) => string
    readonly interpolate?: boolean
    readonly required?: boolean
  }): () => void
}

/**
 * Service Provider wrapping WorkspaceDirectoriesServiceImpl for Cordis.
 */
export class AddirProvider extends Service implements AddirService {
  // Annotated so the emitted declaration names a public schema type rather than
  // inferring one that reaches into schemastery's internal cosmokit types.
  static Config: ConfigSchema = Config

  private readonly impl: WorkspaceDirectoriesServiceImpl

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'addir')
    const resolved = resolveConfig(config)
    this.impl = new WorkspaceDirectoriesServiceImpl(resolved)

    if (resolved.enableTools) {
      ctx.inject(['tools'], (toolsCtx) => {
        toolsCtx.effect(() => toolsCtx.tools.register(createListTool(this, 'addir_list')))
        toolsCtx.effect(() => toolsCtx.tools.register(createAddTool(this, 'addir_add')))
        toolsCtx.effect(() => toolsCtx.tools.register(createRemoveTool(this, 'addir_remove')))
      })
    }

    // Context injection: one runtime-context contribution. The agent loop keeps
    // a single directory snapshot and appends another only when this text
    // changes, so a long turn cannot accumulate one copy per step.
    if (resolved.enableContextInjection) {
      ctx.inject(['systemPrompt'], (promptCtx) => {
        const registry = promptCtx.get('systemPrompt') as PromptContextRegistry
        promptCtx.effect(() => registry.context({
          name: WORKSPACE_DIRECTORIES_CONTEXT_NAME,
          order: WORKSPACE_DIRECTORIES_CONTEXT_ORDER,
          // The table is operational context for every file tool, so it survives
          // deployments that suppress optional runtime context.
          required: true,
          interpolate: false,
          text: (context) => {
            const agent = context.agent
            if (agent === undefined) return ''
            return formatWorkspaceDirectoriesPrompt(this.directoriesFor(agent))
          },
        }))
      })
    }

    // Tools and the read-only guard resolve one Session's directories, so the
    // primary follows that Session's cwd even when context injection is off.
    // Re-syncing an unchanged cwd reads no storage.
    ctx.on('agent/pre-step', async ({ agent }, next): Promise<PreStepDecision> => {
      this.syncPrimary(agent)
      return next()
    })

    // Protection guard: intercept write attempts on read-only directories
    if (resolved.enforceReadOnly) {
      ctx.on('tools/execute', async (execution, next) => {
        const args = execution.arguments
        if (['write', 'edit', 'write_file', 'edit_file'].includes(execution.name)
          && args !== null && typeof args === 'object') {
          const filePath = 'file_path' in args ? args.file_path : 'path' in args ? args.path : 'target' in args ? args.target : undefined
          if (typeof filePath === 'string') {
            const sessionId = execution.agent?.session.id
            const resolvedPath = this.resolvePath(filePath, sessionId)
            if (this.isReadOnly(resolvedPath, sessionId)) {
              throw new Error(`Access Denied: Path "${filePath}" is inside a read-only workspace directory.`)
            }
          }
        }
        return next()
      })
    }

    // Register Web API routes
    registerAddirRoutes(ctx, this.impl, resolved)
  }

  /** Mirror a Session's cwd into the directory state; an unchanged cwd reads no storage. */
  private syncPrimary(agent: Agent): void {
    // Infer nothing from the process working directory: on Desktop that is the Host's
    // own profile directory, which is not a workspace.
    const cwd = agent.session.header.cwd
    if (cwd !== undefined) this.setPrimary(cwd, agent.session.id)
  }

  /** The directories whose table the model should receive for one Agent. */
  private directoriesFor(agent: Agent): readonly LinkedDirectory[] {
    this.syncPrimary(agent)
    return this.list(agent.session.id)
  }

  list(sessionId?: string) {
    return this.impl.list(sessionId)
  }

  get(pathOrAlias: string, sessionId?: string) {
    return this.impl.get(pathOrAlias, sessionId)
  }

  add(options: AddDirectoryOptions, sessionId?: string) {
    return this.impl.add(options, sessionId)
  }

  remove(pathOrAlias: string, sessionId?: string) {
    return this.impl.remove(pathOrAlias, sessionId)
  }

  resolvePath(target: string, sessionId?: string) {
    return this.impl.resolvePath(target, sessionId)
  }

  isUnderWorkspace(targetPath: string, sessionId?: string) {
    return this.impl.isUnderWorkspace(targetPath, sessionId)
  }

  isReadOnly(targetPath: string, sessionId?: string) {
    return this.impl.isReadOnly(targetPath, sessionId)
  }

  setPrimary(cwd: string, sessionId?: string) {
    return this.impl.setPrimary(cwd, sessionId)
  }

  getDirectoriesForWorkspace(workspacePath: string) {
    return this.impl.getDirectoriesForWorkspace(workspacePath)
  }

  addDirectoryToWorkspace(workspacePath: string, options: any) {
    return this.impl.addDirectoryToWorkspace(workspacePath, options)
  }

  removeDirectoryFromWorkspace(workspacePath: string, pathOrAlias: string) {
    return this.impl.removeDirectoryFromWorkspace(workspacePath, pathOrAlias)
  }

  replaceWorkspaceDirectories(workspacePath: string, directories: readonly import('./types.ts').AddDirectoryOptions[]) {
    return this.impl.replaceWorkspaceDirectories(workspacePath, directories)
  }
}

/**
 * Standard Cordis plugin entry function.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const provider = new AddirProvider(ctx, config)
  ctx.provide('addir', provider)
}

export { AddirProvider as WorkspaceDirectoriesProvider }
export default AddirProvider
