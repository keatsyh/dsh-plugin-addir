/** Copy owned by the Addir client. */
export const en = {
  workspaceEditors: 'Workspaces', edit: 'Edit', title: 'Edit project', name: 'Project name', folders: 'Source folders',
  add: 'Add folder', path: 'Folder path', alias: 'Alias (optional)', readOnly: 'Read only',
  browse: 'Browse…', select: 'Select this folder', up: 'Parent folder', remove: 'Remove folder',
  primary: 'Primary folder', cancel: 'Cancel', save: 'Save', close: 'Close', loading: 'Loading…',
  unlink: 'Remove local project', confirmUnlink: 'Remove project', unlinkNote: 'Remove this workspace from the sidebar? Files and conversations are kept.',
  duplicate: 'This folder is already in the project', nameRequired: 'Enter a project name', pathRequired: 'Enter a folder path',
  globalTitle: 'Linked directories', globalNote: 'Global plugin behavior. Manage each project’s folders from its workspace menu → Edit.',
  tools: 'Agent directory tools', toolsNote: 'Allow the agent to list, add and remove associated directories.',
  context: 'Directory context', contextNote: 'Include associated directories in the agent’s context.',
  guard: 'Read-only protection', guardNote: 'Enforce the read-only flags on associated directories.',
  saved: 'Settings saved', retry: 'Retry',
}
export type CopyKey = keyof typeof en
export type Translate = (key: CopyKey) => string
export const zh: Record<CopyKey, string> = {
  workspaceEditors: '工作区', edit: '编辑', title: '编辑项目', name: '项目名称', folders: '源文件夹',
  add: '添加文件夹', path: '文件夹路径', alias: '别名（选填）', readOnly: '只读',
  browse: '浏览…', select: '选择此文件夹', up: '上级目录', remove: '移除文件夹',
  primary: '主文件夹', cancel: '取消', save: '保存', close: '关闭', loading: '加载中…',
  unlink: '移除本地项目', confirmUnlink: '确认移除', unlinkNote: '从侧边栏移除此工作区？本地文件和会话都会保留',
  duplicate: '此文件夹已在项目中', nameRequired: '请输入项目名称', pathRequired: '请输入文件夹路径',
  globalTitle: '关联目录', globalNote: '管理插件的全局行为。各项目的文件夹请从工作区三点菜单中的“编辑”管理',
  tools: '智能体目录工具', toolsNote: '允许智能体查看、添加和移除关联目录',
  context: '目录上下文', contextNote: '让智能体感知当前工作区的关联目录',
  guard: '只读保护', guardNote: '对标记为只读的关联目录启用写入保护',
  saved: '设置已保存', retry: '重试',
}
