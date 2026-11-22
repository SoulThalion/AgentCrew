import { describe, expect, it } from 'vitest';
import { phraseFor, knownPhrases } from '../src/phrases';
import { hashPhrase } from '@agentcrew/core';

describe('tts phrases', () => {
  it('phraseFor devuelve texto', () => {
    expect(phraseFor('fin').length).toBeGreaterThan(0);
    expect(phraseFor('pregunta').length).toBeGreaterThan(0);
    expect(phraseFor('todos')).toBe('Señor, todos los agentes han terminado.');
  });

  it('known phrases tienen hash estable', () => {
    const p = knownPhrases()[0]!;
    expect(hashPhrase(p)).toHaveLength(16);
  });
});
