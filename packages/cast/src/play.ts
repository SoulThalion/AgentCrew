import { createRequire } from 'node:module';

const nodeRequire = createRequire(__filename);
const { Client, DefaultMediaReceiver } = nodeRequire('castv2-client') as {
  Client: new () => CastClient;
  DefaultMediaReceiver: unknown;
};

type CastClient = {
  connect: (host: string, cb: () => void) => void;
  launch: (
    app: unknown,
    cb: (err: Error | null, player: CastPlayer) => void,
  ) => void;
  close: () => void;
  on: (ev: string, cb: (err: Error) => void) => void;
};

type CastPlayer = {
  load: (
    media: Record<string, unknown>,
    opts: { autoplay: boolean },
    cb: (err: Error | null) => void,
  ) => void;
};

export type PlayCastOptions = {
  host: string;
  mediaUrl: string;
  /** Cerrar cliente tras N ms (default 8). */
  holdMs?: number;
  /** Timeout connect+load (default 12s). */
  connectTimeoutMs?: number;
  title?: string;
};

/**
 * Lanza MP3 por URL en Default Media Receiver.
 * No TTS Google: solo contentId = URL del MP3 AgentCrew.
 */
export function playMp3OnCast(opts: PlayCastOptions): Promise<void> {
  const holdMs = opts.holdMs ?? 8000;
  /** Connect+load: URL inalcanzable no debe colgar Settings (issue #7). */
  const connectTimeoutMs = opts.connectTimeoutMs ?? 12_000;
  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clear();
      try {
        client.close();
      } catch {
        /* ignore */
      }
      reject(err);
    };
    const ok = () => {
      if (settled) return;
      settled = true;
      clear();
      try {
        client.close();
      } catch {
        /* ignore */
      }
      resolve();
    };

    timer = setTimeout(() => {
      fail(
        new Error(
          `Cast timeout (${connectTimeoutMs}ms) host=${opts.host} url=${opts.mediaUrl}`,
        ),
      );
    }, connectTimeoutMs);

    client.on('error', fail);
    client.connect(opts.host, () => {
      client.launch(DefaultMediaReceiver, (err, player) => {
        if (err) return fail(err);
        const media = {
          contentId: opts.mediaUrl,
          contentType: 'audio/mpeg',
          streamType: 'BUFFERED',
          metadata: {
            type: 0,
            metadataType: 0,
            title: opts.title || 'AgentCrew',
            subtitle: 'MP3 AgentCrew (no Google TTS)',
          },
        };
        player.load(media, { autoplay: true }, (loadErr) => {
          if (loadErr) return fail(loadErr);
          clear();
          setTimeout(ok, holdMs);
        });
      });
    });
  });
}
