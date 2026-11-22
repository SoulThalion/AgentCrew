/**
 * Tras varios agentes trabajando: si todos acaban y el usuario sigue inactivo,
 * emitir tipo sonar `todos` (frase local MP3).
 */
import type { CuandoMode } from './statePrefs';
import { idleSecondsWin } from './idleWin';

/** Paridad umbral legacy alarma-agente.ps1 */
export const IDLE_TODOS_SECONDS = 120;

export type AllDoneTracker = {
  /** Hubo ≥2 trabajando en este lote. */
  sawMulti: boolean;
  /** Lote cerrado; espera idle (o modo siempre) para anunciar. */
  pending: boolean;
};

export function createAllDoneTracker(): AllDoneTracker {
  return { sawMulti: false, pending: false };
}

export function noteWorkingCount(tracker: AllDoneTracker, working: number): void {
  if (working >= 2) tracker.sawMulti = true;
  if (working === 0 && tracker.sawMulti) {
    tracker.pending = true;
    tracker.sawMulti = false;
  }
}

/** Sonars de cierre individuales en este tick. */
export function noteDoneSonars(tracker: AllDoneTracker, tipos: string[]): void {
  const n = tipos.filter((t) => t === 'fin' || t === 'error' || t === 'plan').length;
  if (n >= 2) tracker.sawMulti = true;
}

/**
 * ¿Anunciar `todos` ahora?
 * Si pending pero aún no idle → false y mantiene pending.
 */
export function takeAllDoneAnnounce(
  tracker: AllDoneTracker,
  working: number,
  cuando: CuandoMode,
  idleSeconds: number = idleSecondsWin(),
): boolean {
  if (working > 0) return false;
  if (tracker.sawMulti) {
    tracker.pending = true;
    tracker.sawMulti = false;
  }
  if (!tracker.pending) return false;
  if (cuando === 'siempre' || idleSeconds >= IDLE_TODOS_SECONDS) {
    tracker.pending = false;
    return true;
  }
  return false;
}
