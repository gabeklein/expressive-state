import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  entry: {
    index: 'src/index.ts'
  },
  format: ['cjs']
});
