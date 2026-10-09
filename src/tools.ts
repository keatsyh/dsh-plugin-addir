/**
 * Agent-facing tools for multi-directory workspace management.
 * Inspired by Codex (--add-dir) and Antigravity workspace inspection.
 *
 * @module dsh-plugin-workspace-directories/tools
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { AddDirectoryOptions, WorkspaceDirectoriesService } from './types.ts'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[]

/**
 * Tool: addir_list (alias: workspace_directories_list)
 * Inspect all directories currently associated with this workspace.
 */
export function createListTool(service: WorkspaceDirectoriesService, toolName = 'addir_list') {
  return defineTool({
    name: toolName,
    description: 'List all root and linked directories associated with the current workspace, including primary cwd, aliases, descriptions, and read-only flags.',
    parameters: {
      schemaVersion: {
        type: 'string',
        const: 'v1',
        description: 'Optional format version.',
      },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const dirs = value as unknown as Array<{
          path: string
          alias: string
          description?: string
          readOnly: boolean
          source: string
        }>
        if (!dirs || dirs.length === 0) {
          return [{ type: 'text', text: 'No directories associated.' }]
        }
        const lines = ['### Associated Workspace Directories:']
        for (const d of dirs) {
          const ro = d.readOnly ? ' `[Read-Only]`' : ''
          const src = d.source === 'primary' ? ' **(Primary Root)**' : ''
          const desc = d.description ? ` - ${d.description}` : ''
          lines.push(`- **[${d.alias}]** \`${d.path}\`${src}${ro}${desc}`)
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      const sessionId = exec.agent?.session.id
      const list = service.list(sessionId)
      return list as unknown as JsonValue
    },
  })
}

/**
 * Tool: addir_add (alias: workspace_directories_add)
 * Associate an additional directory with the workspace (inspired by Codex --add-dir).
 */
export function createAddTool(service: WorkspaceDirectoriesService, toolName = 'addir_add') {
  return defineTool({
    name: toolName,
    description: 'Associate an additional directory with the current workspace. Allows reading, searching, and operating on code in that directory. Inspired by Codex --add-dir.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute or relative path to the directory to link.',
      },
      alias: {
        type: 'string',
        description: 'Optional semantic alias (e.g. "backend", "docs", "core-lib").',
      },
      description: {
        type: 'string',
        description: 'Optional brief description of what this directory contains.',
      },
      readOnly: {
        type: 'boolean',
        description: 'Whether to protect this directory as read-only (default: false).',
      },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const item = value as unknown as {
          path: string
          alias: string
          readOnly: boolean
          description?: string
        }
        const ro = item.readOnly ? ' (Read-Only)' : ''
        return [{
          type: 'text',
          text: `Successfully linked directory: [${item.alias}] "${item.path}"${ro}`,
        }]
      },
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const sessionId = exec.agent?.session.id
      const pathStr = String(args.path)
      const aliasStr = args.alias ? String(args.alias) : undefined
      const descStr = args.description ? String(args.description) : undefined
      const readOnlyBool = typeof args.readOnly === 'boolean' ? args.readOnly : false

      const addOptions: AddDirectoryOptions = {
        path: pathStr,
        readOnly: readOnlyBool,
      }
      if (aliasStr !== undefined) addOptions.alias = aliasStr
      if (descStr !== undefined) addOptions.description = descStr

      const added = await service.add(addOptions, sessionId)
      return added as unknown as JsonValue
    },
  })
}

/**
 * Tool: addir_remove (alias: workspace_directories_remove)
 * Remove a previously linked directory from the workspace.
 */
export function createRemoveTool(service: WorkspaceDirectoriesService, toolName = 'addir_remove') {
  return defineTool({
    name: toolName,
    description: 'Remove a linked directory from the current workspace by path or alias. The primary workspace root cannot be removed.',
    parameters: {
      pathOrAlias: {
        type: 'string',
        required: true,
        description: 'The directory path or alias to unlink.',
      },
    },
    output: {
      schema: { type: 'json' },
      render: (args, value) => {
        const success = Boolean(value)
        return [{
          type: 'text',
          text: success
            ? `Successfully unlinked directory "${String(args.pathOrAlias)}".`
            : `Failed to unlink directory "${String(args.pathOrAlias)}" (not found or not un-linkable).`,
        }]
      },
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const sessionId = exec.agent?.session.id
      const target = String(args.pathOrAlias)
      const removed = await service.remove(target, sessionId)
      return removed as unknown as JsonValue
    },
  })
}
