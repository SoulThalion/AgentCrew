/**
 * Segundos desde último input (paridad Segundos-Inactivo legacy).
 * Win32 GetLastInputInfo vía koffi (sin spawn PowerShell).
 * Otros SO → 0 (no bloquear avisos).
 */
import koffi from 'koffi';

let cached = { at: 0, seconds: 0 };

const LASTINPUTINFO = koffi.struct('AC_LASTINPUTINFO', {
  cbSize: 'uint32',
  dwTime: 'uint32',
});

let GetLastInputInfo:
  | ((info: { cbSize: number; dwTime: number }) => boolean)
  | null = null;
let GetTickCount: (() => number) | null = null;

function ensureNative(): boolean {
  if (process.platform !== 'win32') return false;
  if (GetLastInputInfo && GetTickCount) return true;
  try {
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    GetLastInputInfo = user32.func(
      'bool __stdcall GetLastInputInfo(_Inout_ AC_LASTINPUTINFO *plii)',
    );
    GetTickCount = kernel32.func('uint32 __stdcall GetTickCount()');
    return true;
  } catch {
    GetLastInputInfo = null;
    GetTickCount = null;
    return false;
  }
}

export function idleSecondsWin(now = Date.now()): number {
  if (process.platform !== 'win32') return 0;
  if (now - cached.at < 2000) return cached.seconds;
  if (!ensureNative() || !GetLastInputInfo || !GetTickCount) {
    cached = { at: now, seconds: 0 };
    return 0;
  }
  try {
    const info = {
      cbSize: koffi.sizeof(LASTINPUTINFO),
      dwTime: 0,
    };
    if (!GetLastInputInfo(info)) {
      cached = { at: now, seconds: 0 };
      return 0;
    }
    const tick = GetTickCount() >>> 0;
    const last = info.dwTime >>> 0;
    const seconds = Math.floor(((tick - last) >>> 0) / 1000);
    cached = { at: now, seconds };
    return seconds;
  } catch {
    cached = { at: now, seconds: 0 };
    return 0;
  }
}
