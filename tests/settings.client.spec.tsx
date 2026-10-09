// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { WorkspaceSource, WorkspaceSnapshot, WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { AddirSettingsSection } from '../src/client/SettingsSection.tsx'
import { zh } from '../src/client/locales.ts'

vi.mock('../src/client/api.ts', () => ({
  fetchGlobalConfig: vi.fn(async () => ({ enableTools: false, enableContextInjection: true, enforceReadOnly: true })),
  saveGlobalConfig: vi.fn(async () => {}),
}))
afterEach(cleanup)
describe('settings editor fallback', () => {
  it('opens the chosen Workspace editor without relying on a sidebar menu', async () => {
    const snapshot: WorkspaceSnapshot = {
      items: [{ workspaceId: 'one' as WorkspaceId, title: 'Project One', path: '/one', sessionIds: [], createdAt: '', updatedAt: '' }],
      archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    }
    const unsubscribe = vi.fn()
    const source: WorkspaceSource = { getSnapshot: () => snapshot, subscribe: () => unsubscribe }
    const openEdit = vi.fn()
    const view = render(<AddirSettingsSection t={key => zh[key]} workspaceSource={source} openEdit={openEdit} />)
    await screen.findByRole('checkbox', { name: /目录上下文/ })
    expect(screen.getByText('Project One')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    expect(openEdit).toHaveBeenCalledWith('one')
    view.unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
