import fs from 'node:fs';
import path from 'node:path';

export type AvisoMode = 'voz' | 'sonido';
export type CuandoMode = 'siempre' | 'inactivo';

export type PanelStatePrefs = {
  muted: boolean;
  muteUntil: string | null;
  volume: number;
  aviso: AvisoMode;
  cuando: CuandoMode;
  muestra: boolean;
};

function readText(dir: string, name: string): string {
  try {
    return fs.readFileSync(path.join(dir, name), 'utf8').trim();
  } catch {
    return '';
  }
}

function writeText(dir: string, name: string, value: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), value, 'utf8');
}

export function loadStatePrefs(stateDir: string): PanelStatePrefs {
  const mudo = readText(stateDir, 'mudo.txt');
  let muted = false;
  let muteUntil: string | null = null;
  if (mudo) {
    if (mudo === '1') muted = true;
    else {
      const t = Date.parse(mudo);
      if (!Number.isNaN(t) && t > Date.now()) {
        muted = true;
        muteUntil = new Date(t).toISOString();
      } else if (!Number.isNaN(t) && t <= Date.now()) {
        try {
          fs.unlinkSync(path.join(stateDir, 'mudo.txt'));
        } catch {
          /* ignore */
        }
      } else muted = true;
    }
  }
  const fromFile = readVolume(stateDir);
  const volume = fromFile ?? 100;
  const aviso: AvisoMode = readText(stateDir, 'aviso.txt') === 'sonido' ? 'sonido' : 'voz';
  const cuando: CuandoMode =
    readText(stateDir, 'cuando.txt') === 'siempre' ? 'siempre' : 'inactivo';
  return {
    muted,
    muteUntil,
    volume,
    aviso,
    cuando,
    muestra: readText(stateDir, 'muestra.txt') === '1',
  };
}

export function setMuted(stateDir: string, muted: boolean, untilIso?: string): PanelStatePrefs {
  const file = path.join(stateDir, 'mudo.txt');
  if (!muted) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  } else if (untilIso) {
    writeText(stateDir, 'mudo.txt', untilIso);
  } else {
    writeText(stateDir, 'mudo.txt', '1');
  }
  return loadStatePrefs(stateDir);
}

/** `volumen.txt` ausente o ilegible → null. Si no, 0–100. */
export function readVolume(stateDir: string): number | null {
  const volRaw = readText(stateDir, 'volumen.txt');
  if (!volRaw) return null;
  const n = Number(volRaw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function setVolume(stateDir: string, level: number): PanelStatePrefs {
  const v = Number.isFinite(level) ? Math.max(0, Math.min(100, Math.round(level))) : 100;
  writeText(stateDir, 'volumen.txt', String(v));
  return loadStatePrefs(stateDir);
}

export function setAviso(stateDir: string, modo: AvisoMode): PanelStatePrefs {
  writeText(stateDir, 'aviso.txt', modo === 'sonido' ? 'sonido' : 'voz');
  return loadStatePrefs(stateDir);
}

export function setCuando(stateDir: string, modo: CuandoMode): PanelStatePrefs {
  writeText(stateDir, 'cuando.txt', modo === 'siempre' ? 'siempre' : 'inactivo');
  return loadStatePrefs(stateDir);
}

export function setMuestra(stateDir: string, on: boolean): PanelStatePrefs {
  if (on) writeText(stateDir, 'muestra.txt', '1');
  else {
    try {
      fs.unlinkSync(path.join(stateDir, 'muestra.txt'));
    } catch {
      /* ignore */
    }
  }
  return loadStatePrefs(stateDir);
}
