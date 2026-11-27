/**
 * #8: card Run+Skip de este comando, sin proceso → sonar ya.
 * #12: otra ventana esperando Run no está en UIA. Si no arrancó shell, tras la espera → sonar.
 * #13: powershell/cmd nuevo → silencio, aunque otra ventana tenga Run/Skip.
 * #16: Run/Skip de otra ventana, sin este comando, no suena al momento.
 */
import { execFile } from 'node:child_process';

export const SHELL_APPROVAL_GRACE_MS = 1500;
export const SHELL_APPROVAL_BACKGROUND_MS = 4000;

export type ApprovalSonar = 'speak' | 'wait' | 'suppress';

export function approvalSonarDecision(opts: {
  ageMs: number;
  cardForPending: boolean;
  commandRunning: boolean | null;
}): ApprovalSonar {
  if (opts.commandRunning === true) return 'suppress';
  if (opts.cardForPending) return 'speak';
  if (opts.commandRunning === false && opts.ageMs >= SHELL_APPROVAL_BACKGROUND_MS) {
    return 'speak';
  }
  return 'wait';
}

/** Trozo del comando que tiene que verse en la misma ventana que Run y Skip. */
export function approvalNeedle(command: string): string {
  return commandSnippet(command).slice(0, 24);
}

function isRunButton(name: string): boolean {
  return name === 'Run' || name.startsWith('Run ');
}

function isSkipButton(name: string): boolean {
  return (
    name === 'Skip' ||
    name === 'Reject' ||
    name === 'Deny' ||
    name.startsWith('Add to allowlist')
  );
}

/** Nombres UIA de una sola ventana. Vacío si no hay card de esos comandos. */
export function needlesInApprovalCard(names: string[], commands: string[]): string[] {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.some(isRunButton) || !clean.some(isSkipButton)) return [];
  const blob = clean.map((n) => n.toLowerCase().replace(/\s+/g, ' ')).join('\n');
  const hits: string[] = [];
  for (const command of commands) {
    const needle = approvalNeedle(command);
    if (needle && blob.includes(needle)) hits.push(needle);
  }
  return hits;
}

/** Varias ventanas separadas por una línea `##`. `0` = ninguna card. */
export function parseApprovalCardDump(stdout: string): string[][] {
  const raw = stdout.trim();
  if (!raw || raw === '0') return [];
  const groups: string[][] = [];
  let cur: string[] | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === '##') {
      if (cur && cur.length) groups.push(cur);
      cur = [];
      continue;
    }
    if (cur && line.trim()) cur.push(line.trim());
  }
  if (cur && cur.length) groups.push(cur);
  return groups;
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
