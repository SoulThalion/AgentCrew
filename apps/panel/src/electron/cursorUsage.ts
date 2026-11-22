/**
 * Uso Cursor (paridad Pedir-Uso / uso.txt legacy).
 * Token solo en main (PowerShell + winsqlite3 + DPAPI); nunca al renderer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeAtomic } from '@agentcrew/core';

const execFileAsync = promisify(execFile);
const MIN_INTERVAL_MS = 90_000;

export type UsoLabels = {
  incluido: string;
  otros: string;
};

let busy = false;
let lastFetch = 0;
let cachedToken = '';
let cachedExp = 0;

function formatPct(n: number): string {
  return `${Math.round(n)}%`;
}

function firstPct(text: string): number | null {
  const m = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function tokenScriptPath(): string {
  // Dev: junto a fuentes. Build: copiado a dist-electron/
  const beside = path.join(__dirname, 'cursorToken.ps1');
  if (fs.existsSync(beside)) return beside;
  return path.join(__dirname, '..', 'src', 'electron', 'cursorToken.ps1');
}

export async function readCursorAccessToken(): Promise<string> {
  if (process.platform !== 'win32') return '';
  const script = tokenScriptPath();
  if (!fs.existsSync(script)) return '';
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, timeout: 20_000, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 },
    );
    const token = String(stdout || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith('eyJ') && l.length > 40);
    return token || '';
  } catch {
    return '';
  }
}

function tokenExpMs(jwt: string): number {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2 || !parts[1]) return 0;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const m = json.match(/"exp"\s*:\s*(\d+)/);
    if (m?.[1]) return Number(m[1]) * 1000;
  } catch {
    /* ignore */
  }
  return 0;
}

function rememberToken(jwt: string): void {
  cachedToken = jwt;
  const exp = tokenExpMs(jwt);
  cachedExp = exp > 0 ? exp : Date.now() + 60 * 60 * 1000;
}

async function fetchJson(
  url: string,
  method: 'GET' | 'POST',
  token: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  let body: string | undefined;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    headers['Connect-Protocol-Version'] = '1';
    body = '{}';
  }
  const res = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) {
    const err = new Error('401') as Error & { status: number };
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type Planish = {
  autoPercentUsed?: number;
  apiPercentUsed?: number;
  includedSpend?: number;
  limit?: number;
};

function planFrom(origen: unknown): Planish | null {
  if (!origen || typeof origen !== 'object') return null;
  const o = origen as Record<string, unknown>;
  const plan =
    o.planUsage ??
    (o.individualUsage as { plan?: unknown } | undefined)?.plan ??
    o.plan;
  if (!plan || typeof plan !== 'object') return null;
  return plan as Planish;
}

function extractPercents(periodo: unknown, resumen: unknown): {
  inc: number | null;
  otr: number | null;
} {
  let inc: number | null = null;
  let otr: number | null = null;
  for (const origen of [periodo, resumen]) {
    const plan = planFrom(origen);
    if (!plan) continue;
    if (inc == null && typeof plan.autoPercentUsed === 'number') {
      inc = plan.autoPercentUsed;
    }
    if (otr == null && typeof plan.apiPercentUsed === 'number') {
      otr = plan.apiPercentUsed;
    }
    if (
      inc == null &&
      typeof plan.limit === 'number' &&
      plan.limit > 0 &&
      typeof plan.includedSpend === 'number'
    ) {
      inc = (100 * plan.includedSpend) / plan.limit;
    }
  }
  const p = periodo as {
    displayMessage?: string;
    namedModelSelectedDisplayMessage?: string;
  } | null;
  if (inc == null && p) inc = firstPct(String(p.displayMessage ?? ''));
  if (otr == null && p) {
    otr = firstPct(String(p.namedModelSelectedDisplayMessage ?? ''));
  }
  return { inc, otr };
}

export function readUsoLabels(stateDir: string): UsoLabels {
  try {
    const raw = fs.readFileSync(path.join(stateDir, 'uso.txt'), 'utf8').trim();
    const parts = raw.split('|');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { incluido: parts[0].trim(), otros: parts[1].trim() };
    }
  } catch {
    /* ignore */
  }
  return { incluido: 'Inc -', otros: 'Otr -' };
}

export function writeUsoLabels(stateDir: string, labels: UsoLabels): void {
  fs.mkdirSync(stateDir, { recursive: true });
  writeAtomic(
    path.join(stateDir, 'uso.txt'),
    `${labels.incluido}|${labels.otros}`,
    'utf8',
  );
}

async function fetchBoth(token: string): Promise<{
  periodo: unknown;
  resumen: unknown;
}> {
  let periodo: unknown = null;
  let resumen: unknown = null;
  try {
    periodo = await fetchJson(
      'https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage',
      'POST',
      token,
    );
  } catch (e) {
    // Solo periodo 401 fuerza renovar JWT; resumen suele 401 con accessToken local
    if ((e as { status?: number }).status === 401) throw e;
  }
  try {
    resumen = await fetchJson(
      'https://cursor.com/api/usage-summary',
      'GET',
      token,
    );
  } catch {
    /* opcional: usage-summary a menudo 401; GetCurrentPeriodUsage basta */
  }
  return { periodo, resumen };
}

function logUsoError(stateDir: string, msg: string): void {
  try {
    const line = `${new Date().toISOString()} uso ${msg.slice(0, 160)}\n`;
    fs.appendFileSync(path.join(stateDir, 'panel-error.log'), line, 'utf8');
  } catch {
    /* ignore */
  }
}

export async function refreshCursorUsage(stateDir: string): Promise<boolean> {
  if (busy) return false;
  if (Date.now() - lastFetch < MIN_INTERVAL_MS) return false;
  busy = true;
  try {
    let token = '';
    if (cachedToken && cachedExp > Date.now() + 60_000) {
      token = cachedToken;
    }
    if (!token) {
      token = await readCursorAccessToken();
      if (token) rememberToken(token);
    }
    if (!token) {
      logUsoError(stateDir, 'sin sesion de Cursor');
      return false;
    }

    let datos: { periodo: unknown; resumen: unknown };
    try {
      datos = await fetchBoth(token);
    } catch (e) {
      if ((e as { status?: number }).status !== 401) {
        logUsoError(
          stateDir,
          e instanceof Error ? e.message : 'fetch uso fallo',
        );
        return false;
      }
      cachedToken = '';
      cachedExp = 0;
      token = await readCursorAccessToken();
      if (!token) {
        logUsoError(stateDir, '401 y sin sesion de Cursor');
        return false;
      }
      rememberToken(token);
      datos = await fetchBoth(token);
    }

    if (datos.periodo == null && datos.resumen == null) {
      logUsoError(stateDir, 'uso no disponible');
      return false;
    }
    const { inc, otr } = extractPercents(datos.periodo, datos.resumen);
    const labels: UsoLabels = {
      incluido: inc == null ? 'Inc -' : `Inc ${formatPct(inc)}`,
      otros: otr == null ? 'Otr -' : `Otr ${formatPct(otr)}`,
    };
    writeUsoLabels(stateDir, labels);
    lastFetch = Date.now();
    return true;
  } catch (e) {
    logUsoError(stateDir, e instanceof Error ? e.message : 'uso fallo');
    return false;
  } finally {
    busy = false;
  }
}
