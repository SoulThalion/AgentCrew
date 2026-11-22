export type TtsProviderId = 'none' | 'fish' | 'elevenlabs';

export type TtsSettings = {
  provider: TtsProviderId;
  muted: boolean;
  volume: number;
  fishApiKey: string;
  fishReferenceId: string;
  fishModel: string;
  elevenApiKey: string;
  elevenVoiceId: string;
  elevenModel: string;
};

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  provider: 'none',
  muted: false,
  volume: 80,
  fishApiKey: '',
  fishReferenceId: '543e8fb49194469e97efc20e962c8670',
  fishModel: 's2.1-pro-free',
  elevenApiKey: '',
  elevenVoiceId: '',
  elevenModel: 'eleven_multilingual_v2',
};

export type SpeakResult = {
  ok: boolean;
  source: 'local' | 'cache' | 'fish' | 'elevenlabs' | 'system' | 'muted' | 'none';
  path?: string;
};
