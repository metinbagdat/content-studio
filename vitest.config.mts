import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'apps/web/**', 'legacy/**'],
  },
  resolve: {
    alias: {
      '@/lib': path.resolve(root, 'lib'),
      '@/': `${path.resolve(root)}/`,
      '@content-studio/db': path.resolve(root, 'packages/db/src/index.ts'),
      '@content-studio/core': path.resolve(root, 'packages/core/src'),
    },
  },
})
