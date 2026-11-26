import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import { sameSubnet24, pickLanIp, listPrivateLanIps } from '../src/lanIp.js';

describe('sameSubnet24', () => {
  it('misma /24', () => {
    expect(sameSubnet24('192.168.0.13', '192.168.0.14')).toBe(true);
  });
  it('otra /24', () => {
    expect(sameSubnet24('192.168.253.2', '192.168.0.14')).toBe(false);
  });
});

describe('pickLanIp / listPrivateLanIps', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      'Wi-Fi': [
        {
          address: '192.168.0.13',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '192.168.0.13/24',
        },
      ],
      'vEthernet (Default Switch)': [
        {
          address: '192.168.253.2',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:01',
          internal: false,
          cidr: '192.168.253.2/24',
        },
      ],
      Loopback: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8',
        },
      ],
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('lista privadas ordenadas 192.168 primero', () => {
    expect(listPrivateLanIps()).toEqual(['192.168.0.13', '192.168.253.2']);
  });

  it('announceIp fuerza', () => {
    expect(pickLanIp('10.0.0.5', '192.168.0.14')).toBe('10.0.0.5');
  });

  it('preferHost elige NIC misma /24 (issue #7)', () => {
    expect(pickLanIp('', '192.168.0.14')).toBe('192.168.0.13');
  });

  it('sin preferHost: primera 192.168 de la lista', () => {
    expect(pickLanIp('', '')).toBe('192.168.0.13');
  });
});
