import { Tray, Menu, nativeImage, app } from 'electron';
import type { PanelStatePrefs } from './statePrefs';
import {
  loadStatePrefs,
  setAviso,
  setCuando,
  setMuted,
  setVolume,
} from './statePrefs';

type Hooks = {
  stateDir: () => string;
  showPanel: () => void;
  hidePanel: () => void;
  isPanelVisible: () => boolean;
  openSettings: () => void;
  testVoice: (tipo: string) => void;
  onPrefs: (p: PanelStatePrefs) => void;
  /** Salir definitivo (marca latch para que el watcher no relance). */
  quitPanel: () => void;
};

let tray: Tray | null = null;

function icon(): Electron.NativeImage {
  // 16×16 azul simple (cara legacy bandeja)
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inBody = x >= 3 && x <= 12 && y >= 3 && y <= 12;
      const eye =
        (x >= 5 && x <= 6 && y >= 6 && y <= 7) ||
        (x >= 9 && x <= 10 && y >= 6 && y <= 7);
      if (eye) {
        buf[i] = 255;
        buf[i + 1] = 255;
        buf[i + 2] = 255;
        buf[i + 3] = 255;
      } else if (inBody) {
        buf[i] = 79;
        buf[i + 1] = 163;
        buf[i + 2] = 255;
        buf[i + 3] = 255;
      } else {
        buf[i + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function rebuild(hooks: Hooks): void {
  if (!tray) return;
  const p = loadStatePrefs(hooks.stateDir());
  hooks.onPrefs(p);
  const menu = Menu.buildFromTemplate([
    {
      label: hooks.isPanelVisible() ? 'Parar' : 'Iniciar',
      click: () => {
        if (hooks.isPanelVisible()) hooks.hidePanel();
        else hooks.showPanel();
        rebuild(hooks);
      },
    },
    {
      label: 'Reiniciar',
      click: () => {
        app.relaunch();
        app.exit(0);
      },
    },
    { type: 'separator' },
    {
      label: 'Silenciar avisos',
      type: 'checkbox',
      checked: p.muted,
      click: () => {
        hooks.onPrefs(setMuted(hooks.stateDir(), !p.muted));
        rebuild(hooks);
      },
    },
    {
      label: 'Silenciar 1 hora',
      click: () => {
        const until = new Date(Date.now() + 3600_000).toISOString();
        hooks.onPrefs(setMuted(hooks.stateDir(), true, until));
        rebuild(hooks);
      },
    },
    {
      label: 'Silenciar hasta mañana',
      click: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        hooks.onPrefs(setMuted(hooks.stateDir(), true, d.toISOString()));
        rebuild(hooks);
      },
    },
    { type: 'separator' },
    {
      label: 'Avisar con voz',
      type: 'checkbox',
      checked: p.aviso === 'voz',
      click: () => {
        hooks.onPrefs(setAviso(hooks.stateDir(), 'voz'));
        rebuild(hooks);
      },
    },
    {
      label: 'Avisar con sonido',
      type: 'checkbox',
      checked: p.aviso === 'sonido',
      click: () => {
        hooks.onPrefs(setAviso(hooks.stateDir(), 'sonido'));
        rebuild(hooks);
      },
    },
    { type: 'separator' },
    {
      label: 'Avisar solo si estoy inactivo',
      type: 'checkbox',
      checked: p.cuando === 'inactivo',
      click: () => {
        hooks.onPrefs(setCuando(hooks.stateDir(), 'inactivo'));
        rebuild(hooks);
      },
    },
    {
      label: 'Avisar siempre',
      type: 'checkbox',
      checked: p.cuando === 'siempre',
      click: () => {
        hooks.onPrefs(setCuando(hooks.stateDir(), 'siempre'));
        rebuild(hooks);
      },
    },
    { type: 'separator' },
    {
      label: 'Probar fin',
      click: () => hooks.testVoice('fin'),
    },
    {
      label: 'Probar espera',
      click: () => hooks.testVoice('pregunta'),
    },
    {
      label: 'Probar aprobación',
      click: () => hooks.testVoice('aprobacion'),
    },
    {
      label: 'Volumen 30',
      type: 'checkbox',
      checked: p.volume === 30,
      click: () => {
        hooks.onPrefs(setVolume(hooks.stateDir(), 30));
        rebuild(hooks);
      },
    },
    {
      label: 'Volumen 60',
      type: 'checkbox',
      checked: p.volume === 60,
      click: () => {
        hooks.onPrefs(setVolume(hooks.stateDir(), 60));
        rebuild(hooks);
      },
    },
    {
      label: 'Volumen 100',
      type: 'checkbox',
      checked: p.volume === 100,
      click: () => {
        hooks.onPrefs(setVolume(hooks.stateDir(), 100));
        rebuild(hooks);
      },
    },
    { type: 'separator' },
    { label: 'Ajustes TTS…', click: () => hooks.openSettings() },
    { type: 'separator' },
    { label: 'Salir', click: () => hooks.quitPanel() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip('AgentCrew — panel de agentes');
}

export function createTray(hooks: Hooks): Tray {
  if (tray) return tray;
  tray = new Tray(icon());
  tray.setToolTip('AgentCrew — panel de agentes');
  tray.on('double-click', () => {
    if (hooks.isPanelVisible()) hooks.hidePanel();
    else hooks.showPanel();
    rebuild(hooks);
  });
  rebuild(hooks);
  return tray;
}

export function refreshTray(hooks: Hooks): void {
  rebuild(hooks);
}

export function destroyTray(): void {
  try {
    tray?.destroy();
  } catch {
    /* ignore */
  }
  tray = null;
}
