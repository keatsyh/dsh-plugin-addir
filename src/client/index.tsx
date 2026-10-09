/** Workspace menu adapter, persistent editor overlay and global settings page. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { HostObservable, PropsHooks, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { installWorkspaceMenu } from './workspace-menu.ts'
import { AddirSettingsSection } from './SettingsSection.tsx'
import { WorkspaceAddirModal, type EditTarget, type EditorActions } from './WorkspaceAddirModal.tsx'
import { en, zh, type CopyKey } from './locales.ts'
import { styles } from './styles.ts'

export * from './api.ts'
export * from './WorkspaceAddirModal.tsx'
export * from './SettingsSection.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { addir: CopyKey }
}
export const inject = ['slots', 'locale', 'workspaces', 'uiWorkspace']

type OverlayProps = PropsRuntime<'shell.overlay'> & PropsLocale<'addir'>
  & PropsHooks<{ editRequest: HostObservable<EditTarget | null> }>
  & EditorActions & { closeEdit: () => void }
function EditOverlay({ useEditRequest, closeEdit, t, ...actions }: OverlayProps) {
  const target = useEditRequest(value => value)
  return target === null ? null : <WorkspaceAddirModal key={target.workspaceId} target={target} onClose={closeEdit} t={t} {...actions} />
}
export function apply(ctx: Context): void {
  const editRequest = createSnapshotStore<EditTarget | null>(null)
  ctx.effect(() => ctx.locale.register('addir', { zh, en }), 'addir: localized copy')
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-plugin-addir'
    tag.textContent = styles
    document.head.append(tag)
    return () => { tag.remove() }
  }, 'addir: editor styles')
  const t = ctx.locale.bind('addir')
  const resolveWorkspace = (key: string): EditTarget | undefined => {
    const workspace = ctx.workspaces.list.getSnapshot().items.find(item => item.workspaceId === key)
    if (workspace === undefined) return undefined
    const basename = workspace.path.split(/[\\/]/).filter(Boolean).at(-1) || workspace.path
    return { workspaceId: workspace.workspaceId, displayTitle: workspace.title || basename, path: workspace.path }
  }
  ctx.effect(() => installWorkspaceMenu(document, {
    label: () => t('edit'),
    resolve: resolveWorkspace,
    open: target => { editRequest.set(target) },
  }), 'addir: workspace menu adapter')
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'dsh-plugin-addir.editor', locale: 'addir',
    inject: () => ({
      hooks: { editRequest }, closeEdit: () => { editRequest.set(null) },
      rename: async (id: EditTarget['workspaceId'], title: string) => { await ctx.workspaces.rename(id, title) },
      removeWorkspace: (id: EditTarget['workspaceId']) => ctx.workspaces.delete(id),
      pick: () => ctx.uiWorkspace.pickDirectory(),
    }),
  }, EditOverlay))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'addir-directories', order: 250, label: () => t('globalTitle'), locale: 'addir',
    inject: () => ({ workspaceSource: ctx.workspaces.list, openEdit: (key: string) => {
      const target = resolveWorkspace(key)
      if (target !== undefined) editRequest.set(target)
    } }),
  }, AddirSettingsSection))
}
