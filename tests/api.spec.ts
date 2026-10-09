import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import { WorkspaceDirectoriesServiceImpl } from '../src/service.ts'
import { AddirStorage } from '../src/storage.ts'
import { resolveConfig } from '../src/config.ts'
import { registerAddirRoutes } from '../src/api.ts'

describe('Addir REST API', () => {
  const testRoot = join(tmpdir(), `dsh-api-test-${Date.now()}`)
  mkdirSync(testRoot, { recursive: true })
  const mainDir = join(testRoot, 'main')
  const extDir = join(testRoot, 'external')
  mkdirSync(mainDir, { recursive: true })
  mkdirSync(extDir, { recursive: true })

  it('registers /api/addir routes and processes list, add, remove', async () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    const memStorage = new AddirStorage(':memory:')
    const service = new WorkspaceDirectoriesServiceImpl(resolveConfig(), mainDir, memStorage)

    let registeredRoute: any = null
    const disposed = vi.fn()
    const registration = registerAddirRoutes(ctx, service)
    expect(registeredRoute).toBeNull()
    ctx.provide('webServer', {
      register: (route: any) => {
        registeredRoute = route
        return disposed
      },
    })

    await registration.await()

    expect(registeredRoute).toBeDefined()
    expect(registeredRoute.path).toBe('/api/addir')

    // Helper to simulate HTTP requests
    const simulateRequest = async (urlPath: string, method: string, body?: any) => {
      let statusCode = 0
      let responseData = ''
      const res: any = {
        writeHead: (code: number) => {
          statusCode = code
        },
        end: (data?: string) => {
          if (data) responseData = data
        },
      }

      const req: any = {
        url: urlPath,
        method,
        on: (event: string, cb: any) => {
          if (event === 'data' && body) {
            cb(Buffer.from(JSON.stringify(body)))
          }
          if (event === 'end') {
            cb()
          }
        },
      }

      await registeredRoute.handler(req, res)
      return { status: statusCode, body: responseData ? JSON.parse(responseData) : null }
    }

    // 1. List initial
    const listRes = await simulateRequest('/api/addir/list', 'GET')
    expect(listRes.status).toBe(200)
    expect(listRes.body.ok).toBe(true)
    expect(listRes.body.directories.length).toBe(1)

    // 2. Add external directory
    const addRes = await simulateRequest('/api/addir/add', 'POST', {
      workspacePath: mainDir,
      path: extDir,
      alias: 'ext',
      readOnly: true,
    })
    expect(addRes.status).toBe(200)
    expect(addRes.body.ok).toBe(true)
    expect(addRes.body.entry.alias).toBe('ext')
    expect(addRes.body.entry.readOnly).toBe(true)

    // 3. List again for specific workspace
    const listWorkspaceRes = await simulateRequest('/api/addir/list', 'POST', {
      workspacePath: mainDir,
    })
    expect(listWorkspaceRes.status).toBe(200)
    expect(listWorkspaceRes.body.directories.length).toBe(1)
    expect(listWorkspaceRes.body.directories[0].alias).toBe('ext')

    // 4. Remove external directory
    const removeRes = await simulateRequest('/api/addir/remove', 'POST', {
      workspacePath: mainDir,
      pathOrAlias: 'ext',
    })
    expect(removeRes.status).toBe(200)
    expect(removeRes.body.ok).toBe(true)
    expect(removeRes.body.removed).toBe(true)

    // 5. Validate directory
    const validateRes = await simulateRequest('/api/addir/validate', 'POST', {
      path: extDir,
    })
    expect(validateRes.status).toBe(200)
    expect(validateRes.body.exists).toBe(true)
    expect(validateRes.body.isDirectory).toBe(true)

    const replaceRes = await simulateRequest('/api/addir/replace', 'POST', {
      workspacePath: mainDir, directories: [{ path: extDir, alias: 'saved', readOnly: true }],
    })
    expect(replaceRes.status).toBe(200)
    expect(service.getDirectoriesForWorkspace(mainDir)[0]?.alias).toBe('saved')
    for (const directories of [[{ path: extDir, readOnly: 'yes' }], [{ path: 'missing', readOnly: false }]]) {
      const result = await simulateRequest('/api/addir/replace', 'POST', { workspacePath: mainDir, directories })
      expect(result.status).toBe(400)
      expect(service.getDirectoriesForWorkspace(mainDir)[0]?.alias).toBe('saved')
    }
    expect((await simulateRequest('/api/addir/replace', 'GET')).status).toBe(405)
    const switches = { enableTools: false, enableContextInjection: true, enforceReadOnly: false }
    expect((await simulateRequest('/api/addir/config', 'GET')).body.config.enableTools).toBe(true)
    expect((await simulateRequest('/api/addir/config', 'POST', switches)).status).toBe(409)
    expect((await simulateRequest('/api/addir/config', 'POST', { enableTools: 'yes' })).status).toBe(400)
    const current = { defaultDirectories: [{ path: extDir }], enableTools: true }
    let updated: Record<string, unknown> | undefined
    ctx.provide('configEditor', {
      entries: () => [{ options: { name: 'dsh-plugin-addir' } }],
      edit: async (_entry: object, patch: (config: typeof current) => Record<string, unknown>) => { updated = patch(current) },
    })
    expect((await simulateRequest('/api/addir/config', 'POST', switches)).status).toBe(200)
    expect(updated).toEqual({ ...current, ...switches })
    await registration.dispose()
    expect(disposed).toHaveBeenCalledOnce()
  })
})
