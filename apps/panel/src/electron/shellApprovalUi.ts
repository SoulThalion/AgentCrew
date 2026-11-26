/**
 * ¿Cursor muestra card Pending approval de Shell? (botones Run + Skip/Reject).
 * Issue #8: grace solo no basta — auto-run largo también deja shell-* vivo.
 */
import { execFile } from 'node:child_process';

const PS = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$pids = @(Get-Process -Name Cursor -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
if (-not $pids) { Write-Output '0'; exit 0 }
$run = $false; $skipOrReject = $false
$btn = [System.Windows.Automation.ControlType]::Button
$cond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty, $btn)
foreach ($p in $pids) {
  try {
    $proc = Get-Process -Id $p -ErrorAction Stop
    $h = $proc.MainWindowHandle
    if ($h -eq [IntPtr]::Zero) { continue }
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
    if (-not $root) { continue }
    foreach ($el in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)) {
      $n = ''
      try { $n = $el.Current.Name } catch { continue }
      if (-not $n) { continue }
      if ($n -eq 'Run' -or $n -like 'Run *') { $run = $true }
      if ($n -eq 'Skip' -or $n -eq 'Reject' -or $n -eq 'Deny' -or $n -like 'Add to allowlist*') {
        $skipOrReject = $true
      }
      if ($run -and $skipOrReject) { Write-Output '1'; exit 0 }
    }
  } catch { }
}
Write-Output '0'
`;

let inflight: Promise<boolean> | null = null;
let cache: { at: number; yes: boolean } | null = null;
const CACHE_MS = 1200;

export function cursorShowsShellApprovalUi(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return Promise.resolve(cache.yes);
  if (inflight) return inflight;

  inflight = new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS],
      { windowsHide: true, timeout: 3500, maxBuffer: 16 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        inflight = null;
        const yes = !err && String(stdout || '').trim().startsWith('1');
        cache = { at: Date.now(), yes };
        resolve(yes);
      },
    );
  });
  return inflight;
}
