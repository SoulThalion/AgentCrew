#!/usr/bin/env node
/**
 * Watcher AgentCrew ↔ Cursor IDE.
 * - Si Cursor corre y el panel no → arranca panel.
 * - Si el usuario cerró el panel (panel-user-closed.txt) → no relanza
 *   hasta que Cursor desaparezca y vuelva (edge up).
 * - El panel se auto-cierra cuando Cursor desaparece (grace).
 * Instalación: scripts/install-cursor-watch.mjs → Startup de Windows.
 */
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = path.dirname(fileURLToPath(import.meta.url));
const stateDir =
  process.env.AGENTCREW_STATE_DIR ||
  path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor',
    'hooks',
    'state',
  );
const launchPath = path.join(hooksDir, 'panel-launch.json');
const offPath = path.join(stateDir, 'watch-off.txt');
const panelPidPath = path.join(stateDir, 'panel.pid');
const userClosedPath = path.join(stateDir, 'panel-user-closed.txt');
const watchPidPath = path.join(stateDir, 'cursor-watch.pid');
const logPath = path.join(stateDir, 'cursor-watch.log');

const POLL_MS = 2000;
const START_COOLDOWN_MS = 15_000;
/** Tras Cursor muerto confirmado, pedir al panel que salga (backup auto-quit). */
const CLOSE_PANEL_GRACE_MS = 10_000;
/** Cache probe: menos spam tasklist + suaviza flakes cortos. */
const PROBE_CACHE_MS = 1500;

let lastStart = 0;
/** Último tick: ¿Cursor vivo? Para detectar edge down→up. */
let cursorWas = null;
/** Desde cuándo Cursor no aparece (para cerrar.txt). */
let cursorGoneSince = 0;
/** Última sonda fiable (fail-open reusa esto). */
let probeCache = null;

function claimWatchLock() {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    if (fs.existsSync(watchPidPath)) {
      const prev = Number.parseInt(fs.readFileSync(watchPidPath, 'utf8').trim(), 10);
      if (pidAlive(prev) && prev !== process.pid) {
        log(`ya hay watcher pid=${prev}; salgo`);
        process.exit(0);
      }
    }
    fs.writeFileSync(watchPidPath, String(process.pid), 'utf8');
  } catch (e) {
    log(`lock fail: ${e instanceof Error ? e.message : e}`);
  }
}

function releaseWatchLock() {
  try {
    const cur = Number.parseInt(fs.readFileSync(watchPidPath, 'utf8').trim(), 10);
    if (cur === process.pid) fs.unlinkSync(watchPidPath);
  } catch {
    /* ignore */
  }
}

function log(msg) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    const line = `${new Date().toISOString()} ${msg}\n`;
    fs.appendFileSync(logPath, line, 'utf8');
    const st = fs.statSync(logPath);
    if (st.size > 200_000) {
      const keep = fs.readFileSync(logPath, 'utf8').slice(-80_000);
      fs.writeFileSync(logPath, keep, 'utf8');
    }
  } catch {
    /* ignore */
  }
}

function disabled() {
  return fs.existsSync(offPath);
}

function userClosed() {
  return fs.existsSync(userClosedPath);
}

function clearUserClosed() {
  try {
    if (fs.existsSync(userClosedPath)) {
      fs.unlinkSync(userClosedPath);
      log('cleared panel-user-closed (Cursor edge up)');
    }
  } catch {
    /* ignore */
  }
}

function pidAlive(pid) {
  if (!pid || !Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Evita PID reciclado / hint spawn que no es el panel. */
function pidLooksLikePanel(pid) {
  if (!pidAlive(pid)) return false;
  if (process.platform !== 'win32') return true;
  return new Promise((resolve) => {
    execFile(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true, timeout: 4000, maxBuffer: 32 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve(false);
        const t = String(stdout);
        // CSV: "electron.exe","1234",...
        resolve(/electron\.exe|AgentCrew\.exe/i.test(t));
      },
    );
  });
}

function readPanelPid() {
  try {
    const n = Number.parseInt(fs.readFileSync(panelPidPath, 'utf8').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writePanelPidHint(pid) {
  if (!pid) return;
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(panelPidPath, String(pid), 'utf8');
  } catch {
    /* ignore */
  }
}

async function panelRunning() {
  const pid = readPanelPid();
  if (pid && (await pidLooksLikePanel(pid))) return true;
  // Tras spawn, Electron tarda en escribir panel.pid; evita multi-lanzar
  if (lastStart > 0 && Date.now() - lastStart < START_COOLDOWN_MS) return true;
  return false;
}

/**
 * Sonda Cursor.exe / proceso Cursor.
 * @returns {Promise<{ ok: true, alive: boolean } | { ok: false }>}
 * Fail: timeout/spawn → ok:false (NO mapear a muerto; issue #4).
 */
function probeCursor() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile(
        'tasklist',
        ['/FI', 'IMAGENAME eq Cursor.exe', '/NH'],
        { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024 },
        (err, stdout) => {
          if (err) return resolve({ ok: false });
          resolve({ ok: true, alive: /Cursor\.exe/i.test(String(stdout ?? '')) });
        },
      );
      return;
    }
    execFile('ps', ['-A', '-o', 'comm='], { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({ ok: false });
      if (!stdout) return resolve({ ok: true, alive: false });
      const alive = String(stdout)
        .split(/\n/)
        .some((s) => path.basename(s.trim()).toLowerCase() === 'cursor');
      resolve({ ok: true, alive });
    });
  });
}

/** ¿Cursor vivo? Probe fail → cache / último tick / asume vivo (paridad panel). */
async function cursorRunning() {
  const now = Date.now();
  if (probeCache && now - probeCache.at < PROBE_CACHE_MS) {
    return probeCache.alive;
  }
  const probe = await probeCursor();
  if (!probe.ok) {
    if (probeCache) return probeCache.alive;
    if (cursorWas === true) return true;
    if (cursorWas === false) return false;
    return true; // sin historial → fail-open (no cerrar.txt por flake)
  }
  probeCache = { at: now, alive: probe.alive };
  return probe.alive;
}

function loadLaunch() {
  try {
    const raw = JSON.parse(fs.readFileSync(launchPath, 'utf8'));
    if (!raw?.command || !fs.existsSync(raw.command)) return null;
    return {
      command: String(raw.command),
      args: Array.isArray(raw.args) ? raw.args.map(String) : [],
      cwd: raw.cwd && fs.existsSync(raw.cwd) ? String(raw.cwd) : path.dirname(raw.command),
    };
  } catch {
    return null;
  }
}

function requestPanelShow() {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'mostrar.txt'), '1', 'utf8');
    log('mostrar.txt (Cursor up / panel ya corría)');
  } catch {
    /* ignore */
  }
}

function requestPanelClose() {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'cerrar.txt'), '1', 'utf8');
    log('cerrar.txt (Cursor gone)');
  } catch {
    /* ignore */
  }
}

async function startPanel() {
  if (Date.now() - lastStart < START_COOLDOWN_MS) return;
  if (await panelRunning()) return;
  const launch = loadLaunch();
  if (!launch) {
    log('sin panel-launch.json válido');
    return;
  }
  lastStart = Date.now();
  try {
    const child = spawn(launch.command, launch.args, {
      cwd: launch.cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env },
    });
    // Hint inmediato: evita spam cada 15s si el panel no escribe panel.pid
    if (child.pid) writePanelPidHint(child.pid);
    child.unref();
    log(`start panel pid=${child.pid} cmd=${launch.command}`);
  } catch (e) {
    log(`start fail: ${e instanceof Error ? e.message : e}`);
  }
}

async function tick() {
  if (disabled()) return;
  const cursor = await cursorRunning();
  const panelUp = await panelRunning();

  // Edge Cursor off→on: permitir auto-start + mostrar si panel quedó oculto
  if (cursorWas === false && cursor === true) {
    clearUserClosed();
    if (panelUp) requestPanelShow();
  }
  // Primer tick con Cursor ya abierto + panel vivo → mostrar (no solo “ya corre”)
  if (cursorWas === null && cursor && panelUp && !userClosed()) {
    requestPanelShow();
  }
  cursorWas = cursor;

  if (!cursor) {
    if (!cursorGoneSince) cursorGoneSince = Date.now();
    if (panelUp && Date.now() - cursorGoneSince >= CLOSE_PANEL_GRACE_MS) {
      requestPanelClose();
    }
    return;
  }

  cursorGoneSince = 0;
  if (userClosed()) return;
  if (!panelUp) await startPanel();
}
claimWatchLock();
process.on('exit', releaseWatchLock);
process.on('SIGINT', () => {
  releaseWatchLock();
  process.exit(0);
});
process.on('SIGTERM', () => {
  releaseWatchLock();
  process.exit(0);
});

log('watch start');
void tick();
setInterval(() => {
  void tick();
}, POLL_MS);
