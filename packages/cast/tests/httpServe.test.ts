import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { CastHttpServer } from '../src/httpServe.js';

function get(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on('end', () =>
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        }),
      );
    });
    req.on('error', reject);
  });
}

describe('CastHttpServer', () => {
  let dir: string;
  let mp3: string;
  let srv: CastHttpServer;
  const port = 18791;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcrew-cast-'));
    mp3 = path.join(dir, 'clip.mp3');
    // payload ficticio >100 bytes
    fs.writeFileSync(mp3, Buffer.alloc(200, 0x41));
    srv = new CastHttpServer();
    await srv.start(port, '127.0.0.1');
  });

  afterEach(async () => {
    await srv.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('200 full + Range 206', async () => {
    const url = srv.registerFile(mp3);
    const full = await get(url);
    expect(full.status).toBe(200);
    expect(full.body.length).toBe(200);
    expect(full.headers['accept-ranges']).toBe('bytes');

    const part = await get(url, { Range: 'bytes=0-9' });
    expect(part.status).toBe(206);
    expect(part.body.length).toBe(10);
    expect(String(part.headers['content-range'])).toMatch(/^bytes 0-9\/200$/);
  });

  it('404 si id desconocido', async () => {
    const r = await get(`http://127.0.0.1:${port}/frase-0000000000000000.mp3`);
    expect(r.status).toBe(404);
  });
});
