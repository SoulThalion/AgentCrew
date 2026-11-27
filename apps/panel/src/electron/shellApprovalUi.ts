/**
 * Ventanas Cursor con card de shell: Run + Skip/Reject y el texto alrededor.
 * #16: Run/Skip en otra ventana no cuenta; el comando de este pendiente tiene que estar ahí.
 */
import { execFile } from 'node:child_process';
import { parseApprovalCardDump } from './approvalConfirm';

const PS = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$pids = @(Get-Process -Name Cursor -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
if (-not $pids) { Write-Output '0'; exit 0 }
$btn = [System.Windows.Automation.ControlType]::Button
$roots = New-Object System.Collections.Generic.List[System.Windows.Automation.AutomationElement]
foreach ($p in $pids) {
  try {
    $proc = Get-Process -Id $p -ErrorAction Stop
    $h = $proc.MainWindowHandle
    if ($h -eq [IntPtr]::Zero) { continue }
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
    if ($root) { $roots.Add($root) }
  } catch { }
}
try {
  $winCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Window)
  foreach ($win in [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
      [System.Windows.Automation.TreeScope]::Children, $winCond)) {
    $wp = 0
    try { $wp = $win.Current.ProcessId } catch { continue }
    if ($pids -contains $wp) { $roots.Add($win) }
  }
} catch { }
function Add-Names($root, $kind, $bucket) {
  $c = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty, $kind)
  foreach ($el in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $c)) {
    if ($bucket.Count -ge 120) { return }
    $n = ''
    try { $n = $el.Current.Name } catch { continue }
    if (-not $n) { continue }
    if ($n.Length -gt 160) { $n = $n.Substring(0, 160) }
    $bucket.Add($n)
  }
}
$chunks = New-Object System.Collections.Generic.List[string]
foreach ($root in $roots) {
  $run = $false; $skipOrReject = $false
  $names = New-Object System.Collections.Generic.List[string]
  try { Add-Names $root $btn $names } catch { continue }
  foreach ($n in $names) {
    if ($n -eq 'Run' -or $n -like 'Run *') { $run = $true }
    if ($n -eq 'Skip' -or $n -eq 'Reject' -or $n -eq 'Deny' -or $n -like 'Add to allowlist*') {
      $skipOrReject = $true
    }
  }
  if (-not ($run -and $skipOrReject)) { continue }
  try { Add-Names $root ([System.Windows.Automation.ControlType]::Text) $names } catch { }
  try { Add-Names $root ([System.Windows.Automation.ControlType]::Edit) $names } catch { }
  try { Add-Names $root ([System.Windows.Automation.ControlType]::Document) $names } catch { }
  $chunks.Add('##')
  foreach ($n in $names) { $chunks.Add($n) }
}
if ($chunks.Count -eq 0) { Write-Output '0' } else { $chunks -join [char]10 }
`;

let inflight: Promise<string[][]> | null = null;
let cache: { at: number; groups: string[][] } | null = null;
const CACHE_MS = 1200;

/** Grupos de nombres UIA, uno por ventana que tiene Run y Skip/Reject. */
export function approvalCardWindows(): Promise<string[][]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return Promise.resolve(cache.groups);
  if (inflight) return inflight;

  inflight = new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS],
      { windowsHide: true, timeout: 3500, maxBuffer: 256 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        inflight = null;
        const groups = err ? [] : parseApprovalCardDump(String(stdout || ''));
        cache = { at: Date.now(), groups };
        resolve(groups);
      },
    );
  });
  return inflight;
}
