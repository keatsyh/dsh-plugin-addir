import { describe, expect, it } from 'vitest'
import {
  formatWorkspaceDirectoriesPrompt,
  WORKSPACE_DIRECTORIES_CONTEXT_NAME,
  WORKSPACE_DIRECTORIES_CONTEXT_ORDER,
} from '../src/context.ts'
import type { LinkedDirectory } from '../src/types.ts'

describe('context injection', () => {
  const primaryDir: LinkedDirectory = {
    path: '/workspace/main',
    alias: 'primary',
    readOnly: false,
    addedAt: 1000,
    source: 'primary',
  }

  const secondaryDir: LinkedDirectory = {
    path: '/workspace/sub-service',
    alias: 'sub-service',
    description: 'Microservice logic',
    readOnly: false,
    addedAt: 2000,
    source: 'dynamic',
  }

  const readOnlyDocs: LinkedDirectory = {
    path: '/workspace/docs',
    alias: 'docs',
    description: 'Architecture documentation',
    readOnly: true,
    addedAt: 3000,
    source: 'config',
  }

  it('returns empty prompt when only primary directory exists', () => {
    const prompt = formatWorkspaceDirectoriesPrompt([primaryDir])
    expect(prompt).toBe('')
  })

  it('formats multi-directory markdown prompt correctly', () => {
    const prompt = formatWorkspaceDirectoriesPrompt([primaryDir, secondaryDir, readOnlyDocs])
    expect(prompt).toContain('# Active Workspace Directories')
    expect(prompt).toContain('- [primary] `/workspace/main` (Primary root)')
    expect(prompt).toContain('- [sub-service] `/workspace/sub-service` - Microservice logic')
    expect(prompt).toContain('- [docs] `/workspace/docs` [Read-Only] - Architecture documentation')
    expect(prompt).toContain('All file reading, searching, and execution tools accept paths located inside any of these directories.')
  })

  it('renders a stable prompt with the primary root first regardless of input order', () => {
    const first = formatWorkspaceDirectoriesPrompt([secondaryDir, readOnlyDocs, primaryDir])
    expect(first).toBe(formatWorkspaceDirectoriesPrompt([readOnlyDocs, primaryDir, secondaryDir]))

    const bullets = first.split('\n').filter(line => line.startsWith('- ['))
    expect(bullets[0]).toContain('[primary]')
    expect(bullets.slice(1).map(line => line.slice(line.indexOf('['), line.indexOf(']') + 1)))
      .toEqual(['[docs]', '[sub-service]'])
  })

  it('places the runtime-context contribution next to the working directory', () => {
    expect(WORKSPACE_DIRECTORIES_CONTEXT_NAME).toBe('working-directories:linked')
    expect(WORKSPACE_DIRECTORIES_CONTEXT_ORDER).toBeGreaterThan(100)
    expect(WORKSPACE_DIRECTORIES_CONTEXT_ORDER).toBeLessThan(110)
  })
})
