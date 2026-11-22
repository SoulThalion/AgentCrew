import { describe, expect, it } from 'vitest';
import { hashPhrase, recordedVoicePath } from '@agentcrew/core';
import path from 'node:path';
import fs from 'node:fs';
import {
  decideUsoAlert,
  knownUsagePhrases,
  parseUsoPercent,
  phraseForUso,
  usageThreshold,
} from '../src/usagePhrases';

describe('usagePhrases', () => {
  it('usageThreshold marca máxima alcanzada', () => {
    expect(usageThreshold(49)).toBe(0);
    expect(usageThreshold(50)).toBe(50);
    expect(usageThreshold(64)).toBe(50);
    expect(usageThreshold(65)).toBe(65);
    expect(usageThreshold(100)).toBe(100);
  });

  it('parseUsoPercent lee Inc/Otr', () => {
    expect(parseUsoPercent('Inc 37%')).toBe(37);
    expect(parseUsoPercent('Otr 100%')).toBe(100);
    expect(parseUsoPercent('Inc -')).toBe(-1);
  });

  it('decideUsoAlert habla solo al subir y respeta mute', () => {
    const up = decideUsoAlert(80, 10, 50, 0, true);
    expect(up.shouldSpeak).toBe(true);
    expect(up.nextInc).toBe(80);
    expect(up.phrase).toContain('ochenta');

    const muted = decideUsoAlert(80, 10, 50, 0, false);
    expect(muted.shouldSpeak).toBe(false);
    expect(muted.nextInc).toBe(50);
    expect(muted.changed).toBe(false);

    const down = decideUsoAlert(20, 0, 80, 0, true);
    expect(down.shouldSpeak).toBe(false);
    expect(down.nextInc).toBe(0);
    expect(down.changed).toBe(true);
  });

  it('phraseForUso doble 100', () => {
    const f = phraseForUso(true, 100, true, 100);
    expect(f).toContain('Composer');
  });

  it('MP3 locales cubren frases de uso', () => {
    const voces = path.resolve(__dirname, '..', '..', '..', 'voces');
    if (!fs.existsSync(voces)) return;
    for (const frase of knownUsagePhrases()) {
      const p = recordedVoicePath(voces, frase);
      expect(fs.existsSync(p), `falta ${path.basename(p)} hash=${hashPhrase(frase)}`).toBe(
        true,
      );
    }
  });
});
