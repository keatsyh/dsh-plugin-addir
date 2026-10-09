/** Same-origin HTTP requests; reject HTTP and non-JSON failures before reading results. */
export interface ClientLinkedDirectory {
  path: string
  alias: string
  description?: string | undefined
  readOnly: boolean
  addedAt?: number
  source?: 'primary' | 'config' | 'dynamic'
}
export interface GlobalConfig {
  enableTools: boolean
  enableContextInjection: boolean
  enforceReadOnly: boolean
}
async function request<T>(action: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(new URL(`api/addir/${action}`, document.baseURI), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`Addir API: HTTP ${response.status}`)
  }
  const result = await response.json() as T & { ok?: boolean; error?: string }
  if (!response.ok || result.ok === false) throw new Error(result.error || `HTTP ${response.status}`)
  return result
}
export async function fetchWorkspaceDirectories(workspacePath: string, signal?: AbortSignal): Promise<ClientLinkedDirectory[]> {
  return (await request<{ directories: ClientLinkedDirectory[] }>('list', { workspacePath }, signal)).directories
}
export async function replaceWorkspaceDirectories(workspacePath: string, directories: readonly ClientLinkedDirectory[]): Promise<void> {
  await request('replace', { workspacePath, directories })
}
export async function fetchGlobalConfig(signal?: AbortSignal): Promise<GlobalConfig> {
  return (await request<{ config: GlobalConfig }>('config', undefined, signal)).config
}
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  await request('config', config)
}
