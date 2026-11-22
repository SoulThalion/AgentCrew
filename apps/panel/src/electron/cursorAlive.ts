/**
 * ¿Hay proceso Cursor IDE? (para auto-quit del panel).
 */
import { execFile } from 'node:child_process';
import path from 'node:path';

function listNames(): Promise<string[]> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile(
        'tasklist',
        ['/FO', 'CSV', '/NH'],
        {
          windowsHide: true,
          timeout: 8000,
          maxBuffer: 4 * 1024 * 1024,
        },
        (err, stdout) => {
          if (err || !stdout) return resolve([]);
          const names: string[] = [];
          for (const line of String(stdout).split(/\r?\n/)) {
            const m = line.match(/^"([^"]+)"/);
            if (m?.[1]) names.push(m[1].replace(/\.exe$/i, ''));
          }
          resolve(names);
        },
      );
      return;
    }
    execFile('ps', ['-A', '-o', 'comm='], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      resolve(
        String(stdout)
          .split(/\n/)
          .map((s) => path.basename(s.trim()))
          .filter(Boolean),
      );
    });
  });
}

export async function isCursorAlive(): Promise<boolean> {
  const names = await listNames();
  return names.some((n) => n.toLowerCase() === 'cursor');
}
