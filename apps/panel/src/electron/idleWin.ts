/**
 * Segundos desde último input (paridad Segundos-Inactivo legacy).
 * Win32 GetLastInputInfo; otros SO → 0 (no bloquear avisos).
 */
import { execFileSync } from 'node:child_process';

let cached = { at: 0, seconds: 0 };

export function idleSecondsWin(now = Date.now()): number {
  if (process.platform !== 'win32') return 0;
  if (now - cached.at < 2000) return cached.seconds;
  try {
    const ps = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class IdleNative {
  [StructLayout(LayoutKind.Sequential)]
  struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  public static uint Seconds() {
    LASTINPUTINFO info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
    if (!GetLastInputInfo(ref info)) return 0;
    return (unchecked((uint)Environment.TickCount) - info.dwTime) / 1000u;
  }
}
"@
[IdleNative]::Seconds()
`;
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, encoding: 'utf8', timeout: 3000 },
    );
    const n = Number.parseInt(String(out).trim(), 10);
    cached = { at: now, seconds: Number.isFinite(n) ? n : 0 };
    return cached.seconds;
  } catch {
    cached = { at: now, seconds: 0 };
    return 0;
  }
}
