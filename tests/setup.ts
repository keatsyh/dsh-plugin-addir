import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

// Set a dedicated isolated temporary directory for DSH storages in tests
const testDshHome = join(tmpdir(), `dsh-test-home-${Date.now()}-${Math.random().toString(36).slice(2)}`)
mkdirSync(testDshHome, { recursive: true })
process.env.DSH_HOME = testDshHome
