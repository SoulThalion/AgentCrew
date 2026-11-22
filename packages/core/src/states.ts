/** Estados de UI del panel (docs/04-dominio.md). */
export const AGENT_STATES = [
  'trabajando',
  'subagentes',
  'planificando',
  'leyendo',
  'esperando',
  'terminado',
  'atento',
  'error',
  'detenido',
  'vacio',
] as const;

export type AgentState = (typeof AGENT_STATES)[number];

/** Menor = más urgente en la franja. */
export const STATE_PRIORITY: Record<AgentState, number> = {
  esperando: 0,
  atento: 0,
  error: 1,
  trabajando: 2,
  subagentes: 2,
  planificando: 2,
  leyendo: 2,
  terminado: 3,
  detenido: 4,
  vacio: 5,
};

export const STATE_COLORS: Record<AgentState, string> = {
  trabajando: '#4FA3FF',
  subagentes: '#F27B4A',
  planificando: '#A68BFF',
  leyendo: '#A68BFF',
  esperando: '#FFB020',
  terminado: '#3DD68C',
  atento: '#A68BFF',
  error: '#FF5C5C',
  detenido: '#8A8A8A',
  vacio: '#8A8A8A',
};

export const STATE_LABELS: Record<AgentState, string> = {
  trabajando: 'Trabajando',
  subagentes: 'Subagentes',
  planificando: 'Planificando',
  leyendo: 'Leyendo',
  esperando: 'Esperando tu respuesta',
  terminado: 'Terminado',
  atento: 'Pendiente',
  error: 'Error',
  detenido: 'Detenido',
  vacio: '',
};

const ACTIVE_STALE = new Set<AgentState>([
  'trabajando',
  'planificando',
  'leyendo',
  'subagentes',
]);

export function isAgentState(value: string): value is AgentState {
  return (AGENT_STATES as readonly string[]).includes(value);
}

export function priorityOf(state: AgentState): number {
  return STATE_PRIORITY[state] ?? 5;
}

/** Activos con edad ≥ 3 h se ocultan en listAgents. */
export function isActiveStale(state: AgentState, ageHours: number): boolean {
  return ACTIVE_STALE.has(state) && ageHours >= 3;
}

export type ComposerMode = 'agent' | 'plan';

export function parseComposerMode(raw: string): ComposerMode | null {
  const v = raw.trim().toLowerCase();
  if (v === 'agent' || v === 'plan') return v;
  return null;
}
