import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(appRoot, '..', '..');

await build({
  entryPoints: [path.join(appRoot, 'src/electron/main.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: path.join(appRoot, 'dist-electron/main.js'),
  alias: {
    '@agentcrew/core': path.join(repoRoot, 'packages/core/src/index.ts'),
    '@agentcrew/tts': path.join(repoRoot, 'packages/tts/src/index.ts'),
  },
  external: [
    'electron',
    'koffi',
    '@agentcrew/dock-windows',
    '@agentcrew/dock-macos',
    '@agentcrew/dock-linux',
  ],
  logLevel: 'info',
});

await build({
  entryPoints: [path.join(appRoot, 'src/electron/preload.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: path.join(appRoot, 'dist-electron/preload.js'),
  external: ['electron'],
  logLevel: 'info',
});
