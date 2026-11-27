/**
 * #8: card visible y sin proceso → sonar.
 * #13: powershell/cmd nuevo → silencio, aunque la card salga en otra ventana.
 * #16: sin card no hay sonar por espera; el auto-run corto ya terminado tampoco.
 */
import { execFile } from 'node:child_process';

export const SHELL_APPROVAL_GRACE_MS = 1500;

export type ApprovalSonar = 'speak' | 'wait' | 'suppress';

export function approvalSonarDecision(opts: {
  ageMs: number;
  uiVisible: boolean;
  commandRunning: boolean | null;
}): ApprovalSonar {
  if (opts.commandRunning === true) return 'suppress';
  if (opts.uiVisible) return 'speak';
  return 'wait';
}

const PROBE_SHELL = /get-ciminstance|uiautomation|automationelement/;

/** Shell de usuario (no la sonda UIA/WMI del panel) arrancado tras el marker. */
export function userShellStarted(
  procs: { t: number; c: string }[],
  sinceMs: number,
): boolean {
  const since = sinceMs - 2000;
  return procs.some((p) => {
    if (p.t < since) return false;
    const c = p.c.toLowerCase();
    if (PROBE_SHELL.test(c)) return false;
    return /powershell|pwsh(?:\.exe)?|cmd\.exe|bash(?:\.exe)?/.test(c);
  });
}

export function commandSnippet(command: string): string {
  const n = command.toLowerCase().replace(/\s+/g, ' ').trim();
  if (n.length < 8) return '';
  return n.slice(0, 100);
}

export function matchCommandRunning(
  command: string,
  procs: { t: number; c: string }[],
  sinceMs: number,
): boolean | null {
  const snippet = commandSnippet(command);
  const since = sinceMs - 2000;
  const textHit =
    !!snippet &&
    procs.some(
      (p) => p.t >= since && p.c.toLowerCase().replace(/\s+/g, ' ').includes(snippet),
    );
  if (textHit || userShellStarted(procs, sinceMs)) return true;
  if (!snippet) return null;
  return false;
}

export function readShellCommand(raw: string): string {
  const lines = raw.split(/\r?\n/);
  return lines.slice(1).join('\n').trim();
}

let procInflight: Promise<{ t: number; c: string }[] | null> | null = null;
let procCache: { at: number; procs: { t: number; c: string }[] | null } | null = null;
const PROC_CACHE_MS = 1200;

const PROC_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$cut = (Get-Date).AddMinutes(-3)
$arr = @(Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and $_.CreationDate -and $_.CreationDate -gt $cut
} | ForEach-Object {
  $len = [Math]::Min(2000, $_.CommandLine.Length)
  $ms = [DateTimeOffset]::new($_.CreationDate).ToUnixTimeMilliseconds()
  [pscustomobject]@{ t = $ms; c = $_.CommandLine.Substring(0, $len) }
})
if ($arr.Count -eq 0) { Write-Output '[]' } else { $arr | ConvertTo-Json -Compress }
`;

export function listRecentProcessCommandLines(): Promise<{ t: number; c: string }[] | null> {
  const now = Date.now();
  if (procCache && now - procCache.at < PROC_CACHE_MS) return Promise.resolve(procCache.procs);
  if (procInflight) return procInflight;
  procInflight = new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PROC_PS],
      { windowsHide: true, timeout: 4000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        procInflight = null;
        if (err) {
          procCache = { at: Date.now(), procs: null };
          resolve(null);
          return;
        }
        const procs = parseProcs(String(stdout || ''));
        procCache = { at: Date.now(), procs };
        resolve(procs);
      },
    );
  });
  return procInflight;
}

function parseProcs(stdout: string): { t: number; c: string }[] {
  const raw = stdout.trim();
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    const arr = Array.isArray(data) ? data : [data];
    const out: { t: number; c: string }[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const t = Number((item as { t?: unknown }).t);
      const c = (item as { c?: unknown }).c;
      if (!Number.isFinite(t) || typeof c !== 'string' || !c) continue;
      out.push({ t, c });
    }
    return out;
  } catch {
    return [];
  }
}
