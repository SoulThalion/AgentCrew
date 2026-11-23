export type CastDevice = {
  name: string;
  host: string;
  port: number;
};

/** Ajustes Cast (persisten con Settings TTS). */
export type CastSettings = {
  /** Default false — opt-in. */
  castEnabled: boolean;
  /** Si true, también playMp3 en PC. */
  castPlayLocal: boolean;
  castDeviceName: string;
  castDeviceHost: string;
  castHttpPort: number;
  /** '' = auto LAN. */
  castAnnounceIp: string;
};

export const DEFAULT_CAST_SETTINGS: CastSettings = {
  castEnabled: false,
  castPlayLocal: true,
  castDeviceName: '',
  castDeviceHost: '',
  castHttpPort: 18741,
  castAnnounceIp: '',
};

export const DEFAULT_CAST_HTTP_PORT = 18741;
