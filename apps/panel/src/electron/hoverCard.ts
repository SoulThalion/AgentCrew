/**
 * Popup hover legacy (título / estado / frase) fuera de la franja.
 * BrowserWindow aparte: el contenido no puede pintar fuera del HWND AppBar.
 */
import { BrowserWindow } from 'electron';

let hoverWin: BrowserWindow | null = null;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showHoverCard(opts: {
  title: string;
  state: string;
  stateColor: string;
  phrase: string;
  /** DIP screen coords: ancla izquierda del sprite */
  anchorX: number;
  anchorY: number;
  anchorH: number;
}): void {
  const w = 280;
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;background:transparent;overflow:hidden;font-family:'Segoe UI',sans-serif}
  .box{background:rgba(30,31,36,.95);border:1px solid rgba(255,255,255,.33);padding:10px 12px;border-radius:4px;max-width:280px}
  .t{font-size:13px;font-weight:700;color:#F4F4F4;line-height:1.25;word-wrap:break-word}
  .e{font-size:11px;margin-top:4px;line-height:1.3;word-wrap:break-word}
  .f{font-size:12px;color:#D0D0D0;margin-top:6px;line-height:1.35;word-wrap:break-word}
</style></head><body>
<div class="box" id="b">
  <div class="t">${escapeHtml(opts.title || '—')}</div>
  <div class="e" style="color:${escapeHtml(opts.stateColor || '#C8C8C8')}">${escapeHtml(opts.state || '')}</div>
  <div class="f">${escapeHtml(opts.phrase || 'Sin frase todavía')}</div>
</div>
<script>
  const b=document.getElementById('b');
  const h=Math.ceil(b.getBoundingClientRect().height);
  document.title='h:'+h;
</script>
</body></html>`;

  if (!hoverWin || hoverWin.isDestroyed()) {
    hoverWin = new BrowserWindow({
      width: w,
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
      },
    });
    hoverWin.setMenuBarVisibility(false);
    hoverWin.setTitle('');
    hoverWin.setIgnoreMouseEvents(true);
  }

  const x = Math.round(opts.anchorX - w - 8);
  const y = Math.round(opts.anchorY + opts.anchorH / 2 - 40);

  void hoverWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => {
    if (!hoverWin || hoverWin.isDestroyed()) return;
    // Ajustar alto al contenido
    void hoverWin.webContents.executeJavaScript('document.getElementById("b").getBoundingClientRect().height').then((h) => {
      if (!hoverWin || hoverWin.isDestroyed()) return;
      const height = Math.max(48, Math.min(220, Math.ceil(Number(h) || 80) + 4));
      hoverWin.setBounds({ x, y: Math.round(opts.anchorY), width: w, height });
      hoverWin.showInactive();
    }).catch(() => {
      if (!hoverWin || hoverWin.isDestroyed()) return;
      hoverWin.setBounds({ x, y, width: w, height: 100 });
      hoverWin.showInactive();
    });
  });
}

export function hideHoverCard(): void {
  if (!hoverWin || hoverWin.isDestroyed()) return;
  hoverWin.hide();
}

export function destroyHoverCard(): void {
  if (!hoverWin || hoverWin.isDestroyed()) return;
  hoverWin.destroy();
  hoverWin = null;
}
