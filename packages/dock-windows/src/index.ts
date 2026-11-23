/**
 * AppBar Windows — SHAppBarMessage.
 * Importante: SETPOS usa coords físicas; Electron setBounds usa DIP.
 * No posicionar con workArea tras reservar (el hueco queda a la derecha del workArea).
 */
import koffi from 'koffi';

const ABM_NEW = 0;
const ABM_REMOVE = 1;
const ABM_QUERYPOS = 2;
const ABM_SETPOS = 3;
const ABE_RIGHT = 2;
const ABN_POSCHANGED = 1;
const MONITOR_DEFAULTTOPRIMARY = 1;
const MONITOR_DEFAULTTONEAREST = 2;

export type MonitorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ElectronWin = {
  getNativeWindowHandle: () => Buffer;
  setBounds: (b: { x: number; y: number; width: number; height: number }) => void;
  getBounds?: () => { x: number; y: number; width: number; height: number };
  getContentSize?: () => number[];
  setContentSize?: (width: number, height: number) => void;
  hookWindowMessage?: (
    message: number,
    callback: (wParam: Buffer, lParam: Buffer) => void,
  ) => void;
  unhookWindowMessage?: (message: number) => void;
  isDestroyed: () => boolean;
  setMovable?: (m: boolean) => void;
};

type DockState = {
  hwnd: unknown;
  callbackMsg: number;
  /** Ancho en DIP (como STRIP_WIDTH del panel). */
  widthDip: number;
  /** Escala del display (1.0 / 1.25 / 1.5…). */
  scaleFactor: number;
  /** Rect físico del monitor objetivo (AppBar). */
  monitorRc: MonitorRect | null;
  registered: boolean;
  placing: boolean;
  win: ElectronWin;
  /** Último objetivo (pre-QUERYPOS) — skip si monitor/ancho no cambió. */
  lastWant: { x: number; y: number; w: number; h: number } | null;
  lastDipW: number;
  lastDipH: number;
  /** Debounce ABN_POSCHANGED. */
  posTimer: ReturnType<typeof setTimeout> | null;
};

let state: DockState | null = null;

const RECT = koffi.struct('AC_RECT', {
  left: 'int32',
  top: 'int32',
  right: 'int32',
  bottom: 'int32',
});

// Layout Win64 natural: cbSize(4)+pad(4)+HWND(8)+msg(4)+edge(4)+RECT(16)+LPARAM(8)=48
const APPBARDATA = koffi.struct('AC_APPBARDATA', {
  cbSize: 'uint32',
  hWnd: 'void *',
  uCallbackMessage: 'uint32',
  uEdge: 'uint32',
  rc: RECT,
  lParam: 'intptr',
});

const MONITORINFO = koffi.struct('AC_MONITORINFO', {
  cbSize: 'uint32',
  rcMonitor: RECT,
  rcWork: RECT,
  dwFlags: 'uint32',
});

const POINT = koffi.struct('AC_POINT', {
  x: 'int32',
  y: 'int32',
});

const shell32 = koffi.load('shell32.dll');
const user32 = koffi.load('user32.dll');

const SHAppBarMessage = shell32.func(
  'uintptr __stdcall SHAppBarMessage(uint32 dwMessage, _Inout_ AC_APPBARDATA *pData)',
);
const RegisterWindowMessageW = user32.func(
  'uint32 __stdcall RegisterWindowMessageW(str16 lpString)',
);
const MonitorFromPoint = user32.func(
  'void * __stdcall MonitorFromPoint(AC_POINT pt, uint32 dwFlags)',
);
const GetMonitorInfoW = user32.func(
  'bool __stdcall GetMonitorInfoW(void *hMonitor, _Inout_ AC_MONITORINFO *lpmi)',
);
const MoveWindow = user32.func(
  'bool __stdcall MoveWindow(void *hWnd, int32 X, int32 Y, int32 nWidth, int32 nHeight, bool bRepaint)',
);
const SetWindowPos = user32.func(
  'bool __stdcall SetWindowPos(void *hWnd, void *hWndInsertAfter, int32 X, int32 Y, int32 cx, int32 cy, uint32 uFlags)',
);

const SWP_SHOWWINDOW = 0x0040;
const HWND_TOPMOST = -1;

function hwndFromBuffer(buf: Buffer): bigint {
  // Electron getNativeWindowHandle → HWND little-endian
  if (buf.byteLength >= 8) return buf.readBigUInt64LE(0);
  return BigInt(buf.readUInt32LE(0));
}

function makeData(hwnd: unknown, callbackMsg: number) {
  return {
    cbSize: koffi.sizeof(APPBARDATA),
    hWnd: hwnd,
    uCallbackMessage: callbackMsg,
    uEdge: ABE_RIGHT,
    rc: { left: 0, top: 0, right: 0, bottom: 0 },
    lParam: 0,
  };
}

function logDock(msg: string): void {
  try {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const file = path.join(home, '.cursor', 'hooks', 'state', 'panel-error.log');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${new Date().toISOString()} dock: ${msg}\n`);
  } catch {
    /* ignore */
  }
}

function resolveMonitorRc(): MonitorRect {
  if (state?.monitorRc) return state.monitorRc;
  // Default: pantalla principal (no cursor / no ventana Cursor)
  const pt = { x: 0, y: 0 };
  const monitor = MonitorFromPoint(pt, MONITOR_DEFAULTTOPRIMARY);
  const info = {
    cbSize: koffi.sizeof(MONITORINFO),
    rcMonitor: { left: 0, top: 0, right: 0, bottom: 0 },
    rcWork: { left: 0, top: 0, right: 0, bottom: 0 },
    dwFlags: 0,
  };
  if (!GetMonitorInfoW(monitor, info)) {
    // Fallback nearest al origen
    const near = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
    if (!GetMonitorInfoW(near, info)) {
      throw new Error('GetMonitorInfo failed');
    }
  }
  return { ...info.rcMonitor };
}

function place(force = false): void {
  if (!state || !state.registered || state.placing) return;
  if (state.win.isDestroyed()) return;
  state.placing = true;
  try {
    const mon = resolveMonitorRc();
    const physW = Math.max(1, Math.round(state.widthDip * state.scaleFactor));
    const wantX = mon.right - physW;
    const wantY = mon.top;
    const wantW = physW;
    const wantH = Math.max(1, mon.bottom - mon.top);

    // Skip temprano: solo lastWant (pre-QUERYPOS). No mezclar lastDip post-QUERYPOS.
    if (
      !force &&
      state.lastWant &&
      state.lastWant.x === wantX &&
      state.lastWant.y === wantY &&
      state.lastWant.w === wantW &&
      state.lastWant.h === wantH
    ) {
      return;
    }

    const data = makeData(state.hwnd, state.callbackMsg);
    data.uEdge = ABE_RIGHT;
    // Monitor completo físico — no workArea (el hueco AppBar queda fuera del workArea)
    data.rc.left = wantX;
    data.rc.top = wantY;
    data.rc.right = mon.right;
    data.rc.bottom = mon.bottom;

    SHAppBarMessage(ABM_QUERYPOS, data);
    const setOk = SHAppBarMessage(ABM_SETPOS, data);

    const x = data.rc.left;
    const y = data.rc.top;
    const w = Math.max(1, data.rc.right - data.rc.left);
    const h = Math.max(1, data.rc.bottom - data.rc.top);
    const dipW = Math.max(1, Math.round(w / state.scaleFactor));
    const dipH = Math.max(1, Math.round(h / state.scaleFactor));
    const sameDip = state.lastDipW === dipW && state.lastDipH === dipH;

    // NO usar Electron setBounds (clampa workArea → hueco vacío).
    MoveWindow(state.hwnd, x, y, w, h, true);
    SetWindowPos(
      state.hwnd,
      HWND_TOPMOST,
      x,
      y,
      w,
      h,
      SWP_SHOWWINDOW,
    );

    // Sync webContents solo si DIP cambió (setContentSize repetido hincha RAM).
    if (!sameDip) {
      try {
        state.win.setContentSize?.(dipW, dipH);
      } catch {
        /* ignore */
      }
      state.lastDipW = dipW;
      state.lastDipH = dipH;
    }

    state.lastWant = { x: wantX, y: wantY, w: wantW, h: wantH };
    state.win.setMovable?.(false);
    logDock(
      `place setOk=${String(setOk)} phys=${x},${y} ${w}x${h} dip=${dipW}x${dipH} scale=${state.scaleFactor}`,
    );
  } catch (err) {
    logDock(err instanceof Error ? err.message : String(err));
  } finally {
    state.placing = false;
  }
}

function schedulePlaceFromPosChanged(): void {
  if (!state) return;
  if (state.posTimer) clearTimeout(state.posTimer);
  state.posTimer = setTimeout(() => {
    if (!state) return;
    state.posTimer = null;
    place(false);
  }, 400);
}

export type AttachOptions = {
  /** Escala display (Electron Display.scaleFactor). Default 1. */
  scaleFactor?: number;
  /** Rect físico del monitor. Default = pantalla principal. */
  monitorRc?: MonitorRect;
};

/** Engancha BrowserWindow como AppBar derecha. widthDip = ancho lógico UI. */
export function attach(win: ElectronWin, widthDip: number, opts?: AttachOptions): void {
  if (process.platform !== 'win32') return;
  detach();

  const hwnd = hwndFromBuffer(win.getNativeWindowHandle());
  const callbackMsg = RegisterWindowMessageW('AgentCrewPanelAppBar');
  const data = makeData(hwnd, callbackMsg);
  const ok = SHAppBarMessage(ABM_NEW, data);
  if (!ok) {
    throw new Error('ABM_NEW failed');
  }

  state = {
    hwnd,
    callbackMsg,
    widthDip,
    scaleFactor: opts?.scaleFactor && opts.scaleFactor > 0 ? opts.scaleFactor : 1,
    monitorRc: opts?.monitorRc ?? null,
    registered: true,
    placing: false,
    win,
    lastWant: null,
    lastDipW: 0,
    lastDipH: 0,
    posTimer: null,
  };

  if (typeof win.hookWindowMessage === 'function') {
    win.hookWindowMessage(callbackMsg, (wParam, lParam) => {
      try {
        // Solo wParam = ABN_* (MSDN). lParam no es código — leerlo como 1 = falsos place.
        void lParam;
        const fromW =
          wParam && wParam.byteLength >= 4 ? wParam.readInt32LE(0) : -1;
        if (fromW === ABN_POSCHANGED) {
          schedulePlaceFromPosChanged();
        }
      } catch {
        /* ignore */
      }
    });
  }

  place(true);
  // Reafirmar tras show/load; sin force → no-op si lastWant igual (anti-fuga RSS)
  setTimeout(() => place(false), 250);
  setTimeout(() => place(false), 800);
}

export function reposition(): void {
  place(true);
}

/** Cambia monitor objetivo (coords físicas) y reafirma AppBar. */
export function setMonitor(monitorRc: MonitorRect, scaleFactor?: number): void {
  if (!state) return;
  state.monitorRc = monitorRc;
  if (scaleFactor && scaleFactor > 0) state.scaleFactor = scaleFactor;
  place(true);
}

export function detach(): void {
  if (!state || !state.registered) {
    state = null;
    return;
  }
  if (state.posTimer) {
    clearTimeout(state.posTimer);
    state.posTimer = null;
  }
  try {
    if (typeof state.win.unhookWindowMessage === 'function' && state.callbackMsg) {
      state.win.unhookWindowMessage(state.callbackMsg);
    }
  } catch {
    /* ignore */
  }
  try {
    const data = makeData(state.hwnd, state.callbackMsg);
    SHAppBarMessage(ABM_REMOVE, data);
  } catch {
    /* ignore */
  }
  try {
    state.win.setMovable?.(true);
  } catch {
    /* ignore */
  }
  state.registered = false;
  state = null;
}

export function isAttached(): boolean {
  return Boolean(state?.registered);
}

export const isWindowsDock = process.platform === 'win32';
