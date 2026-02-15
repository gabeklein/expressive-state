import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    clean: true,
    dts: true,
    entry: ['src/index.ts'],
    format: ['cjs'],
    outDir: 'dist',
    outExtensions: () => ({ js: '.js' }),
    sourcemap: true,
    outputOptions: {
      exports: 'named'
    }
  },
  {
    entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/mocks.ts'],
    format: ['esm'],
    outDir: 'dist/esm',
    outExtensions: () => ({ js: '.js' }),
    sourcemap: 'inline',
    unbundle: true,
    outputOptions: {
      exports: 'named'
    }
  }
]);
