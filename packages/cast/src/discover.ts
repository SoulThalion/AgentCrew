import { createRequire } from 'node:module';
import type { CastDevice } from './types.js';

const nodeRequire = createRequire(__filename);
// CJS sin types oficiales
const Bonjour = nodeRequire('bonjour-service') as new () => {
  find: (opts: { type: string }) => {
    on: (ev: string, cb: (...args: unknown[]) => void) => void;
    stop: () => void;
  };
  destroy: () => void;
};

export function discoverCastDevices(timeoutMs = 5000): Promise<CastDevice[]> {
  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const found: CastDevice[] = [];
    const browser = bonjour.find({ type: 'googlecast' });
    const done = () => {
      try {
        browser.stop();
      } catch {
        /* ignore */
      }
      try {
        bonjour.destroy();
      } catch {
        /* ignore */
      }
      resolve(found);
    };
    setTimeout(done, timeoutMs);
    browser.on('up', (raw: unknown) => {
      const svc = raw as {
        name?: string;
        host?: string;
        port?: number;
        addresses?: string[];
        referer?: { address?: string | string[] };
        txt?: { fn?: string };
      };
      const host =
        (Array.isArray(svc.referer?.address) ? svc.referer.address[0] : svc.referer?.address) ||
        (Array.isArray(svc.addresses) ? svc.addresses.find((a) => a && !a.includes(':')) : null) ||
        svc.host;
      if (!host) return;
      const name = svc.txt?.fn || svc.name || host;
      if (found.some((d) => d.host === host)) return;
      found.push({ name: String(name), host: String(host), port: svc.port || 8009 });
    });
    browser.on('error', () => {
      /* timeout resuelve */
    });
  });
}

export function matchCastDevice(
  devices: CastDevice[],
  opts: { host?: string; name?: string },
): CastDevice | null {
  const host = opts.host?.trim();
  if (host) {
    const byHost = devices.find((d) => d.host === host);
    if (byHost) return byHost;
    return { name: host, host, port: 8009 };
  }
  const want = opts.name?.trim().toLowerCase();
  if (!want) return devices[0] ?? null;
  return devices.find((d) => d.name.toLowerCase().includes(want)) ?? null;
}
