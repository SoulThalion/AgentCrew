import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { hashPhrase, recordedVoicePath } from '../src/index.js';

describe('hashPhrase', () => {
  it('SHA256 UTF-8 primeros 16 hex (compat voces/)', () => {
    const frase = 'Agente listo';
    const expected = createHash('sha256').update(frase, 'utf8').digest('hex').slice(0, 16);
    expect(hashPhrase(frase)).toBe(expected);
    const dir = path.join('voces');
    expect(recordedVoicePath(dir, frase)).toBe(path.join(dir, `frase-${expected}.mp3`));
  });
});
