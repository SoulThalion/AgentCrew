import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_TTS_SETTINGS,
  type TtsSettings,
  type TtsProviderId,
} from '@agentcrew/tts';

const FILE = 'tts-settings.json';

function settingsPath(): string {
  return path.join(app.getPath('userData'), FILE);
}

function enc(value: string): string {
  if (!value) return '';
  if (!safeStorage.isEncryptionAvailable()) return value;
  return safeStorage.encryptString(value).toString('base64');
}

function dec(value: string): string {
  if (!value) return '';
  if (!safeStorage.isEncryptionAvailable()) return value;
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return '';
  }
}

type Stored = Omit<TtsSettings, 'fishApiKey' | 'elevenApiKey'> & {
  fishApiKeyEnc: string;
  elevenApiKeyEnc: string;
};

export function loadSettings(): TtsSettings {
  const p = settingsPath();
  if (!fs.existsSync(p)) {
    return {
      ...DEFAULT_TTS_SETTINGS,
      fishApiKey:
        process.env.FISH_AUDIO_API_KEY?.trim() ||
        process.env.FISH_API_KEY?.trim() ||
        '',
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Stored;
    return {
      provider: (raw.provider as TtsProviderId) || 'none',
      muted: Boolean(raw.muted),
      volume: typeof raw.volume === 'number' ? raw.volume : 80,
      fishApiKey:
        dec(raw.fishApiKeyEnc || '') ||
        process.env.FISH_AUDIO_API_KEY?.trim() ||
        process.env.FISH_API_KEY?.trim() ||
        '',
      fishReferenceId: raw.fishReferenceId || DEFAULT_TTS_SETTINGS.fishReferenceId,
      fishModel: raw.fishModel || DEFAULT_TTS_SETTINGS.fishModel,
      elevenApiKey: dec(raw.elevenApiKeyEnc || ''),
      elevenVoiceId: raw.elevenVoiceId || '',
      elevenModel: raw.elevenModel || DEFAULT_TTS_SETTINGS.elevenModel,
    };
  } catch {
    return { ...DEFAULT_TTS_SETTINGS };
  }
}

export function saveSettings(settings: TtsSettings): void {
  const stored: Stored = {
    provider: settings.provider,
    muted: settings.muted,
    volume: settings.volume,
    fishApiKeyEnc: enc(settings.fishApiKey),
    fishReferenceId: settings.fishReferenceId,
    fishModel: settings.fishModel,
    elevenApiKeyEnc: enc(settings.elevenApiKey),
    elevenVoiceId: settings.elevenVoiceId,
    elevenModel: settings.elevenModel,
  };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(stored, null, 2), 'utf8');
}

/** Vista segura para renderer (keys enmascaradas). */
export function settingsPublic(settings: TtsSettings) {
  return {
    ...settings,
    fishApiKey: settings.fishApiKey ? '********' : '',
    elevenApiKey: settings.elevenApiKey ? '********' : '',
    hasFishKey: Boolean(
      settings.fishApiKey ||
        process.env.FISH_AUDIO_API_KEY ||
        process.env.FISH_API_KEY,
    ),
    hasElevenKey: Boolean(settings.elevenApiKey),
  };
}
