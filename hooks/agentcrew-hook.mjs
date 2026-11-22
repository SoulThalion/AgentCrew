#!/usr/bin/env node
/**
 * Entry Cursor hooks.json.
 * Dev: resuelve packages/hooks/dist.
 * Instalado: cli.js junto a este archivo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function findHandleEvent() {
  const candidates = [
    path.join(here, '..', 'packages', 'hooks', 'dist', 'handleEvent.js'),
    path.join(here, 'handleEvent.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findCore() {
  const candidates = [
    path.join(here, '..', 'packages', 'core', 'dist', 'index.js'),
    path.join(here, 'core-index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function parseEvento(argv) {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--evento' || argv[i] === '-e') && argv[i + 1]) return argv[i + 1];
  }
  return '';
}

async function main() {
  const he = findHandleEvent();
  const core = findCore();
  if (!he || !core) {
    process.stdout.write('{}');
    return;
  }
  const { handleEvent } = await import(pathToFileURL(he).href);
  const { defaultStateDir } = await import(pathToFileURL(core).href);
  const evento = parseEvento(process.argv.slice(2));
  if (!evento) {
    process.stdout.write('{}');
    return;
  }
  const stateDir = process.env.AGENTCREW_STATE_DIR || defaultStateDir();
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    raw = '';
  }
  const result = handleEvent(evento, raw, stateDir);
  process.stdout.write(result.stdout || '{}');
}

main().catch(() => {
  process.stdout.write('{}');
});
