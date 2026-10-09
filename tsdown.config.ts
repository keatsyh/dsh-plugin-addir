import { defineConfig } from 'tsdown'

const clientExternals = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-primitives',
])

export default defineConfig([
  {
    name: 'dsh-plugin-addir-host',
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    fixedExtension: false,
    dts: true,
    sourcemap: true,
    clean: true,
    deps: {
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-agent',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-session',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/schemastery',
      ],
    },
  },
  {
    name: 'dsh-plugin-addir-client',
    entry: {
      client: 'src/client/index.tsx',
    },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: (specifier) => clientExternals.has(specifier),
      alwaysBundle: (specifier) => !clientExternals.has(specifier),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      exports: 'named',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-plugin-addir", factory: (require) => {',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
