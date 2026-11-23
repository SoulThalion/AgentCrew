import fs from 'node:fs';
import path from 'node:path';
import { hashPhrase, recordedVoicePath } from '@agentcrew/core';
import { synthesizeEleven, synthesizeFish } from './providers';
import { playMp3, playSystemBeep, playWav, wavForTipo } from './play';
import { phraseFor } from './phrases';
import type { SpeakResult, TtsSettings } from './types';

export type SpeakPaths = {
  vocesDir: string;
  cacheDir: string;
};

export type AvisoMode = 'voz' | 'sonido';

export type SpeakOptions = {
  /** Default true. false = solo afterMp3 (p.ej. Cast sin PC). */
  playLocal?: boolean;
  /** Tras resolver path MP3 (Cast, etc.). No se llama en beep/WAV. */
  afterMp3?: (absPath: string) => void | Promise<void>;
};

async function emitMp3(
  absPath: string,
  volume: number,
  opts?: SpeakOptions,
): Promise<boolean> {
  const playLocal = opts?.playLocal !== false;
  const tasks: Promise<unknown>[] = [];
  if (playLocal) tasks.push(playMp3(absPath, volume));
  if (opts?.afterMp3) tasks.push(Promise.resolve(opts.afterMp3(absPath)));
  if (!tasks.length) return false;
  const results = await Promise.allSettled(tasks);
  if (playLocal) {
    const local = results[0];
    return local?.status === 'fulfilled' && local.value === true;
  }
  return results.every((r) => r.status === 'fulfilled');
}

export async function resolveAndSpeak(
  text: string,
  settings: TtsSettings,
  paths: SpeakPaths,
  opts?: SpeakOptions,
): Promise<SpeakResult> {
  if (settings.muted) return { ok: true, source: 'muted' };
  if (!text.trim()) return { ok: false, source: 'none' };

  const local = recordedVoicePath(paths.vocesDir, text);
  if (fs.existsSync(local) && fs.statSync(local).size >= 1000) {
    const ok = await emitMp3(local, settings.volume, opts);
    return { ok, source: 'local', path: local };
  }

  let remote: string | null = null;
  let source: SpeakResult['source'] = 'none';
  if (settings.provider === 'fish') {
    remote = await synthesizeFish(text, settings, paths.cacheDir);
    source = remote ? 'fish' : 'none';
  } else if (settings.provider === 'elevenlabs') {
    remote = await synthesizeEleven(text, settings, paths.cacheDir);
    source = remote ? 'elevenlabs' : 'none';
  }

  if (remote) {
    const ok = await emitMp3(remote, settings.volume, opts);
    return {
      ok,
      source: source === 'fish' || source === 'elevenlabs' ? source : 'cache',
      path: remote,
    };
  }

  if (opts?.playLocal === false) return { ok: false, source: 'none' };
  playSystemBeep();
  return { ok: true, source: 'system' };
}

/**
 * Aviso por tipo: respeta modo voz|sonido (paridad Decir-Frase legacy).
 * voz → MP3/frase; si falla → WAV. sonido → solo WAV.
 */
export async function speakTipo(
  tipo: string,
  settings: TtsSettings,
  paths: SpeakPaths,
  aviso: AvisoMode = 'voz',
  opts?: SpeakOptions,
): Promise<SpeakResult> {
  if (settings.muted) return { ok: true, source: 'muted' };

  const wav = wavForTipo(tipo);
  if (aviso === 'sonido') {
    if (opts?.playLocal === false) return { ok: false, source: 'none' };
    const ok = await playWav(wav);
    return { ok, source: 'system', path: wav };
  }

  const text = phraseFor(tipo);
  const local = recordedVoicePath(paths.vocesDir, text);
  if (fs.existsSync(local) && fs.statSync(local).size >= 1000) {
    const ok = await emitMp3(local, settings.volume, opts);
    if (ok) return { ok, source: 'local', path: local };
  }

  let remote: string | null = null;
  let source: SpeakResult['source'] = 'none';
  if (settings.provider === 'fish') {
    remote = await synthesizeFish(text, settings, paths.cacheDir);
    source = remote ? 'fish' : 'none';
  } else if (settings.provider === 'elevenlabs') {
    remote = await synthesizeEleven(text, settings, paths.cacheDir);
    source = remote ? 'elevenlabs' : 'none';
  }
  if (remote) {
    const ok = await emitMp3(remote, settings.volume, opts);
    if (ok) {
      return {
        ok,
        source: source === 'fish' || source === 'elevenlabs' ? source : 'cache',
        path: remote,
      };
    }
  }

  // Legacy: si voz falla → Tocar-Wav
  if (opts?.playLocal === false) return { ok: false, source: 'none' };
  const ok = await playWav(wav);
  return { ok, source: 'system', path: wav };
}

export function ensureDirs(paths: SpeakPaths): void {
  fs.mkdirSync(paths.vocesDir, { recursive: true });
  fs.mkdirSync(paths.cacheDir, { recursive: true });
}

export function defaultVocesDir(repoRoot?: string): string {
  if (repoRoot) {
    const p = path.join(repoRoot, 'voces');
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, '..', '..', '..', 'voces');
}

export { hashPhrase, phraseFor };
