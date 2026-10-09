/** Verify the built client registers lazily and resolves DSH's shared React modules. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import * as Cordis from '@deepseek-ai/cordis'
import * as Store from '@deepseek-ai/dsh-client-store'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const registrations = []
runInNewContext(source, {
  window: { __ModuleLoader__: { load: registration => registrations.push(registration) } },
}, { filename: 'client.js' })

assert.equal(registrations.length, 1)
const [{ id, factory }] = registrations
assert.equal(id, 'dsh-plugin-addir')
assert.equal(typeof factory, 'function')

const sharedModules = new Map([
  ['react', React],
  ['react/jsx-runtime', ReactJsxRuntime],
  ['react-dom', ReactDom],
  ['react-dom/client', ReactDomClient],
  ['@deepseek-ai/cordis', Cordis],
  ['@deepseek-ai/dsh-client-store', Store],
  ['@deepseek-ai/dsh-client-ui-primitives', {}],
])
const requests = new Set()
const exports = factory(specifier => {
  assert.ok(sharedModules.has(specifier), `Unshared client dependency: ${specifier}`)
  requests.add(specifier)
  return sharedModules.get(specifier)
})
assert.equal(typeof exports.apply, 'function')
assert.ok(Array.from(exports.inject).includes('slots'))
assert.ok(requests.has('react'))
assert.ok(requests.has('react/jsx-runtime'))
assert.ok(requests.has('@deepseek-ai/dsh-client-ui-primitives'))
console.log('Client bundle registers and materializes with DSH shared modules.')
