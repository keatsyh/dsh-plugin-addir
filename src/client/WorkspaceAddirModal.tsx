/** Project title and folder associations remain a draft until Save. */
import { useEffect, useState } from 'react'
import { Button, IconCloseOutlineRegular, IconFolderCloseRegular, IconProjectAddOutlineRegular, Input, Modal, StateDot, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { fetchWorkspaceDirectories, replaceWorkspaceDirectories, type ClientLinkedDirectory } from './api.ts'
import type { Translate } from './locales.ts'

export interface EditTarget { workspaceId: WorkspaceId; displayTitle: string; path: string }
export interface EditorActions {
  rename: (id: WorkspaceId, title: string) => Promise<void>
  removeWorkspace: (id: WorkspaceId) => Promise<void>
  pick: () => Promise<string | null>
}
export interface WorkspaceEditorProps extends EditorActions { target: EditTarget; onClose: () => void; t: Translate }

const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) || path

export function WorkspaceAddirModal({ target, onClose, rename, removeWorkspace, pick, t }: WorkspaceEditorProps) {
  const [title, setTitle] = useState(target.displayTitle)
  const [directories, setDirectories] = useState<ClientLinkedDirectory[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoaded(false)
    setError(null)
    fetchWorkspaceDirectories(target.path, controller.signal).then(rows => {
      if (!controller.signal.aborted) { setDirectories(rows); setLoaded(true); setLoading(false) }
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : String(reason))
        setLoading(false)
      }
    })
    return () => controller.abort()
  }, [target.path, reload])

  const close = () => { if (!busy && !picking) onClose() }
  const report = (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))
  const add = async () => {
    setPicking(true)
    setError(null)
    try {
      const path = await pick()
      if (path === null) return
      if ([target.path, ...directories.map(row => row.path)].includes(path)) {
        setError(t('duplicate'))
        return
      }
      setDirectories([...directories, { path, alias: '', readOnly: false }])
    } catch (reason) { report(reason) }
    finally { setPicking(false) }
  }
  const save = async () => {
    setBusy(true)
    setError(null)
    let renamed = false
    try {
      if (title.trim() !== target.displayTitle) { await rename(target.workspaceId, title.trim()); renamed = true }
      await replaceWorkspaceDirectories(target.path, directories)
      onClose()
    } catch (reason) {
      if (renamed) {
        try { await rename(target.workspaceId, target.displayTitle) }
        catch (restoreError) { report(restoreError); return }
      }
      report(reason)
    } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    setError(null)
    try { await removeWorkspace(target.workspaceId); onClose() }
    catch (reason) { report(reason) }
    finally { setBusy(false) }
  }

  return (
    <Modal open title={t('title')} closeLabel={t('close')} onClose={close} className="addir-modal"
      contentClassName="addir-modal-content" footer={<>
        <Button variant="ghost" className="addir-danger" disabled={busy || picking || loading} onClick={() => setConfirmRemove(true)}>{t('unlink')}</Button>
        <span className="addir-footer-spacer" />
        <Button variant="ghost" disabled={busy || picking} onClick={close}>{t('cancel')}</Button>
        <Button variant="primary" className="addir-save" disabled={busy || picking || !loaded || confirmRemove || !title.trim()} onClick={() => { void save() }}>
          {busy && <StateDot state="ongoing" />}{t('save')}
        </Button>
      </>}>
      <div className="addir-editor">
        <Input className="addir-name" icon={<IconFolderCloseRegular size={20} />} value={title} disabled={busy || picking}
          data-modal-autofocus aria-label={t('name')} onChange={event => setTitle(event.target.value)} />
        {confirmRemove ? <div className="addir-confirm">
          <p>{t('unlinkNote')}</p>
          <div className="addir-confirm-actions"><Button variant="ghost" disabled={busy || picking} onClick={() => setConfirmRemove(false)}>{t('cancel')}</Button>
            <Button variant="outline" className="addir-danger" disabled={busy || picking} onClick={() => { void remove() }}>{t('confirmUnlink')}</Button></div>
        </div> : <div className="addir-source">
          <h3 className="addir-heading">{t('folders')}</h3>
          {loading ? <span className="addir-status" role="status"><StateDot state="ongoing" />{t('loading')}</span>
            : !loaded ? <Button variant="outline" onClick={() => setReload(value => value + 1)}>{t('retry')}</Button>
            : <div className="addir-folder-list">
              <div className="addir-folder">
                <IconFolderCloseRegular size={20} />
                <div className="addir-folder-info"><span className="addir-folder-name">{folderName(target.path)}</span>
                  <span className="addir-folder-path" title={target.path}>{target.path}</span></div>
                <span className="addir-primary">{t('primary')}</span>
              </div>
              {directories.map((directory, index) => <div className="addir-folder" key={directory.path}>
                <IconFolderCloseRegular size={20} />
                <div className="addir-folder-info"><span className="addir-folder-name">{directory.alias || folderName(directory.path)}</span>
                  <span className="addir-folder-path" title={directory.path}>{directory.path}</span></div>
                <div className="addir-folder-actions">
                  <label className="addir-check"><input type="checkbox" checked={directory.readOnly} disabled={busy || picking}
                    onChange={event => setDirectories(rows => rows.map((row, i) => i === index ? { ...row, readOnly: event.target.checked } : row))} />{t('readOnly')}</label>
                  <Tooltip label={t('remove')}><Button variant="ghost" aria-label={`${t('remove')}: ${directory.alias || directory.path}`} disabled={busy || picking}
                    onClick={() => setDirectories(rows => rows.filter((_, i) => i !== index))}><IconCloseOutlineRegular /></Button></Tooltip>
                </div>
              </div>)}
              <button type="button" className="addir-add" disabled={busy || picking} onClick={() => { void add() }}>
                {picking ? <StateDot state="ongoing" /> : <IconProjectAddOutlineRegular size={20} />}{t('add')}
              </button>
            </div>}
        </div>}
        {error !== null && <div className="addir-error" role="alert">{error}</div>}
      </div>
    </Modal>
  )
}
