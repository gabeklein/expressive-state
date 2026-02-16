import { defineConfig, mergeConfig } from 'vitest/config';
import { resolve } from 'path';

export const rootConfig = defineConfig({
  test: {
    setupFiles: [resolve(__dirname, 'vitest.setup.ts')],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/index.ts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
      }
    }
  },
  resolve: {
    alias: [
      {
        find: /^@expressive\/([^/]+)(\/.+)?$/,
        replacement: resolve(__dirname, 'packages') + '/$1/src$2'
      }
    ]
  }
});

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      projects: ['packages/state', 'packages/react', 'packages/preact']
    }
  })
);
