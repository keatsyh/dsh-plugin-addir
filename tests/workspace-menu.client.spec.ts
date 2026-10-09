// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installWorkspaceMenu } from '../src/client/workspace-menu.ts'
import type { EditTarget } from '../src/client/WorkspaceAddirModal.tsx'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); dispose = undefined; document.body.replaceChildren() })
const flush = async () => { await new Promise<void>(resolve => queueMicrotask(resolve)) }
function setup() {
  document.body.innerHTML = '<div data-row-key="workspace:one"><button>Actions</button><button>New Session</button></div><div data-row-key="workspace:two"><button>Actions</button></div><div data-row-key="session:one"><button>Actions</button></div>'
  const targets: Record<string, EditTarget> = {
    one: { workspaceId: 'one' as WorkspaceId, displayTitle: 'One', path: '/one' },
    two: { workspaceId: 'two' as WorkspaceId, displayTitle: 'Two', path: '/two' },
  }
  const open = vi.fn()
  dispose = installWorkspaceMenu(document, { label: () => '编辑', resolve: key => targets[key], open })
  const anchor = (key: string) => document.querySelector<HTMLButtonElement>(`[data-row-key="workspace:${key}"] button`)!
  const show = (button: HTMLButtonElement) => {
    button.onclick = () => {
      const existing = document.querySelector('[role="menu"]')
      if (existing) { existing.remove(); return }
      const menu = document.createElement('div')
      menu.setAttribute('role', 'menu')
      menu.innerHTML = '<div role="presentation"><div class="native-wrap"><button role="menuitem" class="native-item"><span><svg></svg></span><span>Rename</span></button></div><div><button role="menuitem">Delete</button></div></div>'
      document.body.append(menu)
    }
    button.click()
  }
  return { targets, open, anchor, show }
}
describe('workspace menu adapter', () => {
  it('inserts one native-looking row, closes the menu, and resolves fresh Workspace data', async () => {
    const s = setup()
    s.show(s.anchor('one'))
    await flush()
    expect([...document.querySelectorAll('[role="menuitem"]')].map(row => row.textContent)).toEqual(['编辑', 'Rename', 'Delete'])
    const edit = document.querySelector<HTMLButtonElement>('[data-addir-menu] button')!
    expect(edit.className).toBe('native-item')
    expect(edit.querySelector('svg')).not.toBeNull()
    document.body.append(document.createElement('div'))
    await flush()
    expect(document.querySelectorAll('[data-addir-menu]')).toHaveLength(1)
    s.targets.one!.displayTitle = 'Updated'
    edit.click()
    await flush()
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(s.open).toHaveBeenCalledWith(s.targets.one)
    s.show(s.anchor('two'))
    await flush()
    document.querySelector<HTMLButtonElement>('[data-addir-menu] button')!.click()
    await flush()
    expect(s.open).toHaveBeenLastCalledWith(s.targets.two)
  })
  it('ignores session menus and the Workspace New Session button', async () => {
    const s = setup()
    s.show(document.querySelector<HTMLButtonElement>('[data-row-key="session:one"] button')!)
    await flush()
    expect(document.querySelector('[data-addir-menu]')).toBeNull()
    document.querySelector('[role="menu"]')!.remove()
    s.show(document.querySelectorAll<HTMLButtonElement>('[data-row-key="workspace:one"] button')[1]!)
    await flush()
    expect(document.querySelector('[data-addir-menu]')).toBeNull()
  })
  it('removes contributions on disposal and suppresses a queued editor activation', async () => {
    const s = setup()
    s.show(s.anchor('one'))
    await flush()
    document.querySelector<HTMLButtonElement>('[data-addir-menu] button')!.click()
    dispose!()
    await flush()
    expect(s.open).not.toHaveBeenCalled()
    s.show(s.anchor('one'))
    await flush()
    expect(document.querySelector('[data-addir-menu]')).toBeNull()
  })
  it('leaves unknown Workspace ids and incompatible menu structures unchanged', async () => {
    const s = setup()
    delete s.targets.one
    s.show(s.anchor('one'))
    await flush()
    expect(document.querySelector('[data-addir-menu]')).toBeNull()
    document.querySelector('[role="menu"]')!.remove()
    s.show(s.anchor('two'))
    document.querySelector('[role="menuitem"]')!.remove()
    await flush()
    expect(document.querySelector('[data-addir-menu]')).toBeNull()
  })
})
