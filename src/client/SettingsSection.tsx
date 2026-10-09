/** Profile-wide switches; workspace associations belong to the workspace editor. */
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { WorkspaceSource } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { fetchGlobalConfig, saveGlobalConfig, type GlobalConfig } from './api.ts'
import type { Translate } from './locales.ts'
export function AddirSettingsSection({ t, workspaceSource, openEdit }: {
  t: Translate; workspaceSource: WorkspaceSource; openEdit: (key: string) => void
}) {
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetchGlobalConfig(controller.signal).then(setConfig).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => controller.abort()
  }, [])
  const save = async () => {
    if (!config) return
    setBusy(true); setError(null); setSaved(false)
    try { await saveGlobalConfig(config); setSaved(true) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <div className="addir-settings"><h2>{t('globalTitle')}</h2><p>{t('globalNote')}</p>
    {config === null ? (error === null ? <StateDot state="ongoing" /> : null) : <>
      {([['enableTools', 'tools', 'toolsNote'], ['enableContextInjection', 'context', 'contextNote'], ['enforceReadOnly', 'guard', 'guardNote']] as const).map(([key, label, note]) => <div className="addir-setting" key={key}><label htmlFor={`addir-${key}`}><span>{t(label)}</span><p>{t(note)}</p></label><input id={`addir-${key}`} type="checkbox" checked={config[key]} disabled={busy} onChange={event => { setConfig({ ...config, [key]: event.target.checked }); setSaved(false) }} /></div>)}
      <div><Button variant="primary" disabled={busy} onClick={() => { void save() }}>{busy && <StateDot state="ongoing" />}{t('save')}</Button></div>
    </>}
    <WorkspaceEditors source={workspaceSource} openEdit={openEdit} t={t} />
    {error !== null && <div className="addir-error" role="alert">{error}</div>}
    {saved && <p role="status">{t('saved')}</p>}
  </div>
}

/** Settings fallback remains available when an upstream menu layout changes. */
function WorkspaceEditors({ source, openEdit, t }: { source: WorkspaceSource; openEdit: (key: string) => void; t: Translate }) {
  const snapshot = useSyncExternalStore(listener => source.subscribe(listener), () => source.getSnapshot())
  return <div className="addir-workspace-editors"><h3>{t('workspaceEditors')}</h3>
    {snapshot.items.map(workspace => <div className="addir-setting" key={workspace.workspaceId}>
      <span>{workspace.title || workspace.path}</span>
      <Button variant="outline" onClick={() => openEdit(workspace.workspaceId)}>{t('edit')}</Button>
    </div>)}
  </div>
}
