import { describe, expect, it } from 'vitest'
import {
  createWorkspaceDirectoriesMessage,
  formatWorkspaceDirectoriesPrompt,
  isWorkspaceDirectoriesMessage,
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
    const message = createWorkspaceDirectoriesMessage([primaryDir])
    expect(message).toBeUndefined()
  })

  it('formats multi-directory markdown prompt correctly', () => {
    const prompt = formatWorkspaceDirectoriesPrompt([primaryDir, secondaryDir, readOnlyDocs])
    expect(prompt).toContain('# Active Workspace Directories')
    expect(prompt).toContain('- [primary] `/workspace/main` (Primary root)')
    expect(prompt).toContain('- [sub-service] `/workspace/sub-service` - Microservice logic')
    expect(prompt).toContain('- [docs] `/workspace/docs` [Read-Only] - Architecture documentation')
    expect(prompt).toContain('All file reading, searching, and execution tools accept paths located inside any of these directories.')
  })

  it('creates and identifies user message', () => {
    const message = createWorkspaceDirectoriesMessage([primaryDir, secondaryDir])
    expect(message).toBeDefined()
    if (!message) return

    expect(isWorkspaceDirectoriesMessage(message)).toBe(true)
    expect(message.source.kind).toBe('workspace-directories')
    expect(message.content[0]?.type).toBe('text')
  })
})
