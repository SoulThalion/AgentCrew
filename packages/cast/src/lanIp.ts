import os from 'node:os';

function isV4(family: string | number): boolean {
  return family === 'IPv4' || family === 4;
}

function ipv4ToInt(ip: string): number | null {
  const p = ip.split('.').map((x) => Number(x));
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return (((p[0]! << 24) >>> 0) + (p[1]! << 16) + (p[2]! << 8) + p[3]!) >>> 0;
}

/** Misma subred /24 (suficiente para LAN doméstica Cast). */
export function sameSubnet24(a: string, b: string): boolean {
  const ai = ipv4ToInt(a);
  const bi = ipv4ToInt(b);
  if (ai == null || bi == null) return false;
  const mask = 0xffffff00;
  return (ai & mask) === (bi & mask);
}

function isPrivateLan(addr: string): boolean {
  if (addr.startsWith('169.254.')) return false; // link-local
  return (
    addr.startsWith('192.168.') ||
    addr.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(addr)
  );
}

/** IPv4 privadas no-internal (sin 169.254). Orden estable: 192.168 → 10 → 172.16. */
export function listPrivateLanIps(): string[] {
  const nets = os.networkInterfaces();
  const found: string[] = [];
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (!isV4(n.family) || n.internal) continue;
      if (!isPrivateLan(n.address)) continue;
      if (!found.includes(n.address)) found.push(n.address);
    }
  }
  const rank = (ip: string) => {
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.')) return 1;
    return 2;
  };
  return found.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * IPv4 LAN para que el altavoz alcance el HTTP del panel.
 * @param announceIp forzada (Settings)
 * @param preferHost IP del Chromecast → preferir NIC misma /24 (issue #7)
 */
export function pickLanIp(announceIp = '', preferHost = ''): string {
  const forced = announceIp.trim();
  if (forced) return forced;

  const candidates = listPrivateLanIps();
  const prefer = preferHost.trim();
  if (prefer) {
    const same = candidates.find((ip) => sameSubnet24(ip, prefer));
    if (same) return same;
  }
  if (candidates[0]) return candidates[0];

  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (isV4(n.family) && !n.internal && !n.address.startsWith('169.254.')) {
        return n.address;
      }
    }
  }
  return '127.0.0.1';
}
