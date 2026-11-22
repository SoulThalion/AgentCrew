import { describe, expect, it } from 'vitest';
import {
  createAllDoneTracker,
  noteDoneSonars,
  noteWorkingCount,
  takeAllDoneAnnounce,
  IDLE_TODOS_SECONDS,
} from './allDoneAviso';

describe('allDoneAviso', () => {
  it('no anuncia si solo un agente', () => {
    const t = createAllDoneTracker();
    noteWorkingCount(t, 1);
    noteDoneSonars(t, ['fin']);
    expect(takeAllDoneAnnounce(t, 0, 'inactivo', IDLE_TODOS_SECONDS)).toBe(false);
  });

  it('anuncia tras multi + idle', () => {
    const t = createAllDoneTracker();
    noteWorkingCount(t, 2);
    noteWorkingCount(t, 0);
    expect(takeAllDoneAnnounce(t, 0, 'inactivo', IDLE_TODOS_SECONDS)).toBe(true);
  });

  it('dos fin en mismo tick cuentan como multi', () => {
    const t = createAllDoneTracker();
    noteDoneSonars(t, ['fin', 'fin']);
    expect(takeAllDoneAnnounce(t, 0, 'siempre', 0)).toBe(true);
  });

  it('sin idle suficiente mantiene pending', () => {
    const t = createAllDoneTracker();
    noteWorkingCount(t, 3);
    noteWorkingCount(t, 0);
    expect(takeAllDoneAnnounce(t, 0, 'inactivo', 10)).toBe(false);
    expect(t.pending).toBe(true);
    expect(takeAllDoneAnnounce(t, 0, 'inactivo', IDLE_TODOS_SECONDS)).toBe(true);
    expect(t.pending).toBe(false);
  });
});
