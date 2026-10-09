/**
 * Protection guards and sandbox policy integration for multi-directory workspaces.
 * Inspired by Codex sandbox expansion and read-only directory protection.
 *
 * @module dsh-plugin-workspace-directories/guard
 */

import type { WorkspaceDirectoriesService } from './types.ts'

export interface PathAccessCheckResult {
  allowed: boolean
  readOnly: boolean
  reason?: string
}

/**
 * Check if write operations are permitted for a specific target path.
 */
export function checkWritePermission(
  service: WorkspaceDirectoriesService,
  targetPath: string,
  sessionId?: string,
): PathAccessCheckResult {
  const resolved = service.resolvePath(targetPath, sessionId)

  if (service.isReadOnly(resolved, sessionId)) {
    return {
      allowed: false,
      readOnly: true,
      reason: `Write operation rejected: Target path "${targetPath}" is inside a read-only workspace directory.`,
    }
  }

  return {
    allowed: true,
    readOnly: false,
  }
}

/**
 * Compute the full list of allowed writable directory roots for sandbox policy.
 * Expands the default workspaceRoot to include all non-read-only linked directories.
 */
export function getWritableWorkspaceRoots(
  service: WorkspaceDirectoriesService,
  primaryRoot: string,
  sessionId?: string,
): string[] {
  const roots = new Set<string>()
  roots.add(primaryRoot)

  const linked = service.list(sessionId)
  for (const entry of linked) {
    if (!entry.readOnly) {
      roots.add(entry.path)
    }
  }

  return Array.from(roots)
}
