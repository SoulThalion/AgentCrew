/**
 * Genera voces/frase-<hash>.mp3 vía Fish (key Settings safeStorage).
 * Uso: node scripts/gen-phrase-mp3.mjs [tipo]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tipo = process.argv[2] || 'todos';
const phrases = {
  todos: 'Señor, todos los agentes han terminado.',
  fin: 'Señor, he terminado.',
};
const text = phrases[tipo];
if (!text) {
  console.error('tipo desconocido', tipo);
  process.exit(1);
}

const hash = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
const outFile = path.join(root, 'voces', `frase-${hash}.mp3`);
console.log('frase', text);
console.log('hash', hash);
console.log('out', outFile);
if (fs.existsSync(outFile) && fs.statSync(outFile).size >= 1000) {
  console.log('ya existe');
  process.exit(0);
}

const settingsPath = path.join(
  process.env.APPDATA || '',
  '@agentcrew',
  'panel',
  'tts-settings.json',
);

const runner = path.join(root, 'scripts', '_gen-phrase-mp3-electron.cjs');
fs.writeFileSync(
  runner,
  `const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');

const TEXT = ${JSON.stringify(text)};
const OUT = ${JSON.stringify(outFile)};
const SETTINGS = ${JSON.stringify(settingsPath)};
const USER_DATA = ${JSON.stringify(path.dirname(settingsPath))};

// Misma userData que el panel → safeStorage puede descifrar la key
if (USER_DATA) {
  try { app.setPath('userData', USER_DATA); } catch {}
}

function dec(b64) {
  if (!b64) return '';
  if (!safeStorage.isEncryptionAvailable()) return b64;
  try { return safeStorage.decryptString(Buffer.from(b64, 'base64')); }
  catch (e) { console.error('decrypt fail', e.message); return ''; }
}

function postFish(key, ref, model, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      text, reference_id: ref, format: 'mp3', language: 'es',
      mp3_bitrate: 128, prosody: { speed: 0.95, volume: 0 },
    });
    const req = https.request({
      hostname: 'api.fish.audio', path: '/v1/tts', method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'audio/mpeg', model,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error('Fish HTTP', res.statusCode, buf.toString('utf8').slice(0, 200));
          resolve(null);
          return;
        }
        resolve(buf.length >= 1000 ? buf : null);
      });
    });
    req.on('error', (e) => { console.error(e); resolve(null); });
    req.write(body);
    req.end();
  });
}

app.whenReady().then(async () => {
  let key = process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY || '';
  let ref = '543e8fb49194469e97efc20e962c8670';
  let model = 's2.1-pro-free';
  if (fs.existsSync(SETTINGS)) {
    const raw = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
    key = dec(raw.fishApiKeyEnc || '') || key;
    if (raw.fishReferenceId) ref = raw.fishReferenceId;
    if (raw.fishModel) model = raw.fishModel;
  }
  if (!key) { console.error('Sin Fish API key'); app.exit(2); return; }
  console.log('key ok, ref', ref, 'model', model);
  let audio = null;
  for (const m of [model, 's2.1-pro-free', 's2.1-pro']) {
    audio = await postFish(key, ref, m, TEXT);
    if (audio) { console.log('modelo', m); break; }
  }
  if (!audio) { console.error('Fish TTS falló'); app.exit(3); return; }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, audio);
  console.log('OK', OUT, audio.length);
  app.exit(0);
});
`,
  'utf8',
);

const candidates = [
  path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'),
  path.join(root, 'apps', 'panel', 'node_modules', 'electron', 'dist', 'electron.exe'),
  path.join(
    'C:\\Users\\eomer\\AgentCrew-cleanbuild',
    'node_modules',
    'electron',
    'dist',
    'electron.exe',
  ),
];
const exe = candidates.find((p) => fs.existsSync(p));
if (!exe) {
  console.error('electron.exe no encontrado');
  process.exit(1);
}

const r = spawnSync(exe, [runner], { cwd: root, stdio: 'inherit' });
try {
  fs.unlinkSync(runner);
} catch {
  /* ignore */
}
process.exit(r.status ?? 1);
