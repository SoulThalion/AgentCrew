/**
 * Popup hover legacy (título / estado / frase) fuera de la franja.
 * BrowserWindow aparte: el contenido no puede pintar fuera del HWND AppBar.
 * Evita loadURL data: repetido (fuga historial Chromium).
 */
import { BrowserWindow } from 'electron';

let hoverWin: BrowserWindow | null = null;
let lastKey = '';
let shellReady = false;

const SHELL_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;background:transparent;overflow:hidden;font-family:'Segoe UI',sans-serif}
  .box{background:rgba(30,31,36,.95);border:1px solid rgba(255,255,255,.33);padding:10px 12px;border-radius:4px;max-width:280px}
  .t{font-size:13px;font-weight:700;color:#F4F4F4;line-height:1.25;word-wrap:break-word}
  .e{font-size:11px;margin-top:4px;line-height:1.3;word-wrap:break-word}
  .f{font-size:12px;color:#D0D0D0;margin-top:6px;line-height:1.35;word-wrap:break-word}
</style></head><body>
<div class="box" id="b">
  <div class="t" id="t">—</div>
  <div class="e" id="e"></div>
  <div class="f" id="f"></div>
</div>
</body></html>`;

function ensureHoverWin(): BrowserWindow {
  if (hoverWin && !hoverWin.isDestroyed()) return hoverWin;
  shellReady = false;
  lastKey = '';
  hoverWin = new BrowserWindow({
    width: 280,
    height: 140,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });
  hoverWin.setMenuBarVisibility(false);
  hoverWin.setTitle('');
  hoverWin.setIgnoreMouseEvents(true);
  void hoverWin
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SHELL_HTML)}`)
    .then(() => {
      shellReady = true;
      try {
        hoverWin?.webContents.clearHistory();
      } catch {
        /* ignore */
      }
    });
  return hoverWin;
}

export function showHoverCard(opts: {
  title: string;
  state: string;
  stateColor: string;
  phrase: string;
  anchorX: number;
  anchorY: number;
  anchorH: number;
}): void {
  const w = 280;
  const win = ensureHoverWin();
  const key = `${opts.title}\0${opts.state}\0${opts.stateColor}\0${opts.phrase}`;
  const x = Math.round(opts.anchorX - w - 8);
  const y = Math.round(opts.anchorY);

  const applyBounds = (height: number) => {
    if (!hoverWin || hoverWin.isDestroyed()) return;
    hoverWin.setBounds({
      x,
      y,
      height: Math.max(48, Math.min(220, height)),
      width: w,
    });
    hoverWin.showInactive();
  };

  const paint = () => {
    if (!hoverWin || hoverWin.isDestroyed()) return;
    if (key === lastKey) {
      applyBounds(hoverWin.getBounds().height);
      return;
    }
    lastKey = key;
    const js = `
      (() => {
        const t = document.getElementById('t');
        const e = document.getElementById('e');
        const f = document.getElementById('f');
        const b = document.getElementById('b');
        if (t) t.textContent = ${JSON.stringify(opts.title || '—')};
        if (e) {
          e.textContent = ${JSON.stringify(opts.state || '')};
          e.style.color = ${JSON.stringify(opts.stateColor || '#C8C8C8')};
        }
        if (f) f.textContent = ${JSON.stringify(opts.phrase || 'Sin frase todavía')};
        return b ? Math.ceil(b.getBoundingClientRect().height) + 4 : 100;
      })()
    `;
    void hoverWin.webContents
      .executeJavaScript(js)
      .then((h) => applyBounds(Math.ceil(Number(h) || 100)))
      .catch(() => applyBounds(100));
  };

  if (shellReady) {
    paint();
    return;
  }
  win.webContents.once('did-finish-load', () => {
    shellReady = true;
    paint();
  });
}

export function hideHoverCard(): void {
  if (!hoverWin || hoverWin.isDestroyed()) return;
  hoverWin.hide();
}

export function destroyHoverCard(): void {
  if (!hoverWin || hoverWin.isDestroyed()) {
    hoverWin = null;
    shellReady = false;
    lastKey = '';
    return;
  }
  hoverWin.destroy();
  hoverWin = null;
  shellReady = false;
  lastKey = '';
}
