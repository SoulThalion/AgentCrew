import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { TtsSettings } from './types';

async function postBinary(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 1000) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

export async function synthesizeFish(
  text: string,
  settings: TtsSettings,
  cacheDir: string,
): Promise<string | null> {
  const key =
    settings.fishApiKey.trim() ||
    process.env.FISH_AUDIO_API_KEY?.trim() ||
    process.env.FISH_API_KEY?.trim() ||
    '';
  if (!key) return null;

  const hash = createHash('sha256')
    .update(`${settings.fishReferenceId}|${text}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  const file = path.join(cacheDir, `fish-${hash}.mp3`);
  if (fs.existsSync(file) && fs.statSync(file).size >= 1000) return file;

  const body = JSON.stringify({
    text,
    reference_id: settings.fishReferenceId,
    format: 'mp3',
    language: 'es',
    mp3_bitrate: 128,
    prosody: { speed: 0.95, volume: 0 },
  });

  for (const model of [settings.fishModel, 's2.1-pro-free', 's2.1-pro']) {
    const audio = await postBinary(
      'https://api.fish.audio/v1/tts',
      {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'audio/mpeg',
        model,
      },
      body,
    );
    if (audio) {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(file, audio);
      return file;
    }
  }
  return null;
}

export async function synthesizeEleven(
  text: string,
  settings: TtsSettings,
  cacheDir: string,
): Promise<string | null> {
  const key = settings.elevenApiKey.trim();
  const voice = settings.elevenVoiceId.trim();
  if (!key || !voice) return null;

  const hash = createHash('sha256')
    .update(`eleven|${voice}|${text}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  const file = path.join(cacheDir, `eleven-${hash}.mp3`);
  if (fs.existsSync(file) && fs.statSync(file).size >= 1000) return file;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`;
  const audio = await postBinary(
    url,
    {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    JSON.stringify({
      text,
      model_id: settings.elevenModel || 'eleven_multilingual_v2',
    }),
  );
  if (!audio) return null;
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(file, audio);
  return file;
}
