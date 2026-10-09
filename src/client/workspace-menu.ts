/** DOM adapter for upstream Workspace menus; selectors are isolated here for version updates. */
import type { EditTarget } from './WorkspaceAddirModal.tsx'

/** Plugin-owned labels, authoritative Workspace lookup and editor activation. */
export interface WorkspaceMenuActions {
  label: () => string
  resolve: (key: string) => EditTarget | undefined
  open: (target: EditTarget) => void
}

/**
 * Add Edit to the menu opened by a registered Workspace's first action button.
 * Native rows retain their handlers; the adapter copies Rename's presentation only.
 * @param doc - Client document containing Workspace rows and portaled menus.
 * @param actions - localized label, current Workspace lookup and editor callback.
 * @returns disposer removing listeners, observer and contributed rows.
 */
export function installWorkspaceMenu(doc: Document, actions: WorkspaceMenuActions): () => void {
  let active: { anchor: HTMLButtonElement; key: string; before: Set<Element>; menu?: Element } | undefined
  const contributed = new Set<HTMLElement>()
  let disposed = false
  const capture = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('button')
    const row = button?.closest<HTMLElement>('[data-row-key^="workspace:"]')
    if (button !== null && row !== undefined && row !== null && button === row.querySelector('button')) {
      const key = row.dataset.rowKey?.slice('workspace:'.length)
      if (key && actions.resolve(key) !== undefined) {
        active = { anchor: button, key, before: new Set(doc.querySelectorAll('[role="menu"]')) }
        return
      }
    }
    if (active?.menu?.contains(event.target)) return
    active = undefined
  }
  const observer = new MutationObserver(() => {
    for (const node of contributed) if (!node.isConnected) contributed.delete(node)
    if (active === undefined || !active.anchor.isConnected) return
    if (active.menu !== undefined) return
    const menu = [...doc.querySelectorAll('[role="menu"]')].find(node => !active?.before.has(node))
    if (menu === undefined) return
    active.menu = menu
    const nativeRows = menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    const rename = nativeRows[0]
    const wrapper = rename?.parentElement
    // Upstream Workspace menus have exactly Rename and Delete, each inside a row wrapper.
    if (nativeRows.length !== 2 || rename === undefined || wrapper?.parentElement?.getAttribute('role') !== 'presentation') return
    const copy = wrapper.cloneNode(true)
    if (!(copy instanceof HTMLElement)) return
    const edit = copy.querySelector<HTMLButtonElement>('button')
    const label = edit?.querySelector('span:last-child')
    if (edit === null || edit === undefined || label === null || label === undefined) return
    copy.dataset.addirMenu = ''
    edit.removeAttribute('aria-keyshortcuts')
    label.textContent = actions.label()
    const occurrence = active
    edit.addEventListener('click', event => {
      event.stopPropagation()
      const target = actions.resolve(occurrence.key)
      if (target === undefined || !occurrence.anchor.isConnected) return
      occurrence.anchor.click()
      // Let the native menu close and restore focus before the editor takes focus.
      queueMicrotask(() => { if (!disposed) actions.open(target) })
    })
    wrapper.before(copy)
    contributed.add(copy)
  })
  doc.addEventListener('click', capture, true)
  observer.observe(doc.body, { childList: true, subtree: true })
  return () => {
    disposed = true
    doc.removeEventListener('click', capture, true)
    observer.disconnect()
    for (const node of contributed) node.remove()
    contributed.clear()
    active = undefined
  }
}
