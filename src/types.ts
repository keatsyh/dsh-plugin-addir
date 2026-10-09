/**
 * Types and interfaces for the Multi-Directory Workspace plugin.
 * Inspired by Codex (--add-dir) and Antigravity (multi-root active workspaces).
 *
 * @module dsh-plugin-workspace-directories/types
 */

/**
 * Represents a directory associated with a workspace.
 */
export interface LinkedDirectory {
  /**
   * Canonical, absolute filesystem path with symlinks resolved.
   */
  readonly path: string

  /**
   * Semantic alias or unique name representing the directory
   * (e.g. 'shared-lib', 'frontend', 'docs', analogous to Antigravity's CorpusName).
   */
  readonly alias: string

  /**
   * Human-readable description of what this directory contains and its purpose.
   */
  readonly description?: string | undefined

  /**
   * Whether the directory is protected as read-only.
   * Read-only directories can be searched and inspected, but write operations are rejected.
   */
  readonly readOnly: boolean

  /**
   * Timestamp when the directory was linked.
   */
  readonly addedAt: number

  /**
   * Origin of the directory link:
   * - 'primary': Current session primary working directory (cwd)
   * - 'config': Pre-configured via Cordis configuration
   * - 'dynamic': Added dynamically at runtime by agent or user
   */
  readonly source: 'primary' | 'config' | 'dynamic'
}

/**
 * Options for adding a new directory to the workspace.
 */
export interface AddDirectoryOptions {
  /**
   * Absolute or relative path to the directory.
   */
  path: string

  /**
   * Optional custom alias. If omitted, the basename of the directory is used.
   */
  alias?: string | undefined

  /**
   * Optional description of the directory's purpose.
   */
  description?: string | undefined

  /**
   * Optional read-only flag. Defaults to false.
   */
  readOnly?: boolean | undefined
}

/**
 * Core service managing multi-directory workspace associations.
 */
export interface WorkspaceDirectoriesService {
  /**
   * List all linked directories for a session (or globally).
   * Always includes the primary workspace directory.
   *
   * @param sessionId - Optional session ID to scope directory queries.
   */
  list(sessionId?: string): readonly LinkedDirectory[]

  /**
   * Find a linked directory by exact path or alias.
   *
   * @param pathOrAlias - The canonical path or alias to find.
   * @param sessionId - Optional session ID.
   */
  get(pathOrAlias: string, sessionId?: string): LinkedDirectory | undefined

  /**
   * Associate an additional directory with the workspace.
   * Validates existence, canonicalizes symlinks, and prevents duplicate aliases/paths.
   *
   * @param options - Directory options to add.
   * @param sessionId - Optional session ID for session-scoped additions.
   * @returns The registered LinkedDirectory.
   */
  add(options: AddDirectoryOptions, sessionId?: string): Promise<LinkedDirectory>

  /**
   * Remove a linked directory by path or alias.
   * The primary workspace directory cannot be removed.
   *
   * @param pathOrAlias - The path or alias to remove.
   * @param sessionId - Optional session ID.
   * @returns true if removed, false if not found or primary.
   */
  remove(pathOrAlias: string, sessionId?: string): Promise<boolean>

  /**
   * Resolve a path that may use an alias prefix (e.g. '[docs]/api.md' or 'docs:api.md')
   * into a fully qualified canonical absolute path.
   *
   * @param target - Target string or alias path.
   * @param sessionId - Optional session ID.
   */
  resolvePath(target: string, sessionId?: string): string

  /**
   * Check if a target path is contained within any of the workspace directories.
   *
   * @param targetPath - The path to test.
   * @param sessionId - Optional session ID.
   */
  isUnderWorkspace(targetPath: string, sessionId?: string): boolean

  /**
   * Check if a target path falls under a read-only workspace directory.
   *
   * @param targetPath - The path to test.
   * @param sessionId - Optional session ID.
   */
  isReadOnly(targetPath: string, sessionId?: string): boolean

  /**
   * Set or update the primary workspace directory (cwd).
   * Automatically restores persisted directory associations for this workspace.
   *
   * @param cwd - The working directory path.
   * @param sessionId - Optional session ID.
   */
  setPrimary(cwd: string, sessionId?: string): LinkedDirectory

  /**
   * Get all linked directories for a specific workspace root path from persistence.
   *
   * @param workspacePath - The absolute path of the workspace.
   */
  getDirectoriesForWorkspace(workspacePath: string): readonly LinkedDirectory[]

  /**
   * Associate an additional directory with a specific workspace root path, durably.
   *
   * @param workspacePath - The absolute path of the workspace.
   * @param options - Directory options to add.
   */
  addDirectoryToWorkspace(workspacePath: string, options: AddDirectoryOptions): Promise<LinkedDirectory>

  /**
   * Remove a linked directory from a specific workspace root path durably.
   *
   * @param workspacePath - The absolute path of the workspace.
   * @param pathOrAlias - The path or alias to remove.
   */
  removeDirectoryFromWorkspace(workspacePath: string, pathOrAlias: string): Promise<boolean>

  /** Validate every link before replacing a workspace's saved associations. */
  replaceWorkspaceDirectories(workspacePath: string, directories: readonly AddDirectoryOptions[]): readonly LinkedDirectory[]
}

export type AddirService = WorkspaceDirectoriesService

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * Addir (Multi-directory workspace association) service.
     */
    addir: AddirService
  }
}
