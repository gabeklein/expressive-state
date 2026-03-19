import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const examplesDir = resolve(__dirname, 'examples');

function loadExamples() {
  const examples: Record<string, Record<string, string>> = {};

  for (const dir of readdirSync(examplesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;

    const dirPath = resolve(examplesDir, dir.name);
    const files: Record<string, string> = {};

    for (const file of readdirSync(dirPath)) {
      files[`/${file}`] = readFileSync(resolve(dirPath, file), 'utf-8');
    }

    examples[dir.name] = files;
  }

  return examples;
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'examples-manifest',
      resolveId(id) {
        if (id === 'virtual:examples') return '\0virtual:examples';
      },
      load(id) {
        if (id !== '\0virtual:examples') return;

        return `export default ${JSON.stringify(loadExamples(), null, 2)};`;
      }
    }
  ]
});
