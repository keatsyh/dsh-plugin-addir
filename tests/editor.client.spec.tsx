// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { WorkspaceAddirModal, type WorkspaceEditorProps } from '../src/client/WorkspaceAddirModal.tsx'
import { fetchWorkspaceDirectories, replaceWorkspaceDirectories } from '../src/client/api.ts'
import { zh } from '../src/client/locales.ts'

vi.mock('../src/client/api.ts', () => ({ fetchWorkspaceDirectories: vi.fn(), replaceWorkspaceDirectories: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

function editor(overrides: Partial<WorkspaceEditorProps> = {}) {
  const props: WorkspaceEditorProps = {
    target: { workspaceId: 'project' as WorkspaceId, displayTitle: 'Project', path: '/projects/main' },
    onClose: vi.fn(), rename: vi.fn(async () => {}), removeWorkspace: vi.fn(async () => {}),
    pick: vi.fn(async () => '/projects/shared'), t: key => zh[key], ...overrides,
  }
  render(<WorkspaceAddirModal {...props} />)
  return props
}
async function loaded() { await waitFor(() => expect(screen.getByRole('button', { name: '保存' }).hasAttribute('disabled')).toBe(false)) }

describe('project editor', () => {
  it('calls the native picker directly and commits the complete draft only on Save', async () => {
    vi.mocked(fetchWorkspaceDirectories).mockResolvedValue([])
    vi.mocked(replaceWorkspaceDirectories).mockResolvedValue()
    const props = editor()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: '添加文件夹' }))
    await screen.findByText('shared')
    expect(props.pick).toHaveBeenCalledOnce()
    expect(screen.queryByRole('textbox', { name: '文件夹路径' })).toBeNull()
    expect(replaceWorkspaceDirectories).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: '只读' }))
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce())
    expect(props.rename).toHaveBeenCalledWith(props.target.workspaceId, 'Updated')
    expect(replaceWorkspaceDirectories).toHaveBeenCalledWith('/projects/main', [{ path: '/projects/shared', alias: '', readOnly: true }])
  })

  it('leaves saved associations unchanged when selection or editing is cancelled', async () => {
    vi.mocked(fetchWorkspaceDirectories).mockResolvedValue([{ path: '/projects/saved', alias: 'saved', readOnly: false }])
    const props = editor({ pick: vi.fn(async () => null) })
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: '添加文件夹' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '添加文件夹' }).hasAttribute('disabled')).toBe(false))
    expect(screen.getByText('saved')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '移除文件夹: saved' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(replaceWorkspaceDirectories).not.toHaveBeenCalled()
    expect(props.rename).not.toHaveBeenCalled()
  })

  it('keeps the draft open and restores the title when association persistence fails', async () => {
    vi.mocked(fetchWorkspaceDirectories).mockResolvedValue([])
    vi.mocked(replaceWorkspaceDirectories).mockRejectedValue(new Error('Disk is unavailable'))
    const props = editor()
    await loaded()
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Disk is unavailable')
    expect(props.rename).toHaveBeenNthCalledWith(1, props.target.workspaceId, 'Updated')
    expect(props.rename).toHaveBeenNthCalledWith(2, props.target.workspaceId, 'Project')
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('blocks Save after a load failure instead of replacing unread associations with an empty list', async () => {
    vi.mocked(fetchWorkspaceDirectories).mockRejectedValue(new Error('HTTP 404'))
    editor()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'HTTP 404')
    expect(screen.getByRole('button', { name: '保存' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
    expect(replaceWorkspaceDirectories).not.toHaveBeenCalled()
  })
})
