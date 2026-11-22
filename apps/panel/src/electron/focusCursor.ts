/**
 * Trae Cursor al frente (async — nunca bloquear main/Electron).
 * Solo Restore si está minimizado.
 */
import { execFile } from 'node:child_process';

const PS_FOCUS = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class FocusCursor {
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  public struct RECT { public int L,T,R,B; }
  const int SW_RESTORE = 9;
  public static bool Go() {
    IntPtr best = IntPtr.Zero; int area = 0;
    EnumProc cb = (h, l) => {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      try {
        var n = Process.GetProcessById((int)pid).ProcessName;
        if (!n.Equals("Cursor", StringComparison.OrdinalIgnoreCase)) return true;
      } catch { return true; }
      if (IsIconic(h)) { best = h; area = int.MaxValue; return true; }
      RECT r; if (!GetWindowRect(h, out r)) return true;
      int a = (r.R-r.L)*(r.B-r.T);
      if (a > area) { area = a; best = h; }
      return true;
    };
    EnumWindows(cb, IntPtr.Zero);
    if (best == IntPtr.Zero) return false;
    if (IsIconic(best)) ShowWindow(best, SW_RESTORE);
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    return SetForegroundWindow(best);
  }
}
"@
[FocusCursor]::Go()
`;

function runPs(script: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => {
        if (err) resolve('');
        else resolve(stdout ?? '');
      },
    );
  });
}

export async function focusCursorWindow(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  const out = await runPs(PS_FOCUS, 4000);
  return /True/i.test(out);
}
