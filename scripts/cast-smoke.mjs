#!/usr/bin/env node
/**
 * Smoke Cast: MP3 AgentCrew → HTTP Range → Google Home.
 * Sin TTS Google. Usa @agentcrew/cast.
 *
 *   npm run cast:list
 *   npm run cast:smoke -- --host 192.168.0.14
 *   npm run cast:smoke -- --name "planta alta"
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function loadCast() {
  const dist = path.join(root, 'packages/cast/dist/index.js');
  if (fs.existsSync(dist)) return require(dist);
  throw new Error('Build @agentcrew/cast primero: npm run build -w @agentcrew/cast');
}

const {
  CastHttpServer,
  discoverCastDevices,
  matchCastDevice,
  playMp3OnCast,
  pickLanIp,
  DEFAULT_CAST_HTTP_PORT,
} = loadCast();

const DEFAULT_PHRASE = 'Señor, he terminado.';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function hashPhrase(frase) {
  return createHash('sha256').update(frase, 'utf8').digest('hex').slice(0, 16);
}

function resolveMp3() {
  const fileArg = arg('--file', '');
  if (fileArg) {
    const p = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
    if (!fs.existsSync(p)) throw new Error(`MP3 no existe: ${p}`);
    return p;
  }
  const p = path.join(root, 'voces', `frase-${hashPhrase(DEFAULT_PHRASE)}.mp3`);
  if (!fs.existsSync(p)) throw new Error(`Falta ${p}`);
  return p;
}

async function main() {
  console.log('AgentCrew cast-smoke — MP3 AgentCrew (no voz Google)\n');

  if (hasFlag('--list')) {
    console.log('Buscando Cast…');
    const devices = await discoverCastDevices(6000);
    for (const d of devices) console.log(`  · ${d.name} @ ${d.host}`);
    if (!devices.length) {
      console.log('Ninguno.');
      process.exit(1);
    }
    console.log(`Total: ${devices.length}`);
    return;
  }

  const mp3 = resolveMp3();
  const port = Number(arg('--port', String(DEFAULT_CAST_HTTP_PORT))) || DEFAULT_CAST_HTTP_PORT;
  const seconds = Number(arg('--seconds', '12')) || 12;
  const announce = arg('--announce', '');
  const srv = new CastHttpServer();
  await srv.start(port, announce);

  try {
    let host = arg('--host', '');
    const nameWant = arg('--name', '');
    if (!host || nameWant) {
      console.log('Buscando dispositivos…');
      const devices = await discoverCastDevices(6000);
      for (const d of devices) console.log(`  · ${d.name} @ ${d.host}`);
      const hit = matchCastDevice(devices, { host, name: nameWant });
      if (!hit) throw new Error('Sin dispositivo Cast');
      host = hit.host;
      console.log('Elegido:', hit.name, host);
    }

    const url = srv.registerFile(mp3);
    console.log('MP3:', mp3);
    console.log('HTTP:', url);
    console.log('LAN tip:', pickLanIp(announce));
    await playMp3OnCast({ host, mediaUrl: url, holdMs: seconds * 1000 });
    console.log('Listo. ¿Audio limpio AgentCrew?');
  } finally {
    await srv.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
