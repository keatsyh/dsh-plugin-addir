import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    setupFiles: ['./tests/setup.ts'],
    // DSH client packages ship CSS Modules; Vite must process them rather than
    // handing the imports to Node's loader.
    server: { deps: { inline: [/@deepseek-ai\//] } },
  },
})
