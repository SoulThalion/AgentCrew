/**
 * ¿Hay proceso Cursor IDE? (para auto-quit del panel).
 * tasklist filtrado + buffer chico (evita alloc 4MB por poll).
 * Fail-open: err/timeout → reusa caché o asume vivo (no quit por flaky tasklist).
 */
import { execFile } from 'node:child_process';
import path from 'node:path';

const CACHE_MS = 1500;
let cache: { at: number; alive: boolean } | null = null;

type Probe = { ok: true; alive: boolean } | { ok: false };

function cursorAliveWin(): Promise<Probe> {
  return new Promise((resolve) => {
    execFile(
      'tasklist',
      ['/FI', 'IMAGENAME eq Cursor.exe', '/NH'],
      {
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 64 * 1024,
        encoding: 'utf8',
      },
      (err, stdout) => {
        // Timeout / spawn fail → no sabemos; no tratar como muerto
        if (err) return resolve({ ok: false });
        const text = String(stdout ?? '');
        // Sin match: tasklist sale 0 con “INFO/INFORMACIÓN: no hay tareas…”
        resolve({ ok: true, alive: /Cursor\.exe/i.test(text) });
      },
    );
  });
}

function cursorAliveUnix(): Promise<Probe> {
  return new Promise((resolve) => {
    execFile(
      'ps',
      ['-A', '-o', 'comm='],
      { timeout: 5000, maxBuffer: 256 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        if (err || !stdout) return resolve({ ok: false });
        const alive = String(stdout)
          .split(/\n/)
          .some((s) => path.basename(s.trim()).toLowerCase() === 'cursor');
        resolve({ ok: true, alive });
      },
    );
  });
}

export async function isCursorAlive(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.alive;
  const probe =
    process.platform === 'win32'
      ? await cursorAliveWin()
      : await cursorAliveUnix();
  if (!probe.ok) {
    // Fail-open: mantener último valor; sin historial → vivo (no auto-quit)
    return cache?.alive ?? true;
  }
  cache = { at: now, alive: probe.alive };
  return probe.alive;
}
