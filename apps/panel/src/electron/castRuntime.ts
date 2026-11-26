import {
  CastHttpServer,
  DEFAULT_CAST_HTTP_PORT,
  discoverCastDevices,
  matchCastDevice,
  playMp3OnCast,
  type CastDevice,
} from '@agentcrew/cast';

const httpServer = new CastHttpServer();

export async function ensureCastHttp(
  port = DEFAULT_CAST_HTTP_PORT,
  announceIp = '',
  preferHost = '',
): Promise<void> {
  await httpServer.start(port, announceIp, preferHost);
}

export async function stopCastHttp(): Promise<void> {
  await httpServer.stop();
}

export function isCastHttpUp(): boolean {
  return httpServer.listening;
}

/** Registra MP3 y URL LAN (requiere ensureCastHttp). */
export function castUrlForMp3(absPath: string): string {
  return httpServer.registerFile(absPath);
}

export async function listCastDevices(timeoutMs = 5000): Promise<CastDevice[]> {
  return discoverCastDevices(timeoutMs);
}

export async function playMp3OnChosenCast(opts: {
  absPath: string;
  host?: string;
  name?: string;
  port?: number;
  announceIp?: string;
  holdMs?: number;
}): Promise<{ device: CastDevice; url: string }> {
  let host = opts.host?.trim() || '';
  let device: CastDevice | null = null;

  // Host ya elegido → no redescubrir (evita spinner + mDNS lento). Issue #7.
  if (host) {
    device = {
      name: (opts.name || '').trim() || host,
      host,
      port: 8009,
    };
  } else {
    const devices = await listCastDevices(5000);
    device = matchCastDevice(devices, { name: opts.name });
    if (!device) throw new Error('No hay dispositivo Cast');
    host = device.host;
  }

  // preferHost = Cast IP → NIC misma /24 en URL del MP3
  await ensureCastHttp(
    opts.port ?? DEFAULT_CAST_HTTP_PORT,
    opts.announceIp ?? '',
    host,
  );
  const url = castUrlForMp3(opts.absPath);
  await playMp3OnCast({ host, mediaUrl: url, holdMs: opts.holdMs });
  return { device, url };
}
