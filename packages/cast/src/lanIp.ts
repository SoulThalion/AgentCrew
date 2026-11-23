import os from 'node:os';

/** IPv4 LAN para que el altavoz alcance el HTTP del panel. */
export function pickLanIp(announceIp = ''): string {
  const forced = announceIp.trim();
  if (forced) return forced;

  const nets = os.networkInterfaces();
  const isV4 = (family: string | number) => family === 'IPv4' || family === 4;
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (!isV4(n.family)) continue;
      if (n.internal) continue;
      if (
        n.address.startsWith('192.168.') ||
        n.address.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(n.address)
      ) {
        return n.address;
      }
    }
  }
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (isV4(n.family) && !n.internal) return n.address;
    }
  }
  return '127.0.0.1';
}
