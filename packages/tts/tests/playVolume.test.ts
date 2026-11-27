import { describe, expect, it } from 'vitest';
import { clampVolume, mciVolumeLevel } from '../src/play';

describe('volumen TTS', () => {
  it('slider 40 → MCI 400', () => {
    expect(mciVolumeLevel(40)).toBe(400);
  });

  it('0 queda en silencio y más de 100 se recorta', () => {
    expect(mciVolumeLevel(0)).toBe(0);
    expect(mciVolumeLevel(140)).toBe(1000);
    expect(clampVolume(Number.NaN)).toBe(100);
  });
});
