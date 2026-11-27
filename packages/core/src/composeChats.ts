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
    .replace(/,?\s*anclado\s*$/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(norm: string): string[] {
  return norm.split(/\s+/).filter((t) => t.length >= 2 || /^\d+$/.test(t));
}

/**
 * Prompt ↔ título UI sin igualdad exacta (ej. "Analiza ticket Jira 4224"
 * vs "Jira ticket 4224 analysis").
 * Issue #9: prosa larga que solo menciona el título ≠ match.
 */
export function fuzzyTitleMatch(promptOrTitleA: string, titleB: string): boolean {
  const a = normalizeTitle(promptOrTitleA);
  const b = normalizeTitle(titleB);
  if (!a || !b) return false;
  if (a === b) return true;

  const ta = tokensOf(a);
  const tb = tokensOf(b);
  if (tb.length === 0) return false;

  // Contención: título dentro de prompt solo si prompt ~ tamaño del título
  // (si no, es mención en prosa — #9).
  if (a.includes(b)) {
    if (a.length <= Math.max(b.length * 2, b.length + 24)) return true;
  }
  // Prompt corto contenido en título (prefijo / rename UI)
  if (b.includes(a) && a.length >= 8) return true;

  const digA = ta.filter((t) => /^\d{3,}$/.test(t));
  const digB = tb.filter((t) => /^\d{3,}$/.test(t));
  if (digA.length > 0 && digB.length > 0) {
    if (!digA.some((d) => digB.includes(d))) return false;
  }

  const ticketWord = (toks: string[]) => toks.some((t) => t === 'ticket' || t === 'jira');
  const sharedDigit = digA.some((d) => digB.includes(d));
  // #10: «ticket 4220» en prompt largo basta; no exigir migration/plan.
  // Cobertura alta + mucho ruido sigue siendo mención (#9).
  const strongTicket = sharedDigit && ticketWord(ta) && ticketWord(tb);

  const titleToks = tb.filter((t) => t.length >= 3);
  const shared = titleToks.filter((t) => ta.includes(t));
  const coverage = shared.length / Math.max(1, titleToks.length);
  const promptLong = a.length > b.length * 2.5;
  if (promptLong) {
    // Mención incidental: hace falta casi todo el título y poco ruido extra
    if (coverage < 0.8) {
      if (!strongTicket) return false;
    } else if (ta.length - shared.length > titleToks.length + 3) {
      return false;
    }
  } else if (coverage < 0.45 && shared.length < 2) {
    return false;
  }

  if (shared.some((t) => t.length >= 5) && coverage >= 0.5) return true;
  if (shared.length >= 2 && coverage >= 0.5) return true;
  if (digA.length > 0 && digB.length > 0 && shared.length >= 1 && coverage >= 0.5) {
    return true;
  }
  return false;
}

/** Prompt cita un ticket (dígito ≥3 + ticket/jira) que el título no tiene. */
export function promptNamesOtherTicket(prompt: string, title: string): boolean {
  const a = normalizeTitle(prompt).split(/\s+/);
  const b = new Set(normalizeTitle(title).split(/\s+/));
  const digs = a.filter((t) => /^\d{3,}$/.test(t));
  if (digs.length === 0) return false;
  if (!a.some((t) => t === 'ticket' || t === 'jira')) return false;
  return digs.some((d) => !b.has(d));
}

/** Cursor al pulsar Build del plan. No identifica el tab. */
export function isPlanBoilerplate(text: string): boolean {
  return normalizeTitle(text).startsWith('implement the plan');
}

/**
 * Follow-up corto del mismo chat (#9). No incluye el boilerplate del plan
 * ni un prompt que nombra otro ticket.
 */
export function isShortFollowUp(prompt: string, title: string): boolean {
  if (isPlanBoilerplate(prompt)) return false;
  if (promptNamesOtherTicket(prompt, title)) return false;
  const toks = normalizeTitle(prompt)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  return toks.length > 0 && toks.length <= 12;
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
    const byFuzzy: AgentSlot[] = [];
    const byTitulo: AgentSlot[] = [];
    for (const a of rawAgents) {
      if (used.has(a.id)) continue;
      const prompt = readPromptNorm(stateDir, a.id);
      if (prompt && prompt === clave) {
        byPrompt.push(a);
        continue;
      }
      const tit = normalizeTitle(readTitulo(stateDir, a.id));
      if (tit && tit === clave) {
        // Sticky de este tab: keep salvo prompt que matchea OTRO tab UI abierto
        // (follow-ups no matchean título → no desalojar; regresión #9).
        if (ACTIVE.has(String(a.state)) && prompt) {
          const otherUi = [...clavesUi].some(
            (o) => o !== clave && fuzzyTitleMatch(prompt, o),
          );
          if (
            (otherUi || promptNamesOtherTicket(prompt, title)) &&
            !fuzzyTitleMatch(prompt, title)
          ) {
            // contaminado hacia otro tab o otro ticket → no byTitulo aquí
          } else {
            byTitulo.push(a);
            continue;
          }
        } else {
          byTitulo.push(a);
          continue;
        }
      }
      if (prompt && fuzzyTitleMatch(prompt, title)) byFuzzy.push(a);
    }
    const elegido =
      pickOne(stateDir, byPrompt) ??
      pickOne(stateDir, byTitulo) ??
      pickOne(stateDir, byFuzzy);
    if (elegido) {
      used.add(elegido.id);
      assigned.set(i, elegido);
      // Hermanos inactivos mismo sticky — no si su prompt es otro tab UI.
      consumeInactiveSiblings(clave);
    } else {
      unmatchedIdx.push(i);
    }
  }

  // #11: un activo sin tab propio reclama el focused si el ocupante no sostiene
  // el título, si el prompt es el boilerplate del plan, o si solo hay ese tab.
  // #5: chat nuevo con tarea real no pisa un pin focused vacío entre varios tabs.
  if (focusedNorm.size === 1) {
    const focusClave = [...focusedNorm][0]!;
    const focusIdx = uiTitles.findIndex((t) => normalizeTitle(t) === focusClave);
    if (focusIdx >= 0) {
      const holder = assigned.get(focusIdx);
      const holderPrompt = holder ? readPromptNorm(stateDir, holder.id) : '';
      const holderSticky = holder ? normalizeTitle(readTitulo(stateDir, holder.id)) : '';
      const holderOk =
        !!holder &&
        (holderPrompt === focusClave ||
          fuzzyTitleMatch(holderPrompt, uiTitles[focusIdx]!) ||
          (isPlanBoilerplate(holderPrompt) && holderSticky === focusClave));
      const needy = rawAgents.filter((a) => {
        if (!ACTIVE.has(String(a.state))) return false;
        if (holderOk && a.id === holder?.id) return false;
        const prompt = readPromptNorm(stateDir, a.id);
        const assignedIdx = [...assigned.entries()].find(([, ag]) => ag.id === a.id)?.[0];
        if (assignedIdx !== undefined && assignedIdx !== focusIdx) {
          const assignedTitle = uiTitles[assignedIdx]!;
          const claveAsig = normalizeTitle(assignedTitle);
          const stuckWrong =
            prompt !== claveAsig && !fuzzyTitleMatch(prompt, assignedTitle);
          if (!stuckWrong) return false;
        }
        const tit = normalizeTitle(readTitulo(stateDir, a.id));
        const ownsOther =
          tit &&
          tit !== focusClave &&
          clavesUi.has(tit) &&
          (prompt === tit || fuzzyTitleMatch(prompt, tit));
        if (ownsOther) return false;
        const ownsFocus =
          tit === focusClave &&
          (prompt === focusClave ||
            fuzzyTitleMatch(prompt, uiTitles[focusIdx]!) ||
            isPlanBoilerplate(prompt));
        return !ownsFocus;
      });
      const untitled = needy.filter(
        (a) => normalizeTitle(readTitulo(stateDir, a.id)) !== focusClave,
      );
      const pick =
        untitled.length === 1 ? untitled[0] : needy.length === 1 ? needy[0] : null;
      const prompt = pick ? readPromptNorm(stateDir, pick.id) : '';
      const allow =
        !!pick &&
        (!holderOk &&
          (!!holder ||
            isPlanBoilerplate(prompt) ||
            uiTitles.length === 1));
      if (allow && pick) {
        if (holder && holder.id !== pick.id) used.delete(holder.id);
        for (const [idx, agent] of assigned) {
          if (agent.id === pick.id && idx !== focusIdx) assigned.delete(idx);
        }
        used.add(pick.id);
        assigned.set(focusIdx, pick);
        const drop = unmatchedIdx.indexOf(focusIdx);
        if (drop >= 0) unmatchedIdx.splice(drop, 1);
      }
    }
  }

  // Renombre 1:1: activo huérfano ↔ UI sin match.
  // Ignorar huérfanos inactivos (sticky de chats ya cerrados) — si no, el
  // bind nunca dispara y el chat real sale como orphan Terminado + tab «sin frase».
  const huerfanos = rawAgents.filter((a) => {
    if (used.has(a.id)) return false;
    const tit = normalizeTitle(readTitulo(stateDir, a.id));
    if (tit && clavesUi.has(tit)) return false;
    return true;
  });
  // Activo huérfano ↔ UI libre solo con prompt↔título (issue #5: no foco UIA idle).
  const activeHuerfanos = huerfanos.filter((a) => ACTIVE.has(String(a.state)));
  for (const h of activeHuerfanos) {
    const prompt = readPromptNorm(stateDir, h.id);
    if (!prompt) continue;
    const hits = unmatchedIdx.filter((i) => {
      const title = uiTitles[i]!;
      const clave = normalizeTitle(title);
      return prompt === clave || fuzzyTitleMatch(prompt, title);
    });
    if (hits.length !== 1) continue;
    const bindIdx = hits[0]!;
    used.add(h.id);
    assigned.set(bindIdx, h);
    unmatchedIdx.splice(unmatchedIdx.indexOf(bindIdx), 1);
    consumeInactiveSiblings(normalizeTitle(uiTitles[bindIdx]!));
  }
  // Renombre 1:1 inactivo (legado): un huérfano + un UI sin match.
  if (unmatchedIdx.length === 1 && huerfanos.filter((a) => !used.has(a.id)).length === 1) {
    const i = unmatchedIdx[0]!;
    const h = huerfanos.find((a) => !used.has(a.id))!;
    if (!ACTIVE.has(String(h.state))) {
      used.add(h.id);
      assigned.set(i, h);
      unmatchedIdx.length = 0;
      consumeInactiveSiblings(normalizeTitle(uiTitles[i]!));
    }
  }

  // UI sin match: solo prompt exacto / fuzzy. NUNCA meter activo en tab idle fijado.
  const stillUnmatched = uiTitles
    .map((_, i) => i)
    .filter((i) => !assigned.has(i));
  if (stillUnmatched.length > 0) {
    const unused = rawAgents.filter((a) => !used.has(a.id));
    for (const i of stillUnmatched) {
      if (assigned.has(i)) continue;
      const clave = normalizeTitle(uiTitles[i]!);
      const byPrompt = unused.find(
        (a) => !used.has(a.id) && readPromptNorm(stateDir, a.id) === clave,
      );
      const byFuzzy = unused.find(
        (a) =>
          !used.has(a.id) &&
          fuzzyTitleMatch(readPromptNorm(stateDir, a.id), clave),
      );
      const pick = byPrompt ?? byFuzzy ?? null;
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
