import z from '@deepseek-ai/schemastery'

/**
 * Definition of a statically configured directory link.
 */
export interface StaticDirectoryConfig {
  path: string
  alias?: string
  description?: string
  readOnly?: boolean
}

/**
 * User configuration for the multi-directory workspace plugin.
 */
export interface Config {
  /**
   * Pre-configured directory links to associate with the workspace on launch.
   */
  defaultDirectories?: StaticDirectoryConfig[]

  /**
   * Whether to register agent-facing tools for dynamic directory management.
   * Default: true.
   */
  enableTools?: boolean

  /**
   * Whether to inject Active Workspace Directories into the model's context before each turn.
   * Default: true.
   */
  enableContextInjection?: boolean

  /**
   * Whether to enforce read-only restrictions on files under readOnly directories.
   * Default: true.
   */
  enforceReadOnly?: boolean
}

export interface ResolvedConfig {
  readonly defaultDirectories: readonly StaticDirectoryConfig[]
  readonly enableTools: boolean
  readonly enableContextInjection: boolean
  readonly enforceReadOnly: boolean
}

/**
 * Config schema type. Annotating schema exports with it keeps emitted
 * declarations free of schemastery's internal cosmokit types, which a
 * standalone package cannot name.
 */
export type ConfigSchema = z<Config>

export const StaticDirectoryConfigSchema: z<StaticDirectoryConfig> = z.object({
  path: z.string().required().description('Path to the target directory'),
  alias: z.string().description('Unique alias or label for this directory'),
  description: z.string().description('Purpose of this directory'),
  readOnly: z.boolean().default(false).description('Whether this directory is read-only'),
})

export const Config: ConfigSchema = z.object({
  defaultDirectories: z.array(StaticDirectoryConfigSchema).default([]).description('Static directories to link on startup'),
  enableTools: z.boolean().default(true).description('Enable agent tools (list, add, remove directories)'),
  enableContextInjection: z.boolean().default(true).description('Enable prompt context injection of active workspace directories'),
  enforceReadOnly: z.boolean().default(true).description('Enforce write protections for read-only directories'),
})

export function resolveConfig(config: Config = {}): ResolvedConfig {
  return {
    defaultDirectories: config.defaultDirectories ?? [],
    enableTools: config.enableTools ?? true,
    enableContextInjection: config.enableContextInjection ?? true,
    enforceReadOnly: config.enforceReadOnly ?? true,
  }
}
