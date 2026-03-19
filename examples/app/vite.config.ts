import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const examplesDir = resolve(__dirname, '..');

function getExamples() {
  const entries: Record<string, string> = {};

  for (const dir of readdirSync(examplesDir, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === 'app')
      continue;

    try {
      const pkg = JSON.parse(
        readFileSync(resolve(examplesDir, dir.name, 'package.json'), 'utf-8')
      );

      if (pkg.module)
        entries[dir.name] = resolve(examplesDir, dir.name, pkg.module);
    }
    catch {}
  }

  return entries;
}

const examples = getExamples();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'examples-manifest',
      resolveId(id) {
        if (id === 'virtual:examples')
          return '\0virtual:examples';
      },
      load(id) {
        if (id !== '\0virtual:examples')
          return;

        const imports = Object.entries(examples).map(
          ([name, path], i) => `import E${i} from ${JSON.stringify(path)};`
        );

        const entries = Object.keys(examples).map(
          (name, i) => `  ${JSON.stringify(name)}: E${i}`
        );

        return [
          ...imports,
          `export default {\n${entries.join(',\n')}\n};`
        ].join('\n');
      }
    }
  ]
});
