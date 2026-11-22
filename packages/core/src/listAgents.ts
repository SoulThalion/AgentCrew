import fs from 'node:fs';
import path from 'node:path';
import { isAgentState, isActiveStale, priorityOf, type AgentState } from './states.js';
import {
  countSubagentes,
  displayTitle,
  parseEstadoLine,
  readFrase,
  resolveActiveState,
} from './stateStore.js';
import { readText } from './atomicWrite.js';

export type AgentSlot = {
  id: string;
  state: AgentState | string;
  title: string;
  phrase: string;
  order: number;
  subagentCount: number;
  ageMs: number;
};

export type ListAgentsOptions = {
  now?: Date;
  /** Si true, borra estado-*.txt con edad ≥ 24 h (legado). Default false en tests. */
  pruneOlderThan24h?: boolean;
};

function isPlainTxt(name: string): boolean {
  return name.endsWith('.txt') && !name.includes('.tmp');
}

/**
 * Lista agentes visibles en la franja (paridad Leer-Estados legacy).
 */
export function listAgents(stateDir: string, opts: ListAgentsOptions = {}): AgentSlot[] {
  const now = opts.now ?? new Date();
  const prune = opts.pruneOlderThan24h ?? false;
  const lista: AgentSlot[] = [];
  const seen = new Set<string>();

  if (!fs.existsSync(stateDir)) return lista;

  const names = fs.readdirSync(stateDir);

  for (const name of names) {
    if (!name.startsWith('estado-') || !isPlainTxt(name)) continue;
    const id = name.slice('estado-'.length, -'.txt'.length);
    if (!id || id.startsWith('vista-')) continue;

    const full = path.join(stateDir, name);
    let raw: string;
    try {
      raw = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const parsed = parseEstadoLine(raw);
    const valor = resolveActiveState(stateDir, id, parsed.state);
    const when = parsed.at ?? fs.statSync(full).mtime;
    const ageMs = now.getTime() - when.getTime();
    const ageHours = ageMs / 3_600_000;

    if (ageHours >= 24) {
      if (prune) {
        try {
          fs.unlinkSync(full);
        } catch {
          /* ignore */
        }
      }
      continue;
    }

    if (isAgentState(valor) && isActiveStale(valor, ageHours)) {
      // Marcar visto: si no, el loop run-* revive el chat como "trabajando"
      seen.add(id);
      continue;
    }

    let order = 5;
    if (isAgentState(valor)) order = priorityOf(valor);

    let subagentCount = 0;
    if (valor === 'subagentes') {
      subagentCount = countSubagentes(stateDir, id);
      if (subagentCount < 1) subagentCount = 2;
    }

    seen.add(id);
    lista.push({
      id,
      state: valor,
      title: displayTitle(stateDir, id),
      phrase: readFrase(stateDir, id),
      order,
      subagentCount,
      ageMs,
    });
  }

  for (const name of names) {
    if (!name.startsWith('run-') || !isPlainTxt(name)) continue;
    const id = name.slice('run-'.length, -'.txt'.length);
    if (!id || id.startsWith('vista-') || seen.has(id)) continue;

    const full = path.join(stateDir, name);
    const mtime = fs.statSync(full).mtime;
    const ageMs = now.getTime() - mtime.getTime();
    const ageHours = ageMs / 3_600_000;
    const valor = resolveActiveState(stateDir, id, '');
    if (isAgentState(valor) && isActiveStale(valor, ageHours)) continue;
    let order = 5;
    if (isAgentState(valor)) order = priorityOf(valor);

    lista.push({
      id,
      state: valor,
      title: displayTitle(stateDir, id),
      phrase: readFrase(stateDir, id),
      order,
      subagentCount: 0,
      ageMs,
    });
  }

  lista.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.ageMs - b.ageMs;
  });

  return lista;
}

/** Lee tick|tipo de espera.txt / pendiente.txt */
export function readTickTipo(stateDir: string, fileName: string): { tick: string; tipo: string } | null {
  const raw = readText(path.join(stateDir, fileName));
  if (raw == null) return null;
  const parts = raw.split('|');
  return { tick: parts[0] ?? '', tipo: parts[1] ?? '' };
}
