/**
 * Runtime-context contribution for multi-directory workspaces.
 * Inspired by Antigravity active workspaces and Codex multi-directory prompts.
 *
 * The table is registered as one dynamic runtime-context entry, not as a
 * per-step user message: the agent loop admits one snapshot and appends a new
 * one only when the rendered text changes.
 *
 * @module dsh-plugin-workspace-directories/context
 */

import type { LinkedDirectory } from './types.ts'

/**
 * Runtime-context name of the directory table. Placement sits between the
 * working directory (100) and the sandbox policy (110) because it extends the
 * same filesystem scope those entries describe.
 */
export const WORKSPACE_DIRECTORIES_CONTEXT_NAME = 'working-directories:linked'

/** Numeric prompt-context order of {@link WORKSPACE_DIRECTORIES_CONTEXT_NAME}. */
export const WORKSPACE_DIRECTORIES_CONTEXT_ORDER = 105

function isPrimary(entry: LinkedDirectory): boolean {
  return entry.source === 'primary'
}

/**
 * Order directories primary first, then by path, so an unchanged set always
 * renders identical text and the loop skips re-admitting the snapshot.
 */
function ordered(directories: readonly LinkedDirectory[]): readonly LinkedDirectory[] {
  return [...directories].sort((a, b) => {
    const primaryDelta = Number(isPrimary(b)) - Number(isPrimary(a))
    if (primaryDelta !== 0) return primaryDelta
    if (a.path === b.path) return 0
    return a.path < b.path ? -1 : 1
  })
}

/**
 * Format the active workspace directories into a clear Markdown guide for the model.
 * @param directories - every linked directory for the current session.
 * @returns the table, or an empty string when only the primary root exists.
 */
export function formatWorkspaceDirectoriesPrompt(directories: readonly LinkedDirectory[]): string {
  if (directories.length <= 1) {
    return ''
  }

  const lines: string[] = [
    '# Active Workspace Directories',
    '',
    'The workspace is configured with multiple linked directories:',
  ]

  for (const dir of ordered(directories)) {
    const tag = `[${dir.alias}]`
    const pathStr = `\`${dir.path}\``
    const primaryLabel = isPrimary(dir) ? ' (Primary root)' : ''
    const readOnlyLabel = dir.readOnly ? ' [Read-Only]' : ''
    const desc = dir.description ? ` - ${dir.description}` : ''

    lines.push(`- ${tag} ${pathStr}${primaryLabel}${readOnlyLabel}${desc}`)
  }

  lines.push('')
  lines.push('**Navigation and Guidelines**:')
  lines.push('- All file reading, searching, and execution tools accept paths located inside any of these directories.')
  lines.push('- You can use full absolute paths or alias-prefixed paths (e.g. `[alias]/path/to/file` or `alias:path/to/file`).')
  lines.push('- Respect directories marked with `[Read-Only]`: only inspect and read from them, do not attempt to write or edit files there.')
  lines.push('- Place new project-specific outputs in the primary root unless explicitly directed otherwise.')

  return lines.join('\n')
}
