import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadStatePrefs, readVolume, setVolume } from '../src/electron/statePrefs';

const dirs: string[] = [];

function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-vol-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('volumen.txt', () => {
  it('guarda el slider, no solo 30/60/100', () => {
    const dir = tmp();
    expect(setVolume(dir, 40).volume).toBe(40);
    expect(readVolume(dir)).toBe(40);
    expect(loadStatePrefs(dir).volume).toBe(40);
  });

  it('sin archivo no inventa un 100 para pisar settings', () => {
    expect(readVolume(tmp())).toBeNull();
  });
});
