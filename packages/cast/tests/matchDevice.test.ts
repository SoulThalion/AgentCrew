import { describe, it, expect } from 'vitest';
import { matchCastDevice } from '../src/discover.js';
import type { CastDevice } from '../src/types.js';

const devices: CastDevice[] = [
  { name: 'Chromecast B', host: '192.168.0.19', port: 8009 },
  { name: 'Chromecast planta alta', host: '192.168.0.14', port: 8009 },
];

describe('matchCastDevice', () => {
  it('por nombre parcial', () => {
    const d = matchCastDevice(devices, { name: 'planta alta' });
    expect(d?.host).toBe('192.168.0.14');
  });

  it('por host', () => {
    const d = matchCastDevice(devices, { host: '192.168.0.19' });
    expect(d?.name).toBe('Chromecast B');
  });

  it('host desconocido → stub', () => {
    const d = matchCastDevice(devices, { host: '10.0.0.9' });
    expect(d).toEqual({ name: '10.0.0.9', host: '10.0.0.9', port: 8009 });
  });
});
