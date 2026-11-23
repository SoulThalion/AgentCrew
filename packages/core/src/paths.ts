import path from 'node:path';
import { safeId } from './ids.js';

export function defaultStateDir(home = process.env.USERPROFILE || process.env.HOME || ''): string {
  return path.join(home, '.cursor', 'hooks', 'state');
}

export function fileEstado(stateDir: string, id: string): string {
  return path.join(stateDir, `estado-${safeId(id)}.txt`);
}

export function fileModo(stateDir: string, id: string): string {
  return path.join(stateDir, `modo-${safeId(id)}.txt`);
}

export function fileRun(stateDir: string, id: string): string {
  return path.join(stateDir, `run-${safeId(id)}.txt`);
}

export function filePrompt(stateDir: string, id: string): string {
  return path.join(stateDir, `prompt-${safeId(id)}.txt`);
}

export function fileFrase(stateDir: string, id: string): string {
  return path.join(stateDir, `frase-${safeId(id)}.txt`);
}

export function fileTitulo(stateDir: string, id: string): string {
  return path.join(stateDir, `titulo-${safeId(id)}.txt`);
}

export function fileVisto(stateDir: string, id: string): string {
  return path.join(stateDir, `visto-${safeId(id)}.txt`);
}

export function fileUltima(stateDir: string, id: string): string {
  return path.join(stateDir, `ultima-${safeId(id)}.txt`);
}

export function fileAprobacion(stateDir: string, id: string): string {
  return path.join(stateDir, `aprobacion-${safeId(id)}.txt`);
}

export function fileAprobacionSaid(stateDir: string, id: string): string {
  return path.join(stateDir, `aprobacion-said-${safeId(id)}.txt`);
}

export function fileBusqueda(stateDir: string, id: string): string {
  return path.join(stateDir, `busqueda-${safeId(id)}.txt`);
}

export function fileShell(stateDir: string, id: string): string {
  return path.join(stateDir, `shell-${safeId(id)}.txt`);
}

/** stop/error espurio → confirmar ~6 s (legado “error seguido”). */
export function fileErrorPending(stateDir: string, id: string): string {
  return path.join(stateDir, `error-pending-${safeId(id)}.txt`);
}

export function prefixSubagentes(id: string): string {
  return `sub-${safeId(id)}-`;
}

export function fileSubagente(stateDir: string, id: string, toolId: string): string {
  return path.join(stateDir, `${prefixSubagentes(id)}${safeId(toolId)}.txt`);
}
