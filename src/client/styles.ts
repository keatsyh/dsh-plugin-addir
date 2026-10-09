/** Project dialogs and global settings use the host's light and dark theme tokens. */
export const styles = `
.addir-modal { width: min(560px, 100%); max-height: 100%; gap: 24px; }
.addir-modal-content { min-height: 0; overflow-y: auto; }
.addir-modal-content h2 { font-size: 20px; line-height: 28px; }
.addir-editor *, .addir-settings * { box-sizing: border-box; }
.addir-editor { display: flex; flex-direction: column; gap: 24px; color: var(--dsw-alias-label-primary); }
.addir-name { width: 100%; height: 44px; padding: 0 12px; gap: 12px; border-width: 1px; }
.addir-name:focus-within { box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary); }
.addir-name > span { flex: none; width: 20px; color: var(--dsw-alias-label-secondary); }
.addir-name input { font-size: 16px; }
.addir-source { display: flex; flex-direction: column; gap: 12px; }
.addir-heading { margin: 0; font-size: 14px; font-weight: 500; line-height: 22px; }
.addir-folder-list { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-lg); overflow: hidden; }
.addir-folder { display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 14px 16px; }
.addir-folder > svg { flex: none; color: var(--dsw-alias-label-secondary); }
.addir-folder + .addir-folder { border-top: 0.5px solid var(--dsw-alias-border-l3); }
.addir-folder-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.addir-folder-name { font-size: 14px; line-height: 22px; }
.addir-folder-path { color: var(--dsw-alias-label-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.addir-primary { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.addir-folder-actions { display: flex; align-items: center; gap: 8px; }
.addir-check { display: flex; flex-direction: row; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.addir-check input, .addir-setting input { accent-color: var(--dsw-alias-state-business-primary); }
.addir-add { box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 14px 16px; border: 0; border-top: 0.5px solid var(--dsw-alias-border-l3); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.addir-add > svg { color: var(--dsw-alias-label-secondary); }
.addir-add:hover { background: var(--dsw-alias-interactive-bg-hover); }
.addir-add:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset: -3px; }
.addir-footer-spacer { flex: 1; }
.addir-danger { color: var(--dsw-alias-state-error-primary) !important; background: var(--dsw-alias-interactive-bg-hover-danger) !important; }
.addir-save { min-width: 72px; }
.addir-confirm p { font-size: 14px; line-height: 22px; margin: 0; }
.addir-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.addir-status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.addir-error { color: var(--dsw-alias-state-error-primary); font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.addir-settings { display: flex; flex-direction: column; gap: 24px; max-width: 720px; color: var(--dsw-alias-label-primary); }
.addir-settings h2 { font-size: 20px; font-weight: 500; margin: 0; }
.addir-settings p { color: var(--dsw-alias-label-secondary); margin: 0; font-size: 13px; line-height: 1.6; }
.addir-setting { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 16px 0; border-bottom: 0.5px solid var(--dsw-alias-border-l3); }
.addir-setting label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
@media (max-width: 520px) {
  .addir-folder { flex-wrap: wrap; }
  .addir-folder-actions { margin-left: 32px; }
  .addir-primary { display: none; }
  .addir-danger { padding: 0 10px; font-size: 12px; }
}
`
