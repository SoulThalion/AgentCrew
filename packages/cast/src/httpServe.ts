import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pickLanIp } from './lanIp.js';
import { DEFAULT_CAST_HTTP_PORT } from './types.js';

type Clip = { body: Buffer; name: string };

/**
 * HTTP efímero para Cast. Range 206 obligatorio (si no → audio entrecortado).
 * Solo sirve clips registrados (no listing de disco).
 */
export class CastHttpServer {
  private server: http.Server | null = null;
  private port = DEFAULT_CAST_HTTP_PORT;
  private announceIp = '';
  /** IP Cast device → pickLanIp elige NIC misma subred (issue #7). */
  private preferHost = '';
  private clips = new Map<string, Clip>();

  get listening(): boolean {
    return this.server?.listening === true;
  }

  get boundPort(): number {
    return this.port;
  }

  async start(
    port = DEFAULT_CAST_HTTP_PORT,
    announceIp = '',
    preferHost = '',
  ): Promise<void> {
    this.port = port > 0 ? port : DEFAULT_CAST_HTTP_PORT;
    this.announceIp = announceIp;
    this.preferHost = preferHost;
    if (this.server?.listening) return;

    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.port, '0.0.0.0', () => resolve());
    });
  }

  async stop(): Promise<void> {
    const s = this.server;
    this.server = null;
    this.clips.clear();
    if (!s) return;
    await new Promise<void>((resolve) => {
      s.close(() => resolve());
    });
  }

  /** Registra MP3 y devuelve URL LAN con cache-bust. */
  registerFile(absPath: string): string {
    if (!this.listening) {
      throw new Error('CastHttpServer no está listening');
    }
    const resolved = path.resolve(absPath);
    if (!fs.existsSync(resolved)) throw new Error(`MP3 no existe: ${resolved}`);
    const body = fs.readFileSync(resolved);
    if (body.length < 100) throw new Error(`MP3 vacío/corto: ${resolved}`);
    const id = createHash('sha256').update(body).digest('hex').slice(0, 16);
    const name = `frase-${id}.mp3`;
    this.clips.set(id, { body, name });
    const host = pickLanIp(this.announceIp, this.preferHost);
    return `http://${host}:${this.port}/${name}?v=${Date.now()}`;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0] || '/');
    const base = path.posix.basename(urlPath);
    const m = /^frase-([a-f0-9]{16})\.mp3$/i.exec(base);
    if (!m?.[1]) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const clip = this.clips.get(m[1].toLowerCase());
    if (!clip) {
      res.writeHead(404);
      res.end('not found');
      return;
    }

    const total = clip.body.length;
    const range = req.headers.range;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Connection', 'close');

    if (range) {
      const rm = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
      if (!rm) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }
      let start = rm[1] ? Number(rm[1]) : 0;
      let end = rm[2] ? Number(rm[2]) : total - 1;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }
      end = Math.min(end, total - 1);
      const slice = clip.body.subarray(start, end + 1);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': slice.length,
      });
      res.end(slice);
      return;
    }

    res.writeHead(200, { 'Content-Length': total });
    res.end(clip.body);
  }
}
