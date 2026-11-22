import { describe, expect, it } from 'vitest';
import { isAgentState, priorityOf, safeId } from '../src/index.js';

describe('states', () => {
  it('prioridad: esperando < trabajando < terminado', () => {
    expect(priorityOf('esperando')).toBeLessThan(priorityOf('trabajando'));
    expect(priorityOf('trabajando')).toBeLessThan(priorityOf('terminado'));
  });

  it('isAgentState', () => {
    expect(isAgentState('trabajando')).toBe(true);
    expect(isAgentState('nope')).toBe(false);
  });
});

describe('safeId', () => {
  it('igual que legacy Id-Seguro', () => {
    expect(safeId('abc/def:1')).toBe('abc_def_1');
    expect(safeId('')).toBe('sin-id');
    expect(safeId('ok-ID_9')).toBe('ok-ID_9');
  });
});
