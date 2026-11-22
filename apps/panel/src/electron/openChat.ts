/**
 * Abre el chat de Cursor por título UI.
 * Cursor actual: TabItem "{título}, Chat Editors…"
 * Legacy: botón "Open agent {título}"
 * Async — no congelar AppBar.
 */
import { execFile } from 'node:child_process';
import { focusCursorWindow } from './focusCursor';

function escapePs(s: string): string {
  return s.replace(/'/g, "''");
}

export type OpenChatResult = {
  ok: boolean;
  matchedTitle?: string;
};

function runPs(script: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => {
        if (err) resolve('');
        else resolve(String(stdout ?? ''));
      },
    );
  });
}

export async function openCursorChat(title: string): Promise<OpenChatResult> {
  if (process.platform !== 'win32') return { ok: false };
  const t = title.trim();
  if (!t) {
    const ok = await focusCursorWindow();
    return { ok };
  }

  void focusCursorWindow();

  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -ReferencedAssemblies @('UIAutomationClient','UIAutomationTypes','WindowsBase') -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Windows.Automation;
using System.Text;
public static class AbrirChatCursor {
  static string Norm(string s) {
    if (string.IsNullOrEmpty(s)) return "";
    var sb = new StringBuilder(s.Length);
    bool space = false;
    foreach (char c in s.ToLowerInvariant()) {
      if (char.IsLetterOrDigit(c)) { sb.Append(c); space = false; }
      else if (!space) { sb.Append(' '); space = true; }
    }
    return sb.ToString().Trim();
  }
  static bool MismoTitulo(string nombre, string titulo) {
    if (string.IsNullOrEmpty(nombre) || string.IsNullOrEmpty(titulo)) return false;
    string n = nombre.Trim();
    if (string.Equals(n, titulo, StringComparison.OrdinalIgnoreCase)) return true;
    if (!n.StartsWith(titulo, StringComparison.OrdinalIgnoreCase)) return false;
    if (n.Length == titulo.Length) return true;
    char sigue = n[titulo.Length];
    return sigue == ',' || sigue == ' ';
  }
  static int PuntuarSufijo(string suf, string titulo) {
    if (string.IsNullOrWhiteSpace(suf) || string.IsNullOrWhiteSpace(titulo)) return 0;
    if (MismoTitulo(suf, titulo) || MismoTitulo(titulo, suf)) return 100;
    string ns = Norm(suf); string nt = Norm(titulo);
    if (ns.Length == 0 || nt.Length == 0) return 0;
    if (ns == nt) return 100;
    if (nt.StartsWith(ns) || ns.StartsWith(nt)) return 90;
    if (ns.Length >= 4 && nt.Contains(ns)) return 80;
    if (nt.Length >= 12) {
      string head = nt.Substring(0, Math.Min(40, nt.Length));
      if (ns.Contains(head) || head.Contains(ns)) return 70;
    }
    return 0;
  }
  static void Activar(AutomationElement el) {
    try {
      object desplazar;
      if (el.TryGetCurrentPattern(ScrollItemPattern.Pattern, out desplazar))
        ((ScrollItemPattern)desplazar).ScrollIntoView();
    } catch { }
    object patron;
    try {
      if (el.TryGetCurrentPattern(SelectionItemPattern.Pattern, out patron)) {
        ((SelectionItemPattern)patron).Select();
        return;
      }
    } catch { }
    try {
      if (el.TryGetCurrentPattern(InvokePattern.Pattern, out patron)) {
        ((InvokePattern)patron).Invoke();
        return;
      }
    } catch { }
  }
  public static string Go(string titulo) {
    AutomationElement mejor = null;
    int puntos = 0;
    string matched = "";
    foreach (var proc in Process.GetProcessesByName("Cursor")) {
      IntPtr h = IntPtr.Zero;
      try { h = proc.MainWindowHandle; } catch { continue; }
      if (h == IntPtr.Zero) continue;
      AutomationElement root = null;
      try { root = AutomationElement.FromHandle(h); } catch { continue; }
      if (root == null) continue;
      try {
        var tabCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.TabItem);
        foreach (AutomationElement el in root.FindAll(TreeScope.Descendants, tabCond)) {
          string nombre = "";
          try { nombre = el.Current.Name ?? ""; } catch { continue; }
          int marca = nombre.IndexOf(", Chat Editors", StringComparison.OrdinalIgnoreCase);
          if (marca <= 0) continue;
          string suf = nombre.Substring(0, marca).Trim();
          if (string.Equals(suf, "New Agent", StringComparison.OrdinalIgnoreCase)) continue;
          int p = PuntuarSufijo(suf, titulo);
          if (p > puntos) { puntos = p; mejor = el; matched = suf; }
          if (puntos >= 100) break;
        }
        if (puntos < 100) {
          var btnCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button);
          foreach (AutomationElement el in root.FindAll(TreeScope.Descendants, btnCond)) {
            string nombre = "";
            try { nombre = el.Current.Name ?? ""; } catch { continue; }
            if (!nombre.StartsWith("Open agent ", StringComparison.OrdinalIgnoreCase)) continue;
            string suf = nombre.Substring("Open agent ".Length).Trim();
            int p = PuntuarSufijo(suf, titulo);
            if (p > puntos) { puntos = p; mejor = el; matched = suf; }
            if (puntos >= 100) break;
          }
        }
      } catch { }
      if (puntos >= 100) break;
    }
    if (mejor == null || puntos < 60) return "FAIL";
    try { Activar(mejor); } catch { return "FAIL"; }
    return "OK|" + matched.Replace("|", " ");
  }
}
"@
[AbrirChatCursor]::Go('${escapePs(t)}')
`;

  const out = (await runPs(ps, 8000)).trim();
  if (out.startsWith('OK|')) {
    const matchedTitle = out.slice(3).trim();
    return { ok: true, matchedTitle: matchedTitle || undefined };
  }
  await focusCursorWindow();
  return { ok: false };
}
