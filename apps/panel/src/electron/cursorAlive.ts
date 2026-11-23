/**
 * ¿Hay proceso Cursor IDE? (para auto-quit del panel).
 * tasklist filtrado + buffer chico (evita alloc 4MB por poll).
 */
import { execFile } from 'node:child_process';
import path from 'node:path';

const CACHE_MS = 800;
let cache: { at: number; alive: boolean } | null = null;

function cursorAliveWin(): Promise<boolean> {
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
        if (err || !stdout) return resolve(false);
        resolve(/Cursor\.exe/i.test(String(stdout)));
      },
    );
  });
}

function cursorAliveUnix(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'ps',
      ['-A', '-o', 'comm='],
      { timeout: 5000, maxBuffer: 256 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        if (err || !stdout) return resolve(false);
        const alive = String(stdout)
          .split(/\n/)
          .some((s) => path.basename(s.trim()).toLowerCase() === 'cursor');
        resolve(alive);
      },
    );
  });
}

export async function isCursorAlive(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.alive;
  const alive =
    process.platform === 'win32'
      ? await cursorAliveWin()
      : await cursorAliveUnix();
  cache = { at: now, alive };
  return alive;
}
