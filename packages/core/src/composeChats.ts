import { isAgentState, priorityOf, type AgentState } from './states.js';
import {
  applyDisplayPose,
  displayTitle,
  isVisto,
  readFrase,
  readTitulo,
} from './stateStore.js';
import { filePrompt } from './paths.js';
import { readText } from './atomicWrite.js';
import { listAgents, type AgentSlot } from './listAgents.js';

const ACTIVE = new Set([
  'trabajando',
  'planificando',
  'leyendo',
  'esperando',
  'subagentes',
]);

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readPromptNorm(stateDir: string, id: string): string {
  const raw = (readText(filePrompt(stateDir, id)) ?? '').trim();
  return normalizeTitle(raw.replace(/\\[nrt]/gi, ' ').replace(/\s+/g, ' '));
}

function youngest(cands: AgentSlot[]): AgentSlot | null {
  if (cands.length === 0) return null;
  return [...cands].sort((a, b) => a.ageMs - b.ageMs)[0] ?? null;
}

/**
 * Elige un agente para un título UI.
 * Varios con el mismo título: activo único → activos (más reciente) →
 * terminado/error sin leer (más reciente) → cualquiera reciente.
 * Nunca null si hay candidatos (evita placeholder detenido tapando unread).
 */
function pickOne(stateDir: string, cands: AgentSlot[]): AgentSlot | null {
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0] ?? null;
  const active = cands.filter((c) => ACTIVE.has(String(c.state)));
  if (active.length === 1) return active[0] ?? null;
  if (active.length > 1) return youngest(active);
  const unreadDone = cands.filter(
    (c) =>
      (c.state === 'terminado' || c.state === 'error') && !isVisto(stateDir, c.id),
  );
  if (unreadDone.length > 0) return youngest(unreadDone);
  return youngest(cands);
}

function slotFromAgent(
  stateDir: string,
  agent: AgentSlot,
  title: string,
  focused: boolean,
): AgentSlot {
  const raw = String(agent.state);
  const pose = applyDisplayPose(stateDir, agent.id, raw, focused);
  return {
    ...agent,
    state: pose.state,
    title,
    order: pose.order,
    phrase: readFrase(stateDir, agent.id),
    focused,
  };
}

function placeholder(title: string, focused: boolean, index: number): AgentSlot {
  const state: AgentState = focused ? 'atento' : 'detenido';
  return {
    id: `ui:${index}:${normalizeTitle(title).slice(0, 40)}`,
    state,
    title,
    phrase: '',
    order: focused ? 0 : 4,
    subagentCount: 0,
    ageMs: 0,
    focused,
  };
}

export type ComposeChatsOptions = {
  uiTitles: string[];
  focusedTitles?: string[];
  /** Foco por click en sprite (hasta scrape UIA). */
  focusedIds?: string[];
  now?: Date;
};

/**
 * Franja = chats UI abiertos (paridad Leer-Chats).
 * Sin títulos UI → listAgents con pose visto/foco.
 */
export function composeChats(
  stateDir: string,
  opts: ComposeChatsOptions,
): AgentSlot[] {
  const uiTitles = opts.uiTitles.map((t) => t.trim()).filter(Boolean);
  const focusedNorm = new Set(
    (opts.focusedTitles ?? []).map(normalizeTitle).filter(Boolean),
  );
  const focusedIds = new Set((opts.focusedIds ?? []).filter(Boolean));

  const rawAgents = listAgents(stateDir, {
    now: opts.now,
    pruneOlderThan24h: false,
    applyPose: false,
  });

  if (uiTitles.length === 0) {
    return listAgents(stateDir, {
      now: opts.now,
      focusedIds: [...focusedIds],
      applyPose: true,
    });
  }

  const used = new Set<string>();
  const assigned = new Map<number, AgentSlot>();
  const unmatchedIdx: number[] = [];
  const clavesUi = new Set(uiTitles.map(normalizeTitle).filter(Boolean));

  /** ¿Prompt del hermano apunta a otro tab UI abierto? → no ocultar. */
  function promptOwnsOtherUi(id: string, currentClave: string): boolean {
    const prompt = readPromptNorm(stateDir, id);
    if (!prompt || prompt === currentClave) return false;
    return clavesUi.has(prompt);
  }

  function consumeInactiveSiblings(clave: string): void {
    for (const a of rawAgents) {
      if (used.has(a.id)) continue;
      if (ACTIVE.has(String(a.state))) continue;
      if (promptOwnsOtherUi(a.id, clave)) continue;
      const tit = normalizeTitle(readTitulo(stateDir, a.id));
      if (tit && tit === clave) used.add(a.id);
    }
  }

  for (let i = 0; i < uiTitles.length; i++) {
    const title = uiTitles[i]!;
    const clave = normalizeTitle(title);
    const byPrompt: AgentSlot[] = [];
    const byTitulo: AgentSlot[] = [];
    for (const a of rawAgents) {
      if (used.has(a.id)) continue;
      const prompt = readPromptNorm(stateDir, a.id);
      if (prompt && prompt === clave) {
        byPrompt.push(a);
        continue;
      }
      const tit = normalizeTitle(readTitulo(stateDir, a.id));
      if (tit && tit === clave) byTitulo.push(a);
    }
    const elegido = pickOne(stateDir, byPrompt) ?? pickOne(stateDir, byTitulo);
    if (elegido) {
      used.add(elegido.id);
      assigned.set(i, elegido);
      // Hermanos inactivos mismo sticky — no si su prompt es otro tab UI.
      consumeInactiveSiblings(clave);
    } else {
      unmatchedIdx.push(i);
    }
  }

  // Renombre 1:1 (legacy)
  const huerfanos = rawAgents.filter((a) => {
    if (used.has(a.id)) return false;
    const tit = normalizeTitle(readTitulo(stateDir, a.id));
    if (tit && clavesUi.has(tit)) return false;
    return true;
  });
  if (unmatchedIdx.length === 1 && huerfanos.length === 1) {
    const i = unmatchedIdx[0]!;
    const h = huerfanos[0]!;
    used.add(h.id);
    assigned.set(i, h);
    unmatchedIdx.length = 0;
    consumeInactiveSiblings(normalizeTitle(uiTitles[i]!));
  }

  // UI sin match: primero por prompt; luego surplus sticky duplicado / activos libres
  const stillUnmatched = uiTitles
    .map((_, i) => i)
    .filter((i) => !assigned.has(i));
  if (stillUnmatched.length > 0) {
    const assignedTitulos = new Set<string>();
    for (const a of assigned.values()) {
      const t = normalizeTitle(readTitulo(stateDir, a.id));
      if (t) assignedTitulos.add(t);
    }
    const unused = rawAgents.filter((a) => !used.has(a.id));
    const unusedActive = unused.filter((a) => ACTIVE.has(String(a.state)));
    const surplus = unusedActive.filter((a) => {
      const t = normalizeTitle(readTitulo(stateDir, a.id));
      return Boolean(t && assignedTitulos.has(t));
    });
    const pool = [...(surplus.length > 0 ? surplus : unusedActive)].sort(
      (a, b) => a.ageMs - b.ageMs,
    );
    for (const i of stillUnmatched) {
      if (assigned.has(i)) continue;
      const clave = normalizeTitle(uiTitles[i]!);
      // Prompt exacto (activo o no) gana a surplus aleatorio → evita estados cruzados
      const byPrompt = unused.find(
        (a) => !used.has(a.id) && readPromptNorm(stateDir, a.id) === clave,
      );
      let pick = byPrompt ?? null;
      if (!pick) {
        const idx = pool.findIndex((a) => !used.has(a.id));
        if (idx >= 0) pick = pool.splice(idx, 1)[0] ?? null;
      } else {
        const pi = pool.findIndex((a) => a.id === pick!.id);
        if (pi >= 0) pool.splice(pi, 1);
      }
      if (!pick) continue;
      used.add(pick.id);
      assigned.set(i, pick);
    }
  }

  const lista: AgentSlot[] = [];
  for (let i = 0; i < uiTitles.length; i++) {
    const title = uiTitles[i]!;
    const clave = normalizeTitle(title);
    const elegido = assigned.get(i);
    const focused =
      focusedNorm.has(clave) ||
      Boolean(elegido && focusedIds.has(elegido.id));
    if (elegido) {
      lista.push(slotFromAgent(stateDir, elegido, title, focused));
    } else {
      lista.push(placeholder(title, focused, i));
    }
  }

  // Orphans: no duplicar título ya en franja; activos ya reasignados arriba.
  for (const a of rawAgents) {
    if (used.has(a.id)) continue;
    const tit = normalizeTitle(readTitulo(stateDir, a.id));
    if (tit && clavesUi.has(tit)) continue;
    const valor = String(a.state);
    if (!ACTIVE.has(valor)) {
      if (valor !== 'terminado' && valor !== 'error') continue;
      if (isVisto(stateDir, a.id)) continue;
    }
    const focused = focusedIds.has(a.id);
    const pose = applyDisplayPose(stateDir, a.id, valor, focused);
    lista.push({
      ...a,
      state: pose.state,
      title: displayTitle(stateDir, a.id) || a.title,
      order: pose.order,
      phrase: readFrase(stateDir, a.id),
      focused,
    });
  }

  return lista;
}

/** Resuelve id de foco: prefiere agente activo si hay títulos duplicados. */
export function resolveFocusedIds(
  stateDir: string,
  agents: AgentSlot[],
  focusedTitles: string[],
): string[] {
  const ids: string[] = [];
  for (const ft of focusedTitles) {
    const fn = normalizeTitle(ft);
    if (!fn) continue;
    const hits = agents.filter((a) => {
      const tit = normalizeTitle(readTitulo(stateDir, a.id) || a.title);
      const prompt = readPromptNorm(stateDir, a.id);
      return (
        (tit && tit === fn) ||
        (prompt && (prompt === fn || prompt.startsWith(fn) || fn.startsWith(prompt)))
      );
    });
    const pick =
      hits.find((a) => ACTIVE.has(String(a.state))) ??
      (hits.length === 1 ? hits[0] : undefined);
    if (pick && !ids.includes(pick.id)) ids.push(pick.id);
  }
  return ids;
}

export function applyPosesToAgents(
  stateDir: string,
  agents: AgentSlot[],
  focusedIds: string[],
): AgentSlot[] {
  const focused = new Set(focusedIds);
  return agents.map((a) => {
    const enfocado = focused.has(a.id);
    const pose = applyDisplayPose(stateDir, a.id, String(a.state), enfocado);
    let order = pose.order;
    if (isAgentState(pose.state)) order = priorityOf(pose.state);
    return {
      ...a,
      state: pose.state,
      order,
      focused: enfocado,
    };
  });
}
