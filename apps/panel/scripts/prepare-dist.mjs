/**
 * Copia física de docks + koffi a apps/panel/node_modules.
 * Necesario: workspaces npm = symlinks fuera de apps/panel → electron-builder/asar falla.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const panelRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(panelRoot, '..', '..');
const nm = path.join(panelRoot, 'node_modules');
const ac = path.join(nm, '@agentcrew');

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

fs.mkdirSync(ac, { recursive: true });
for (const pkg of ['dock-windows', 'dock-macos', 'dock-linux']) {
  const src = path.join(repoRoot, 'packages', pkg);
  const dest = path.join(ac, pkg);
  if (!fs.existsSync(src)) throw new Error(`Falta ${src}`);
  rimraf(dest);
  copyDir(src, dest);
  // No arrastrar node_modules del package
  rimraf(path.join(dest, 'node_modules'));
  console.log('prepare-dist:', pkg);
}

const koffiSrc = path.join(repoRoot, 'node_modules', 'koffi');
const koffiDest = path.join(nm, 'koffi');
if (!fs.existsSync(koffiSrc)) throw new Error('Falta node_modules/koffi en raíz');
rimraf(koffiDest);
copyDir(koffiSrc, koffiDest);
console.log('prepare-dist: koffi');
