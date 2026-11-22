/**
 * macOS: panel sticky always-on-top. Sin reserva de visibleFrame (límite OS).
 */
export type ElectronWin = {
  setBounds: (b: { x: number; y: number; width: number; height: number }) => void;
  setAlwaysOnTop: (flag: boolean, level?: string) => void;
  setVisibleOnAllWorkspaces?: (v: boolean, opts?: { visibleOnFullScreen?: boolean }) => void;
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
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });
}

export function attach(win: ElectronWin, widthPx: number, workArea: DisplayArea): void {
  if (process.platform !== 'darwin') return;
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

export const isMacDock = process.platform === 'darwin';
