#!/usr/bin/env node
/**
 * Instala watcher Cursor→panel:
 * - copia agentcrew-cursor-watch.mjs + panel-launch.json a ~/.cursor/hooks
 * - atajo Startup (Windows) para arrancar el watcher al login
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = process.env.USERPROFILE || process.env.HOME || '';
const hooksDir = path.join(home, '.cursor', 'hooks');
const stateDir = path.join(hooksDir, 'state');
const watchSrc = path.join(root, 'scripts', 'cursor-watch.mjs');
const watchDst = path.join(hooksDir, 'agentcrew-cursor-watch.mjs');
const launchDst = path.join(hooksDir, 'panel-launch.json');

function resolveLaunch(repoRoot) {
  const unpacked = path.join(
    repoRoot,
    'apps',
    'panel',
    'release',
    'win-unpacked',
    'AgentCrew.exe',
  );
  if (fs.existsSync(unpacked)) {
    return {
      command: unpacked,
      args: [],
      cwd: path.dirname(unpacked),
    };
  }
  const electron = path.join(
    repoRoot,
    'node_modules',
    'electron',
    'dist',
    'electron.exe',
  );
  const cwd = path.join(repoRoot, 'apps', 'panel');
  const mainJs = path.join(cwd, 'dist-electron', 'main.js');
  if (fs.existsSync(electron) && fs.existsSync(mainJs)) {
    return { command: electron, args: ['.'], cwd };
  }
  // cleanbuild sibling (dev habitual)
  const clean = path.join(path.dirname(repoRoot), 'AgentCrew-cleanbuild');
  if (clean !== repoRoot && fs.existsSync(clean)) {
    return resolveLaunch(clean);
  }
  return null;
}

fs.mkdirSync(stateDir, { recursive: true });
fs.copyFileSync(watchSrc, watchDst);

const launch = resolveLaunch(root);
if (!launch) {
  console.warn(
    'No se resolvió cómo lanzar el panel (falta dist-electron o AgentCrew.exe).',
  );
  console.warn('Tras `npm run build -w @agentcrew/panel`, re-ejecuta install-cursor-watch.');
} else {
  fs.writeFileSync(launchDst, JSON.stringify(launch, null, 2), 'utf8');
  console.log('panel-launch.json →', launch.command);
}

// Quitar disable si reinstalamos a propósito
const off = path.join(stateDir, 'watch-off.txt');
if (fs.existsSync(off)) {
  console.log('Nota: existe state/watch-off.txt → watcher no arrancará panel hasta borrarlo.');
}

if (process.platform === 'win32') {
  const startupDir = path.join(
    home,
    'AppData',
    'Roaming',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
  );
  fs.mkdirSync(startupDir, { recursive: true });
  const vbs = path.join(startupDir, 'AgentCrew-CursorWatch.vbs');
  const node = process.execPath;
  const script = watchDst;
  const vbsBody = [
    "' AgentCrew: arranca watcher Cursor↔panel (oculto)",
    'Set sh = CreateObject("WScript.Shell")',
    `sh.Run """${node}"" ""${script}""", 0, False`,
    '',
  ].join('\r\n');
  fs.writeFileSync(vbs, vbsBody, 'utf8');
  console.log('Startup →', vbs);
} else {
  console.log(
    'macOS/Linux: añade al login:',
    `node "${watchDst}"`,
  );
}

// Arrancar watcher ahora (si no hay otro)
try {
  const child = spawn(process.execPath, [watchDst], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  console.log('Watcher lanzado pid=', child.pid);
} catch (e) {
  console.warn('No se pudo lanzar watcher ahora:', e.message);
}

console.log('Listo. Abre Cursor → debe levantarse el panel. Cierra Cursor → panel sale ~10s.');
console.log('Desactivar: crea', path.join(stateDir, 'watch-off.txt'));
console.log('Quitar Startup: borra AgentCrew-CursorWatch.vbs del folder Startup.');
