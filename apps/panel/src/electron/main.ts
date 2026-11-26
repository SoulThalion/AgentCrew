import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {
  defaultStateDir,
  composeChats,
  recordedVoicePath,
  type AgentSlot,
  STATE_COLORS,
  STATE_LABELS,
  isAgentState,
} from '@agentcrew/core';
import {
  ensureDirs,
  speakTipo,
  resolveAndSpeak,
  type SpeakOptions,
} from '@agentcrew/tts';
import {
  defaultAppSettings,
  loadSettings,
  saveSettings,
  settingsPublic,
  type AppSettings,
} from './settingsStore';
import { listPrivateLanIps, pickLanIp } from '@agentcrew/cast';
import { listCastDevices, playMp3OnChosenCast, stopCastHttp } from './castRuntime';
import { cursorShowsShellApprovalUi } from './shellApprovalUi';
import { loadPanelPrefs, savePanelPrefs, type PanelPrefs } from './panelPrefs';
import {
  loadStatePrefs,
  setMuted as writeMuted,
  setMuestra as writeMuestra,
  type PanelStatePrefs,
} from './statePrefs';
import { createTray, destroyTray, refreshTray } from './trayMenu';
import { focusCursorWindow } from './focusCursor';
import { openCursorChat } from './openChat';
import { destroyHoverCard, hideHoverCard, showHoverCard } from './hoverCard';
import {
  disposeUiaScraper,
  getFocusedAgentIds,
  getFocusedChatTitles,
  getUiChatTitles,
  learnTitlesOnce,
  noteFocusedAgentId,
} from './learnTitles';
import { readUsoLabels, refreshCursorUsage } from './cursorUsage';
import { announceUsoThresholds } from './usoAlerts';
import { isCursorAlive } from './cursorAlive';
import {
  createAllDoneTracker,
  noteDoneSonars,
  noteWorkingCount,
  takeAllDoneAnnounce,
} from './allDoneAviso';
import { pathToFileURL } from 'node:url';
import { readTitulo, writeTitulo } from '@agentcrew/core';

const STRIP_WIDTH = 72;
/**
 * Sin Cursor confirmado → auto-quit tras grace.
 * ≥10s: varios ticks fallidos seguidos; evita bucle quit/relanzar si tasklist
 * falla bajo carga (issue #1). Watcher reabre al volver el IDE.
 */
/** Auto-quit si Cursor.exe no aparece. Watcher también escribe cerrar.txt ~5s. */
const CURSOR_GONE_GRACE_MS = 8_000;
const gotLock = app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let cursorGoneSince = 0;
let lastPayload = '';
let ttsSettings: AppSettings = defaultAppSettings();
const allDoneTracker = createAllDoneTracker();
let speakChain: Promise<void> = Promise.resolve();

function enqueueSpeak(fn: () => Promise<unknown>): void {
  speakChain = speakChain.then(() => fn()).then(() => undefined).catch(() => undefined);
}

function countRunFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('run-') && name.endsWith('.txt')) n++;
  }
  return n;
}
let panelPrefs: PanelPrefs = { displayId: null };
let statePrefs: PanelStatePrefs = loadStatePrefsFallback();
let dockApi: {
  attach: (...args: unknown[]) => void;
  detach: () => void;
  reposition: (...args: unknown[]) => void;
  setMonitor?: (
    rc: { left: number; top: number; right: number; bottom: number },
    scaleFactor?: number,
  ) => void;
  isAttached: () => boolean;
} | null = null;

function stateDir(): string {
  return process.env.AGENTCREW_STATE_DIR || defaultStateDir();
}

function loadStatePrefsFallback(): PanelStatePrefs {
  try {
    return loadStatePrefs(stateDir());
  } catch {
    return {
      muted: false,
      muteUntil: null,
      volume: 100,
      aviso: 'voz',
      cuando: 'inactivo',
      muestra: false,
    };
  }
}

function syncTtsFromState(): void {
  statePrefs = loadStatePrefs(stateDir());
  ttsSettings = {
    ...ttsSettings,
    muted: statePrefs.muted,
    volume: statePrefs.volume,
  };
}

function trayHooks() {
  return {
    stateDir,
    showPanel: () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
        return;
      }
      layoutWindow(mainWindow);
      mainWindow.show();
      if (!dockApi?.isAttached()) attachDock(mainWindow);
    },
    hidePanel: () => {
      try {
        dockApi?.detach();
      } catch {
        /* ignore */
      }
      dockApi = null;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    },
    isPanelVisible: () =>
      Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()),
    openSettings,
    testVoice: (tipo: string) => {
      syncTtsFromState();
      void speakTipo(
        tipo,
        ttsSettings,
        speakPaths(),
        statePrefs.aviso,
        speakCastOpts(),
      );
    },
    onPrefs: (p: PanelStatePrefs) => {
      statePrefs = p;
      syncTtsFromState();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('prefs:update', p);
      }
    },
    quitPanel: () => {
      markUserClosedPanel();
      app.quit();
    },
  };
}

function repoRoot(): string {
  // Empaquetado: voces en resources/; dev: raíz monorepo
  if (app.isPackaged) return process.resourcesPath;
  return path.resolve(__dirname, '..', '..', '..');
}

function speakPaths() {
  const voces = path.join(repoRoot(), 'voces');
  const cache = path.join(stateDir(), 'tts-cache');
  ensureDirs({ vocesDir: voces, cacheDir: cache });
  return { vocesDir: voces, cacheDir: cache };
}

/** Cast on → afterMp3; playLocal según «También en este PC». */
function speakCastOpts(): SpeakOptions | undefined {
  if (!ttsSettings.castEnabled) return undefined;
  const playLocal = ttsSettings.castPlayLocal;
  return {
    playLocal,
    afterMp3: async (absPath) => {
      try {
        await playMp3OnChosenCast({
          absPath,
          host: ttsSettings.castDeviceHost,
          name: ttsSettings.castDeviceName,
          port: ttsSettings.castHttpPort,
          announceIp: ttsSettings.castAnnounceIp,
          holdMs: 8_000,
        });
      } catch (err) {
        console.warn(
          '[cast]',
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  };
}

/** Paridad Avisar-Umbral-Uso tras refrescar / leer uso.txt. */
function maybeAnnounceUso(): void {
  syncTtsFromState();
  announceUsoThresholds(stateDir(), {
    canSpeak: statePrefs.aviso === 'voz' && !statePrefs.muted,
    speak: (phrase) => {
      void resolveAndSpeak(phrase, ttsSettings, speakPaths(), speakCastOpts());
    },
  });
}

function isDev(): boolean {
  return process.env.AGENTCREW_PANEL_DEV === '1';
}

function agentsPayload(): string {
  const agents = composeChats(stateDir(), {
    uiTitles: getUiChatTitles(),
    focusedTitles: getFocusedChatTitles(),
    focusedIds: getFocusedAgentIds(),
  }).map((a: AgentSlot) => {
    const state = a.state;
    const color =
      isAgentState(state) && STATE_COLORS[state]
        ? STATE_COLORS[state]
        : '#8A8A8A';
    const label =
      isAgentState(state) && STATE_LABELS[state]
        ? STATE_LABELS[state]
        : String(state);
    return {
      id: a.id,
      state,
      title: a.title,
      phrase: a.phrase,
      order: a.order,
      subagentCount: a.subagentCount,
      color,
      label,
      focused: Boolean(a.focused),
    };
  });
  const uso = readUsoLabels(stateDir());
  return JSON.stringify({ agents, stateDir: stateDir(), uso });
}

function pushAgents(force = false): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const payload = agentsPayload();
  if (!force && payload === lastPayload) return;
  lastPayload = payload;
  mainWindow.webContents.send('agents:update', payload);
}

function resolveDisplay() {
  const primary = screen.getPrimaryDisplay();
  if (panelPrefs.displayId == null) return primary;
  const found = screen.getAllDisplays().find((d) => d.id === panelPrefs.displayId);
  return found ?? primary;
}

/** Bounds DIP → rect físico Win32 AppBar. */
function physicalMonitorRc(d: Electron.Display) {
  const r = screen.dipToScreenRect(null, {
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
  });
  return {
    left: r.x,
    top: r.y,
    right: r.x + r.width,
    bottom: r.y + r.height,
  };
}

function workArea() {
  const d = resolveDisplay();
  return { x: d.workArea.x, y: d.workArea.y, width: d.workArea.width, height: d.workArea.height };
}

function placeStripFallback(win: BrowserWindow): void {
  const a = workArea();
  win.setBounds({
    x: a.x + a.width - STRIP_WIDTH,
    y: a.y,
    width: STRIP_WIDTH,
    height: a.height,
  });
}

function applyDockMonitor(): void {
  const d = resolveDisplay();
  if (!dockApi?.isAttached()) {
    if (mainWindow && !mainWindow.isDestroyed()) placeStripFallback(mainWindow);
    return;
  }
  if (dockApi.setMonitor) {
    dockApi.setMonitor(physicalMonitorRc(d), d.scaleFactor || 1);
  } else {
    dockApi.reposition();
  }
}

function layoutWindow(win: BrowserWindow): void {
  if (dockApi?.isAttached()) {
    try {
      applyDockMonitor();
    } catch {
      placeStripFallback(win);
    }
  } else {
    placeStripFallback(win);
  }
}

function attachDock(win: BrowserWindow): void {
  try {
    const d = resolveDisplay();
    if (process.platform === 'win32') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      dockApi = require('@agentcrew/dock-windows');
      // AppBar = px físicos; arranque = primary salvo preferencia usuario
      dockApi!.attach(win, STRIP_WIDTH, {
        scaleFactor: d.scaleFactor || 1,
        monitorRc: physicalMonitorRc(d),
      });
    } else if (process.platform === 'darwin') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      dockApi = require('@agentcrew/dock-macos');
      dockApi!.attach(win, STRIP_WIDTH, workArea());
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      dockApi = require('@agentcrew/dock-linux');
      dockApi!.attach(win, STRIP_WIDTH, workArea());
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      fs.appendFileSync(
        path.join(stateDir(), 'panel-error.log'),
        `${new Date().toISOString()} dock: ${msg}\n`,
      );
    } catch {
      /* ignore */
    }
    placeStripFallback(win);
  }
}

function listDisplaysPublic() {
  const primaryId = screen.getPrimaryDisplay().id;
  const current = resolveDisplay();
  return {
    currentId: current.id,
    primaryId,
    displays: screen.getAllDisplays().map((d) => ({
      id: d.id,
      label:
        d.id === primaryId
          ? `Principal (${d.size.width}×${d.size.height})`
          : `Pantalla ${d.id} (${d.size.width}×${d.size.height})`,
      primary: d.id === primaryId,
    })),
  };
}

function panelPidPath(): string {
  return path.join(stateDir(), 'panel.pid');
}

function writePanelPid(): void {
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(panelPidPath(), String(process.pid), 'utf8');
  } catch {
    /* ignore */
  }
}

function clearPanelPid(): void {
  // Solo borrar si el PID es el nuestro (2ª instancia no debe tocar el archivo)
  try {
    const cur = Number.parseInt(fs.readFileSync(panelPidPath(), 'utf8').trim(), 10);
    if (cur === process.pid) fs.unlinkSync(panelPidPath());
  } catch {
    /* ignore */
  }
}

/** Usuario cerró a propósito → watcher no relanza hasta que Cursor se apague y vuelva. */
function markUserClosedPanel(): void {
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(path.join(stateDir(), 'panel-user-closed.txt'), '1', 'utf8');
  } catch {
    /* ignore */
  }
}

function consumeMostrar(): void {
  const file = path.join(stateDir(), 'mostrar.txt');
  try {
    if (!fs.existsSync(file)) return;
    fs.unlinkSync(file);
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }
    // Tras panel:stop el dock se detachó — reenganchar (no solo show).
    layoutWindow(mainWindow);
    mainWindow.show();
    mainWindow.focus();
    if (!dockApi?.isAttached()) attachDock(mainWindow);
  } catch {
    /* ignore */
  }
}

function consumeCerrar(): void {
  const file = path.join(stateDir(), 'cerrar.txt');
  try {
    if (!fs.existsSync(file)) return;
    fs.unlinkSync(file);
    app.quit();
  } catch {
    /* ignore */
  }
}

function followCursorEnabled(): boolean {
  if (process.env.AGENTCREW_FOLLOW_CURSOR === '0') return false;
  return !fs.existsSync(path.join(stateDir(), 'watch-off.txt'));
}

function checkCursorStillThere(): void {
  if (!followCursorEnabled()) return;
  void isCursorAlive().then((alive) => {
    if (alive) {
      cursorGoneSince = 0;
      return;
    }
    if (!cursorGoneSince) cursorGoneSince = Date.now();
    if (Date.now() - cursorGoneSince >= CURSOR_GONE_GRACE_MS) {
      try {
        fs.appendFileSync(
          path.join(stateDir(), 'panel-error.log'),
          `${new Date().toISOString()} quit: Cursor gone ≥${CURSOR_GONE_GRACE_MS}ms\n`,
          'utf8',
        );
      } catch {
        /* ignore */
      }
      app.quit();
    }
  });
}

function consumeAjustes(): void {
  const file = path.join(stateDir(), 'ajustes.txt');
  try {
    if (!fs.existsSync(file)) return;
    fs.unlinkSync(file);
    openSettings();
  } catch {
    /* ignore */
  }
}

/** stop/error espurio → sonar solo si no hubo re-prompt (~6 s). */
function confirmPendingErrors(): void {
  const dir = stateDir();
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('error-pending-') || !name.endsWith('.txt')) continue;
    const id = name.slice('error-pending-'.length, -'.txt'.length);
    const full = path.join(dir, name);
    let at = 0;
    try {
      at = Number.parseInt(fs.readFileSync(full, 'utf8').trim(), 10);
    } catch {
      continue;
    }
    if (!Number.isFinite(at) || now - at < 6_000) continue;
    try {
      fs.unlinkSync(full);
    } catch {
      /* ignore */
    }
    // Re-prompt → run-* vuelve; chat siguió → no avisar
    if (fs.existsSync(path.join(dir, `run-${id}.txt`))) continue;
    try {
      const est = fs.readFileSync(path.join(dir, `estado-${id}.txt`), 'utf8');
      const st = est.split('|')[0]?.trim() ?? '';
      if (
        st === 'trabajando' ||
        st === 'planificando' ||
        st === 'leyendo' ||
        st === 'esperando' ||
        st === 'subagentes'
      ) {
        continue;
      }
    } catch {
      /* sin estado → confirmar error */
    }
    try {
      const line = `error|${new Date().toISOString()}`;
      fs.writeFileSync(path.join(dir, `estado-${id}.txt`), line, 'utf8');
      fs.writeFileSync(path.join(dir, `sonar-${id}.txt`), 'error', 'utf8');
    } catch {
      /* ignore */
    }
  }
}

/** shell-antes marca aprobación; auto-run limpia en afterShell.
 * Tras grace + UIA (Run/Skip) → card real → sonar (issue #8). */
const SHELL_APPROVAL_GRACE_MS = 1500;
let approvalConfirmBusy = false;

async function confirmPendingApprovals(): Promise<void> {
  if (approvalConfirmBusy) return;
  const dir = stateDir();
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  const candidates: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('aprobacion-') || !name.endsWith('.txt')) continue;
    if (name.startsWith('aprobacion-said-')) continue;
    const id = name.slice('aprobacion-'.length, -'.txt'.length);
    if (!id) continue;
    const said = path.join(dir, `aprobacion-said-${id}.txt`);
    if (fs.existsSync(said)) continue;
    const full = path.join(dir, name);
    let at = 0;
    try {
      const raw = fs.readFileSync(full, 'utf8').trim();
      at = Number.parseInt(raw, 10);
      if (!Number.isFinite(at)) at = fs.statSync(full).mtimeMs;
    } catch {
      continue;
    }
    if (now - at < SHELL_APPROVAL_GRACE_MS) continue;
    // Sin shell-* → ya corrió / canceló; no sonar
    if (!fs.existsSync(path.join(dir, `shell-${id}.txt`))) {
      try {
        fs.unlinkSync(full);
      } catch {
        /* ignore */
      }
      continue;
    }
    candidates.push(id);
  }
  if (candidates.length === 0) return;

  approvalConfirmBusy = true;
  try {
    // Win: UIA Run/Skip evita falso + en auto-run largo. Otros SO: grace sola.
    const ui =
      process.platform === 'win32' ? await cursorShowsShellApprovalUi() : true;
    if (!ui) return; // auto-run / sin card → reintentar o afterShell limpia
    const t = Date.now();
    for (const id of candidates) {
      const said = path.join(dir, `aprobacion-said-${id}.txt`);
      if (fs.existsSync(said)) continue;
      if (!fs.existsSync(path.join(dir, `shell-${id}.txt`))) continue;
      try {
        fs.writeFileSync(said, String(t), 'utf8');
        fs.writeFileSync(path.join(dir, `sonar-${id}.txt`), 'aprobacion', 'utf8');
      } catch {
        /* ignore */
      }
    }
  } finally {
    approvalConfirmBusy = false;
  }
}

function consumeSonar(): void {
  const dir = stateDir();
  if (!fs.existsSync(dir)) return;
  confirmPendingErrors();
  void confirmPendingApprovals().then(() => {
    // Sonar escrito async → siguiente tick consume; también intento inmediato
    drainSonarFiles();
  });
  drainSonarFiles();
}

function drainSonarFiles(): void {
  const dir = stateDir();
  if (!fs.existsSync(dir)) return;
  syncTtsFromState();
  const tipos: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('sonar-') || !name.endsWith('.txt')) continue;
    const full = path.join(dir, name);
    try {
      const tipo = fs.readFileSync(full, 'utf8').trim() || 'fin';
      fs.unlinkSync(full);
      tipos.push(tipo);
    } catch {
      /* ignore */
    }
  }
  const working = countRunFiles(dir);
  noteWorkingCount(allDoneTracker, working);
  noteDoneSonars(allDoneTracker, tipos);
  for (const tipo of tipos) {
    enqueueSpeak(() =>
      speakTipo(
        tipo,
        ttsSettings,
        speakPaths(),
        statePrefs.aviso,
        speakCastOpts(),
      ),
    );
  }
  if (takeAllDoneAnnounce(allDoneTracker, working, statePrefs.cuando)) {
    enqueueSpeak(() =>
      speakTipo(
        'todos',
        ttsSettings,
        speakPaths(),
        statePrefs.aviso,
        speakCastOpts(),
      ),
    );
  }
}

function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 440,
    height: 600,
    minWidth: 360,
    minHeight: 420,
    title: 'Ajustes TTS',
    backgroundColor: '#18181b',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Fiable: hash/query a veces no llegan a React en file://
      additionalArguments: ['--agentcrew-page=settings'],
    },
  });
  const indexHtml = path.join(__dirname, '..', 'dist-renderer', 'index.html');
  if (isDev()) {
    void settingsWindow.loadURL('http://127.0.0.1:5173/?page=settings#settings');
  } else {
    void settingsWindow.loadURL(`${pathToFileURL(indexHtml).href}?page=settings#settings`);
  }
  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
    settingsWindow?.focus();
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: STRIP_WIDTH,
    height: 800,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    title: '',
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  // Evita caption vertical "AgentCrew" en franja estrecha (Windows)
  mainWindow.setTitle('');
  mainWindow.setMenuBarVisibility(false);

  // Win32: no placeStripFallback antes del AppBar (setBounds clampa workArea → hueco vacío)
  if (process.platform !== 'win32') {
    placeStripFallback(mainWindow);
  }

  if (isDev()) {
    void mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    attachDock(mainWindow);
  });

  mainWindow.on('closed', () => {
    try {
      dockApi?.detach();
    } catch {
      /* ignore */
    }
    dockApi = null;
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    pushAgents(true);
    void learnTitlesOnce(stateDir()).then(() => pushAgents(true));
    if (dockApi?.isAttached()) {
      setTimeout(() => dockApi?.reposition(), 100);
    }
  });
}

function logMemSample(): void {
  try {
    const mu = process.memoryUsage();
    const line =
      `${new Date().toISOString()} mem rss=${Math.round(mu.rss / 1e6)}` +
      ` heap=${Math.round(mu.heapUsed / 1e6)}/` +
      `${Math.round(mu.heapTotal / 1e6)}` +
      ` ext=${Math.round(mu.external / 1e6)}` +
      ` ab=${Math.round((mu.arrayBuffers || 0) / 1e6)}\n`;
    fs.appendFileSync(path.join(stateDir(), 'panel-error.log'), line, 'utf8');
  } catch {
    /* ignore */
  }
}

function startWatchers(): void {
  if (pollTimer) clearInterval(pollTimer);
  let learnTick = 0;
  // 1.6s: menos CPU; scrape UIA adaptativo (activo ~6.4s / idle ~12.8s)
  const POLL_MS = 1600;
  logMemSample();
  pollTimer = setInterval(() => {
    pushAgents();
    consumeMostrar();
    consumeCerrar();
    consumeAjustes();
    const runs = countRunFiles(stateDir());
    noteWorkingCount(allDoneTracker, runs);
    consumeSonar();
    learnTick++;
    const learnEvery = runs > 0 ? 4 : 8;
    if (learnTick % learnEvery === 0) {
      void learnTitlesOnce(stateDir()).then(() => {
        // Foco puede cambiar sin títulos nuevos → refrescar poses (atento/visto)
        pushAgents(true);
      });
    }
    // Uso Cursor ~cada 96s; refresca Inc/Otr del footer
    if (learnTick % 60 === 0) {
      void refreshCursorUsage(stateDir()).then((ok) => {
        if (ok) pushAgents(true);
        maybeAnnounceUso();
      });
    }
    // Cada poll (~1.6s); grace 0 → sale en el primer tick sin Cursor
    checkCursorStillThere();
    // ~cada 96s: muestra RSS/heap (diagnóstico fuga)
    if (learnTick % 60 === 0) logMemSample();
  }, POLL_MS);

  // Primera lectura de uso al arrancar
  void refreshCursorUsage(stateDir()).then((ok) => {
    if (ok) pushAgents(true);
    maybeAnnounceUso();
  });

  try {
    const dir = stateDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.watch(dir, { persistent: true }, () => {
      pushAgents();
      consumeMostrar();
      consumeCerrar();
      consumeSonar();
    });
  } catch {
    /* poll only */
  }
}

function registerIpc(): void {
  ipcMain.handle('agents:list', () => agentsPayload());
  ipcMain.handle(
    'agents:focus',
    async (_e, payload?: string | { id?: string; title?: string }) => {
      // Async: nunca execFileSync aquí (congelaba AppBar)
      const id =
        typeof payload === 'object' && payload && typeof payload.id === 'string'
          ? payload.id.trim()
          : '';
      const fromUi =
        typeof payload === 'object' && payload && typeof payload.title === 'string'
          ? payload.title.trim()
          : typeof payload === 'string'
            ? payload.trim()
            : '';

      // Click = foco inmediato; visto solo si id real (no placeholder ui:)
      if (id && !id.startsWith('ui:')) {
        noteFocusedAgentId(id);
        pushAgents(true);
      }

      // Refrescar títulos UI antes de abrir (no bloquea UI: await en handler async)
      try {
        await learnTitlesOnce(stateDir());
      } catch {
        /* ignore */
      }

      const learned = id ? readTitulo(stateDir(), id).trim() : '';
      const openAs = learned || fromUi;
      if (!openAs) return focusCursorWindow();

      const result = await openCursorChat(openAs);
      if (result.ok && id && result.matchedTitle) {
        try {
          writeTitulo(stateDir(), id, result.matchedTitle);
          noteFocusedAgentId(id);
          pushAgents(true);
        } catch {
          /* ignore */
        }
      }
      return result.ok;
    },
  );
  ipcMain.handle(
    'hover:show',
    (
      _e,
      payload: {
        title: string;
        state: string;
        stateColor: string;
        phrase: string;
        anchorX: number;
        anchorY: number;
        anchorH: number;
      },
    ) => {
      if (!mainWindow || mainWindow.isDestroyed()) return false;
      const b = mainWindow.getBounds();
      // payload.anchor* viene en coords viewport de la franja (DIP)
      showHoverCard({
        title: payload.title,
        state: payload.state,
        stateColor: payload.stateColor,
        phrase: payload.phrase,
        anchorX: b.x + payload.anchorX,
        anchorY: b.y + payload.anchorY,
        anchorH: payload.anchorH,
      });
      return true;
    },
  );
  ipcMain.handle('hover:hide', () => {
    hideHoverCard();
    return true;
  });
  ipcMain.handle('settings:get', () => settingsPublic(ttsSettings));
  ipcMain.handle(
    'settings:save',
    (_e, patch: Partial<AppSettings> & { fishApiKey?: string; elevenApiKey?: string }) => {
      const next: AppSettings = { ...ttsSettings, ...patch };
      if (patch.fishApiKey === '********') next.fishApiKey = ttsSettings.fishApiKey;
      if (patch.elevenApiKey === '********') next.elevenApiKey = ttsSettings.elevenApiKey;
      if (patch.fishApiKey === '') next.fishApiKey = '';
      if (patch.elevenApiKey === '') next.elevenApiKey = '';
      ttsSettings = next;
      saveSettings(ttsSettings);
      return settingsPublic(ttsSettings);
    },
  );
  ipcMain.handle('settings:test', async (_e, text?: string) => {
    const phrase = (text && String(text).trim()) || 'Prueba de voz AgentCrew.';
    return resolveAndSpeak(phrase, ttsSettings, speakPaths(), speakCastOpts());
  });
  ipcMain.handle('cast:discover', async () => {
    try {
      const devices = await listCastDevices(6000);
      return { ok: true, devices };
    } catch (err) {
      return {
        ok: false,
        devices: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
  ipcMain.handle('cast:test', async () => {
    try {
      const mp3 = recordedVoicePath(speakPaths().vocesDir, 'Señor, he terminado.');
      if (!fs.existsSync(mp3)) {
        return { ok: false, error: `Falta MP3: ${mp3}` };
      }
      const { device, url } = await playMp3OnChosenCast({
        absPath: mp3,
        host: ttsSettings.castDeviceHost,
        name: ttsSettings.castDeviceName,
        port: ttsSettings.castHttpPort,
        announceIp: ttsSettings.castAnnounceIp,
        holdMs: 10_000,
      });
      return { ok: true, device, url };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(
    'cast:lanIps',
    (
      _e,
      opts?: { announceIp?: string; preferHost?: string },
    ) => {
      const announce =
        typeof opts?.announceIp === 'string'
          ? opts.announceIp
          : ttsSettings.castAnnounceIp;
      const prefer =
        typeof opts?.preferHost === 'string'
          ? opts.preferHost
          : ttsSettings.castDeviceHost;
      const ips = listPrivateLanIps();
      const resolved = pickLanIp(announce, prefer);
      return { ok: true, ips, resolved };
    },
  );
  ipcMain.handle('settings:open', () => {
    openSettings();
    return true;
  });
  // Fish REST = API key (sin OAuth). Portal = crear key en browser.
  ipcMain.handle('fish:openPortal', async () => {
    const url = 'https://fish.audio/app/api-keys';
    await shell.openExternal(url);
    return { ok: true, url };
  });
  ipcMain.handle('dock:listDisplays', () => listDisplaysPublic());
  ipcMain.handle('dock:setDisplay', (_e, displayId: number | null) => {
    const primaryId = screen.getPrimaryDisplay().id;
    if (displayId == null || displayId === primaryId) {
      panelPrefs = { displayId: null };
    } else if (screen.getAllDisplays().some((d) => d.id === displayId)) {
      panelPrefs = { displayId };
    } else {
      panelPrefs = { displayId: null };
    }
    savePanelPrefs(panelPrefs);
    applyDockMonitor();
    return listDisplaysPublic();
  });
  ipcMain.handle('prefs:get', () => {
    syncTtsFromState();
    return statePrefs;
  });
  ipcMain.handle('prefs:toggleMute', () => {
    statePrefs = writeMuted(stateDir(), !loadStatePrefs(stateDir()).muted);
    syncTtsFromState();
    refreshTray(trayHooks());
    return statePrefs;
  });
  ipcMain.handle('prefs:setMuestra', (_e, on: boolean) => {
    statePrefs = writeMuestra(stateDir(), Boolean(on));
    return statePrefs;
  });
  // Footer "x" = Parar (legacy): oculta franja, deja bandeja
  ipcMain.handle('panel:stop', () => {
    try {
      dockApi?.detach();
    } catch {
      /* ignore */
    }
    dockApi = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    refreshTray(trayHooks());
    return true;
  });
  ipcMain.handle('panel:quit', () => {
    markUserClosedPanel();
    app.quit();
    return true;
  });
}

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    try {
      fs.writeFileSync(path.join(stateDir(), 'mostrar.txt'), '1', 'utf8');
    } catch {
      /* ignore */
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      layoutWindow(mainWindow);
      mainWindow.show();
      mainWindow.focus();
      pushAgents(true);
    }
  });

  app.whenReady().then(() => {
    ttsSettings = loadSettings();
    panelPrefs = loadPanelPrefs();
    syncTtsFromState();
    registerIpc();
    createWindow();
    createTray(trayHooks());
    writePanelPid();
    startWatchers();
    screen.on('display-added', () => applyDockMonitor());
    screen.on('display-removed', () => {
      // Si se desconectó la elegida → primary
      if (
        panelPrefs.displayId != null &&
        !screen.getAllDisplays().some((d) => d.id === panelPrefs.displayId)
      ) {
        panelPrefs = { displayId: null };
        savePanelPrefs(panelPrefs);
      }
      applyDockMonitor();
    });
    screen.on('display-metrics-changed', () => applyDockMonitor());
  });

  app.on('window-all-closed', () => {
    // No salir: bandeja mantiene proceso (legacy NotifyIcon)
  });

  app.on('before-quit', () => {
    clearPanelPid();
    try {
      dockApi?.detach();
    } catch {
      /* ignore */
    }
    destroyHoverCard();
    destroyTray();
    disposeUiaScraper();
    if (pollTimer) clearInterval(pollTimer);
    void stopCastHttp();
  });
}
