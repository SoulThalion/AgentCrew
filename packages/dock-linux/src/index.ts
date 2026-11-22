/**
 * Linux: posiciona franja sticky.
 * X11 strut real queda como mejora; Wayland = always-on-top best-effort.
 */
export type ElectronWin = {
  setBounds: (b: { x: number; y: number; width: number; height: number }) => void;
  setAlwaysOnTop: (flag: boolean) => void;
  isDestroyed: () => boolean;
};

export type DisplayArea = { x: number; y: number; width: number; height: number };

let attached: { win: ElectronWin; width: number; area: DisplayArea } | null = null;

function place(): void {
  if (!attached || attached.win.isDestroyed()) return;
  const { area, width, win } = attached;
  win.setBounds({
    x: area.x + area.width - width,
    y: area.y,
    width,
    height: area.height,
  });
  win.setAlwaysOnTop(true);
}

export function attach(win: ElectronWin, widthPx: number, workArea: DisplayArea): void {
  if (process.platform === 'win32' || process.platform === 'darwin') return;
  attached = { win, width: widthPx, area: workArea };
  place();
}

export function reposition(workArea?: DisplayArea): void {
  if (workArea && attached) attached.area = workArea;
  place();
}

export function detach(): void {
  attached = null;
}

export function isAttached(): boolean {
  return attached != null;
}

export const isLinuxDock =
  process.platform !== 'win32' && process.platform !== 'darwin';

/** true si SESSIONTYPE/wayland sugiere Wayland (sin strut fiable). */
export function isWayland(): boolean {
  return (
    process.env.XDG_SESSION_TYPE === 'wayland' ||
    Boolean(process.env.WAYLAND_DISPLAY)
  );
}
