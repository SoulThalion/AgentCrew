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

export async function resolveAndSpeak(
  text: string,
  settings: TtsSettings,
  paths: SpeakPaths,
): Promise<SpeakResult> {
  if (settings.muted) return { ok: true, source: 'muted' };
  if (!text.trim()) return { ok: false, source: 'none' };

  const local = recordedVoicePath(paths.vocesDir, text);
  if (fs.existsSync(local) && fs.statSync(local).size >= 1000) {
    const ok = await playMp3(local, settings.volume);
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
    const ok = await playMp3(remote, settings.volume);
    return {
      ok,
      source: source === 'fish' || source === 'elevenlabs' ? source : 'cache',
      path: remote,
    };
  }

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
): Promise<SpeakResult> {
  if (settings.muted) return { ok: true, source: 'muted' };

  const wav = wavForTipo(tipo);
  if (aviso === 'sonido') {
    const ok = await playWav(wav);
    return { ok, source: 'system', path: wav };
  }

  const text = phraseFor(tipo);
  const local = recordedVoicePath(paths.vocesDir, text);
  if (fs.existsSync(local) && fs.statSync(local).size >= 1000) {
    const ok = await playMp3(local, settings.volume);
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
    const ok = await playMp3(remote, settings.volume);
    if (ok) {
      return {
        ok,
        source: source === 'fish' || source === 'elevenlabs' ? source : 'cache',
        path: remote,
      };
    }
  }

  // Legacy: si voz falla → Tocar-Wav
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
