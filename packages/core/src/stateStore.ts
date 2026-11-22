import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  fileAprobacion,
  fileBusqueda,
  fileEstado,
  fileFrase,
  fileModo,
  filePrompt,
  fileRun,
  fileShell,
  fileSubagente,
  fileTitulo,
  fileUltima,
  prefixSubagentes,
} from './paths.js';
import { writeAtomic, readText, removeFile } from './atomicWrite.js';
import { safeId } from './ids.js';
import {
  type AgentState,
  type ComposerMode,
  isAgentState,
  parseComposerMode,
} from './states.js';

const PROMPT_MAX = 180;

export function ensureStateDir(stateDir: string): void {
  fs.mkdirSync(stateDir, { recursive: true });
}

export function parseEstadoLine(raw: string): { state: string; at: Date | null } {
  const parts = raw.trim().split('|');
  const state = parts[0] ?? '';
  let at: Date | null = null;
  if (parts.length > 1 && parts[1]) {
    const d = new Date(parts[1]);
    if (!Number.isNaN(d.getTime())) at = d;
  }
  return { state, at };
}

export function writeEstado(
  stateDir: string,
  id: string,
  state: AgentState,
  at: Date = new Date(),
): void {
  if (!id.trim()) return;
  ensureStateDir(stateDir);
  const ruta = fileEstado(stateDir, id);
  if ((state === 'terminado' || state === 'error') && fs.existsSync(ruta)) {
    const cur = parseEstadoLine(readText(ruta) ?? '');
    if (cur.state === state) return;
  }
  writeAtomic(ruta, `${state}|${at.toISOString()}`, 'utf8');
}

export function readEstado(
  stateDir: string,
  id: string,
): { state: string; at: Date | null } | null {
  const raw = readText(fileEstado(stateDir, id));
  if (raw == null) return null;
  return parseEstadoLine(raw);
}

export function writeModo(stateDir: string, id: string, modo: ComposerMode): void {
  ensureStateDir(stateDir);
  writeAtomic(fileModo(stateDir, id), modo, 'utf8');
}

export function readModo(stateDir: string, id: string): ComposerMode | null {
  const raw = readText(fileModo(stateDir, id));
  if (raw == null) return null;
  return parseComposerMode(raw);
}

export function markRun(stateDir: string, id: string, at: Date = new Date()): void {
  ensureStateDir(stateDir);
  writeAtomic(fileRun(stateDir, id), at.toISOString(), 'utf8');
}

export function clearRun(stateDir: string, id: string): void {
  removeFile(fileRun(stateDir, id));
}

export function hasRun(stateDir: string, id: string): boolean {
  return fs.existsSync(fileRun(stateDir, id));
}

export function writePrompt(stateDir: string, id: string, prompt: string): void {
  ensureStateDir(stateDir);
  let texto = prompt ?? '';
  if (texto.length > PROMPT_MAX) texto = texto.slice(0, PROMPT_MAX);
  writeAtomic(filePrompt(stateDir, id), texto, 'utf8');
}

export function writeFrase(stateDir: string, id: string, frase: string): void {
  ensureStateDir(stateDir);
  writeAtomic(fileFrase(stateDir, id), frase, 'utf8');
}

export function readFrase(stateDir: string, id: string): string {
  return readText(fileFrase(stateDir, id)) ?? '';
}

export function writeTitulo(stateDir: string, id: string, titulo: string): void {
  if (!id.trim() || !titulo.trim()) return;
  ensureStateDir(stateDir);
  const ruta = fileTitulo(stateDir, id);
  const prev = readText(ruta) ?? '';
  if (prev !== titulo.trim()) {
    writeAtomic(ruta, titulo.trim(), 'utf8');
  }
}

export function readTitulo(stateDir: string, id: string): string {
  return readText(fileTitulo(stateDir, id)) ?? '';
}

/**
 * Título para UI (paridad Titulo-De-Chat legacy).
 * Preferencia: titulo aprendido → prompt → "Chat {id8}".
 * Nunca devolver solo el UUID crudo.
 */
export function displayTitle(stateDir: string, id: string): string {
  const learned = readTitulo(stateDir, id).trim();
  if (learned) return learned;

  let prompt = (readText(filePrompt(stateDir, id)) ?? '').trim();
  prompt = prompt.replace(/\\[nrt]/gi, ' ').replace(/\s+/g, ' ').trim();
  if (prompt.startsWith('Implement the plan as specified')) {
    prompt = 'Build del plan';
  }
  if (prompt.length > 80) prompt = `${prompt.slice(0, 80)}...`;
  if (prompt) return prompt;

  const short = id.slice(0, Math.min(8, id.length));
  return short ? `Chat ${short}` : 'Chat';
}

export function writeUltima(stateDir: string, id: string, marca: 'cierre' | 'pregunta'): void {
  ensureStateDir(stateDir);
  writeAtomic(fileUltima(stateDir, id), marca, 'utf8');
}

export function markAprobacion(stateDir: string, id: string): void {
  ensureStateDir(stateDir);
  writeAtomic(fileAprobacion(stateDir, id), '1', 'utf8');
}

export function clearAprobacion(stateDir: string, id: string): void {
  removeFile(fileAprobacion(stateDir, id));
}

export function markBusqueda(stateDir: string, id: string): void {
  ensureStateDir(stateDir);
  writeAtomic(fileBusqueda(stateDir, id), '1', 'utf8');
}

export function clearBusqueda(stateDir: string, id: string): void {
  removeFile(fileBusqueda(stateDir, id));
}

export function markShell(stateDir: string, id: string, at: Date = new Date()): void {
  ensureStateDir(stateDir);
  writeAtomic(fileShell(stateDir, id), at.toISOString(), 'utf8');
}

export function clearShell(stateDir: string, id: string): void {
  removeFile(fileShell(stateDir, id));
}

export function markSubagente(stateDir: string, id: string, toolId?: string): void {
  ensureStateDir(stateDir);
  const tid = toolId?.trim() ? toolId : randomBytes(16).toString('hex');
  writeAtomic(fileSubagente(stateDir, id, tid), '1', 'utf8');
  writeEstado(stateDir, id, 'subagentes');
}

export function countSubagentes(stateDir: string, id: string): number {
  const prefix = prefixSubagentes(id);
  if (!fs.existsSync(stateDir)) return 0;
  return fs
    .readdirSync(stateDir)
    .filter((n) => n.startsWith(prefix) && n.endsWith('.txt') && !n.includes('.tmp'))
    .length;
}

export function clearSubagentes(stateDir: string, id: string): void {
  const prefix = prefixSubagentes(id);
  if (!fs.existsSync(stateDir)) return;
  for (const n of fs.readdirSync(stateDir)) {
    if (n.startsWith(prefix) && n.endsWith('.txt')) {
      removeFile(path.join(stateDir, n));
    }
  }
}

/** Si hay run y estado vacío/cerrado → seguir trabajando/planificando. */
export function resolveActiveState(
  stateDir: string,
  id: string,
  valor: string,
): string {
  if (!hasRun(stateDir, id)) {
    // stop limpió run pero status raro dejó "trabajando" → UI idle = detenido
    if (
      valor === 'trabajando' ||
      valor === 'planificando' ||
      valor === 'leyendo' ||
      valor === 'subagentes'
    ) {
      const ultima = readText(fileUltima(stateDir, id));
      if (ultima === 'cierre') return 'detenido';
    }
    return valor;
  }
  if (valor && !['terminado', 'error', 'detenido'].includes(valor)) return valor;
  const modo = readModo(stateDir, id);
  if (modo === 'plan') return 'planificando';
  return 'trabajando';
}

export function assertState(value: string): AgentState {
  if (!isAgentState(value)) {
    throw new Error(`Estado inválido: ${value}`);
  }
  return value;
}

export { safeId, isAgentState };
