/**
 * Multi-Directory Workspace plugin entry for DeepSeek Harness.
 * Inspired by Codex (--add-dir) and Google Antigravity (active multi-root workspaces).
 *
 * @module dsh-plugin-workspace-directories
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { Config, resolveConfig, type ConfigSchema } from './config.ts'
import {
  createWorkspaceDirectoriesMessage,
  isWorkspaceDirectoriesMessage,
} from './context.ts'
import { WorkspaceDirectoriesServiceImpl } from './service.ts'
import { createAddTool, createListTool, createRemoveTool } from './tools.ts'
import { registerAddirRoutes } from './api.ts'
import type { AddDirectoryOptions, AddirService } from './types.ts'

export * from './config.ts'
export * from './context.ts'
export * from './guard.ts'
export * from './service.ts'
export * from './tools.ts'
export * from './types.ts'

export const name = 'dsh-plugin-addir'

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

    // Context injection: inject Active Workspace Directories into agent turns
    if (resolved.enableContextInjection) {
      ctx.on('agent/pre-step', async ({ agent }, next): Promise<PreStepDecision> => {
        const decision = await next()
        if (decision.kind === 'reject') {
          return decision
        }

        const sessionId = agent.session.id
        // Infer nothing from the process working directory: on Desktop that is the Host's
        // own profile directory, which is not a workspace.
        const cwd = agent.session.header.cwd
        if (cwd !== undefined) this.setPrimary(cwd, sessionId)

        const dirs = this.list(sessionId)
        const contextMsg = createWorkspaceDirectoriesMessage(dirs)

        if (!contextMsg) {
          return decision
        }

        // Check if an existing workspace-directories message is already in decision.messages
        const filteredMessages = decision.messages.filter(m => !isWorkspaceDirectoriesMessage(m))

        // Prepend context message right before turn messages
        return {
          ...decision,
          messages: [contextMsg, ...filteredMessages],
        }
      })
    }

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
