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

let lastStart = 0;
/** Último tick: ¿Cursor vivo? Para detectar edge down→up. */
let cursorWas = null;

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

function panelRunning() {
  if (pidAlive(readPanelPid())) return true;
  // Tras spawn, Electron tarda en escribir panel.pid; evita multi-lanzar
  if (lastStart > 0 && Date.now() - lastStart < START_COOLDOWN_MS) return true;
  return false;
}

function listProcessNames() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile(
        'tasklist',
        ['/FI', 'IMAGENAME eq Cursor.exe', '/NH'],
        { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024 },
        (err, stdout) => {
          if (err || !stdout) return resolve([]);
          resolve(/Cursor\.exe/i.test(String(stdout)) ? ['Cursor'] : []);
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

async function cursorRunning() {
  const names = await listProcessNames();
  return names.some((n) => n.toLowerCase() === 'cursor');
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

function startPanel() {
  if (Date.now() - lastStart < START_COOLDOWN_MS) return;
  if (panelRunning()) return;
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

  // Edge Cursor off→on: usuario cerró panel; ahora IDE vuelve → permitir auto-start
  if (cursorWas === false && cursor === true) {
    clearUserClosed();
  }
  if (cursorWas === null) {
    // Primer tick: no limpiar latch (respeta cierre previo si Cursor ya estaba)
    cursorWas = cursor;
  } else {
    cursorWas = cursor;
  }

  if (!cursor) return;
  if (userClosed()) return;
  if (!panelRunning()) startPanel();
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
