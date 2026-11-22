#!/usr/bin/env node
/**
 * Instalador AgentCrew:
 * - build monorepo
 * - copia voces/ desde legacy si faltan
 * - instala hooks (bundle)
 * - opcional: arranca panel
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyVoces = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  'Downloads',
  'panel-agentes',
  'voces',
);
const destVoces = path.join(root, 'voces');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function copyVoces() {
  fs.mkdirSync(destVoces, { recursive: true });
  const existing = fs.existsSync(destVoces)
    ? fs.readdirSync(destVoces).filter((f) => f.endsWith('.mp3')).length
    : 0;
  if (existing > 0) {
    console.log(`voces/: ya hay ${existing} mp3`);
    return;
  }
  if (!fs.existsSync(legacyVoces)) {
    console.warn('No se encontró legacy voces en', legacyVoces);
    return;
  }
  let n = 0;
  for (const name of fs.readdirSync(legacyVoces)) {
    if (!name.endsWith('.mp3')) continue;
    fs.copyFileSync(path.join(legacyVoces, name), path.join(destVoces, name));
    n++;
  }
  console.log(`voces/: copiados ${n} mp3 desde legacy`);
}

console.log('AgentCrew install…');
run('npm', ['install']);
copyVoces();
run('npm', ['run', 'build']);
run('node', ['scripts/install-hooks.mjs']);
run('node', ['scripts/install-cursor-watch.mjs']);

const startPanel = process.argv.includes('--panel');
if (startPanel) {
  run('npm', ['run', 'start', '-w', '@agentcrew/panel']);
} else {
  console.log('Listo. Reinicia Cursor (o ábrelo): el watcher levantará el panel.');
  console.log('Manual: npm run start -w @agentcrew/panel');
  console.log('O: node installer/install.mjs --panel');
}
