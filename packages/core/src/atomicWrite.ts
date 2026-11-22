import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/** Escritura atómica: temp único + copy/rename (legado Escribir-Atomico). */
export function writeAtomic(
  filePath: string,
  text: string,
  encoding: BufferEncoding = 'utf8',
): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;
  const data =
    encoding === 'utf8' || encoding === 'utf-8'
      ? Buffer.from(text, 'utf8')
      : Buffer.from(text, encoding);

  fs.writeFileSync(tmp, data);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      try {
        fs.renameSync(tmp, filePath);
      } catch {
        fs.copyFileSync(tmp, filePath);
        fs.unlinkSync(tmp);
      }
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  throw lastErr instanceof Error ? lastErr : new Error(`No se pudo escribir ${filePath}`);
}

export function readText(filePath: string, encoding: BufferEncoding = 'utf8'): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, encoding).toString().trim();
  } catch {
    return null;
  }
}

export function removeFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}
