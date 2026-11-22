import { describe, expect, it } from 'vitest';
import * as dock from '../src/index.js';

describe('dock-windows', () => {
  it('exporta API', () => {
    expect(typeof dock.attach).toBe('function');
    expect(typeof dock.detach).toBe('function');
    expect(typeof dock.reposition).toBe('function');
    expect(typeof dock.isAttached).toBe('function');
  });

  it('isWindowsDock refleja plataforma', () => {
    expect(dock.isWindowsDock).toBe(process.platform === 'win32');
  });
});
