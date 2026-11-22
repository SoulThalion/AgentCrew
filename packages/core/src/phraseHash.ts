import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * Hash de frase legacy: primeros 16 hex de SHA256(UTF-8(frase)).
 * Archivo: voces/frase-<hash>.mp3
 */
export function hashPhrase(frase: string): string {
  return createHash('sha256').update(frase, 'utf8').digest('hex').slice(0, 16);
}

export function recordedVoicePath(vocesDir: string, frase: string): string {
  return path.join(vocesDir, `frase-${hashPhrase(frase)}.mp3`);
}
