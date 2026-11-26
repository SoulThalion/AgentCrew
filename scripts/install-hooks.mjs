#!/usr/bin/env node
/**
 * Bundle hooks+core en un solo .mjs e instala en ~/.cursor/hooks.
 * Evita ERR_MODULE_NOT_FOUND de @agentcrew/core fuera del monorepo.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLegacyHookCommand } from './legacy-hooks.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cursor = path.join(process.env.USERPROFILE || process.env.HOME || '', '.cursor');
const hooksDir = path.join(cursor, 'hooks');
const stateDir = path.join(hooksDir, 'state');
const outFile = path.join(hooksDir, 'agentcrew-hook.mjs');

fs.mkdirSync(stateDir, { recursive: true });

const entry = path.join(root, 'packages', 'hooks', 'src', 'cli.ts');

await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: outFile,
  banner: {
    js: '// AgentCrew hook bundle — generado por npm run install-hooks\n',
  },
  logLevel: 'info',
});

const newHooks = JSON.parse(fs.readFileSync(path.join(root, 'hooks.json'), 'utf8'));
const hooksPath = path.join(cursor, 'hooks.json');
let current = { version: 1, hooks: {} };
if (fs.existsSync(hooksPath)) {
  fs.copyFileSync(hooksPath, hooksPath + '.bak');
  current = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
}
if (!current.hooks) current.hooks = {};

for (const [event, entries] of Object.entries(newHooks.hooks || {})) {
  const incoming = Array.isArray(entries) ? entries : [];
  const existing = Array.isArray(current.hooks[event]) ? current.hooks[event] : [];
  // Sustituir agentcrew + legacy PS; no dejar alarma-agente junto al bundle Node
  const filtered = existing.filter((e) => !isLegacyHookCommand(e.command));
  const cmds = new Set(filtered.map((e) => String(e.command || '').trim()));
  const merged = [...filtered];
  for (const e of incoming) {
    const cmd = String(e.command || '').trim();
    if (!cmds.has(cmd)) {
      merged.push(e);
      cmds.add(cmd);
    }
  }
  current.hooks[event] = merged;
}

// Eventos solo-legacy (no en template): limpiar PS / hooks viejos
for (const event of Object.keys(current.hooks)) {
  if (newHooks.hooks?.[event]) continue;
  const kept = (current.hooks[event] || []).filter(
    (e) => !isLegacyHookCommand(e.command),
  );
  if (kept.length === 0) delete current.hooks[event];
  else current.hooks[event] = kept;
}

// subagentStop no debe limpiar: Cursor envía conversation_id del padre
if (Array.isArray(current.hooks.subagentStop)) {
  current.hooks.subagentStop = current.hooks.subagentStop.filter(
    (e) => !String(e.command || '').includes('agentcrew-hook'),
  );
  if (current.hooks.subagentStop.length === 0) delete current.hooks.subagentStop;
}

fs.writeFileSync(hooksPath, JSON.stringify(current, null, 2), 'utf8');

// Limpieza de dists rotos de la instalación anterior
for (const name of ['agentcrew-hooks-dist', 'agentcrew-core-dist']) {
  const p = path.join(hooksDir, name);
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

console.log('Bundle OK:', outFile);
console.log('hooks.json:', hooksPath);
console.log('Reinicia Cursor y envía un prompt. Debe aparecer estado-*.txt en', stateDir);
