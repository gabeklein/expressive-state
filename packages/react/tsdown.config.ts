import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    external: ['./state', './jsx-runtime'],
    outExtensions: () => ({ js: '.js' }),
    entry: {
      index: 'src/index.ts',
      state: 'src/state.ts',
      'jsx-runtime': 'src/jsx-runtime.ts',
      'jsx-dev-runtime': 'src/jsx-dev-runtime.ts'
    },
    format: ['cjs'],
    outputOptions: {
      exports: 'named'
    }
  },
  {
    sourcemap: true,
    unbundle: true,
    outDir: 'dist/esm',
    external: ['./state', './jsx-runtime'],
    dts: false,
    outExtensions: () => ({ js: '.js' }),
    format: ['esm'],
    entry: {
      index: 'src/index.ts',
      state: 'src/state.ts',
      'jsx-runtime': 'src/jsx-runtime.ts',
      'jsx-dev-runtime': 'src/jsx-dev-runtime.ts'
    },
    outputOptions: {
      exports: 'named'
    }
  }
]);
