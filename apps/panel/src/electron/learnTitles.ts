/**
 * Aprende títulos UI de Cursor.
 * Cursor actual: TabItem "{título}, Chat Editors: Editor Group N"
 * Legacy también: botón "Open agent {título}"
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  listAgents,
  readTitulo,
  writeTitulo,
  readText,
  filePrompt,
} from '@agentcrew/core';

let busy = false;
let lastRun = 0;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readPrompt(stateDir: string, id: string): string {
  const raw = (readText(filePrompt(stateDir, id)) ?? '').trim();
  return raw.replace(/\\[nrt]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function isJunkTitle(t: string): boolean {
  const n = t.trim();
  if (n.length < 2 || n.length > 120) return true;
  if (/^new agent$/i.test(n)) return true;
  if (/^agents? window$/i.test(n)) return true;
  return false;
}

function scrapePs(): Promise<string[]> {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -ReferencedAssemblies @('UIAutomationClient','UIAutomationTypes','WindowsBase') -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Windows.Automation;
public static class ListAgentTitles {
  static bool Selected(AutomationElement el) {
    AutomationElement cur = el;
    for (int i = 0; i < 3 && cur != null; i++) {
      try {
        object pat;
        if (cur.TryGetCurrentPattern(SelectionItemPattern.Pattern, out pat)) {
          var sel = pat as SelectionItemPattern;
          if (sel != null && sel.Current.IsSelected) return true;
        }
      } catch { }
      try { cur = TreeWalker.ControlViewWalker.GetParent(cur); } catch { break; }
    }
    return false;
  }
  static void AddTitle(HashSet<string> seen, List<string> lines, string t, bool sel) {
    if (string.IsNullOrWhiteSpace(t)) return;
    t = t.Trim();
    if (t.Length < 2 || t.Length > 120) return;
    if (string.Equals(t, "New Agent", StringComparison.OrdinalIgnoreCase)) return;
    if (!seen.Add(t)) return;
    lines.Add((sel ? "*" : "") + t);
  }
  public static string Go() {
    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var lines = new List<string>();
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
          if (marca > 0) {
            AddTitle(seen, lines, nombre.Substring(0, marca).Trim(), Selected(el));
            continue;
          }
        }
        var btnCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button);
        foreach (AutomationElement el in root.FindAll(TreeScope.Descendants, btnCond)) {
          string nombre = "";
          try { nombre = el.Current.Name ?? ""; } catch { continue; }
          if (nombre.StartsWith("Open agent ", StringComparison.OrdinalIgnoreCase)) {
            AddTitle(seen, lines, nombre.Substring("Open agent ".Length).Trim(), Selected(el));
          }
        }
      } catch { }
    }
    return string.Join("|", lines);
  }
}
"@
[ListAgentTitles]::Go()
`;
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, encoding: 'utf8', timeout: 7000, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve([]);
          return;
        }
        const titles = String(stdout)
          .split('|')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && l.length <= 120 && !l.includes('ListAgentTitles'))
          .filter((l) => !isJunkTitle(l.startsWith('*') ? l.slice(1) : l));
        resolve(titles);
      },
    );
  });
}

type AgentCand = {
  id: string;
  promptN: string;
  tituloN: string;
};

export function matchAndSaveTitles(stateDir: string, uiRaw: string[]): number {
  const focused = uiRaw
    .filter((t) => t.startsWith('*'))
    .map((t) => t.slice(1).trim())
    .filter((t) => t && !isJunkTitle(t));
  const uiTitles = uiRaw
    .map((t) => (t.startsWith('*') ? t.slice(1) : t).trim())
    .filter((t) => t && !isJunkTitle(t));
  if (uiTitles.length === 0) return 0;

  const agents = listAgents(stateDir, { pruneOlderThan24h: false });
  const cands: AgentCand[] = agents.map((a) => ({
    id: a.id,
    promptN: norm(readPrompt(stateDir, a.id)),
    tituloN: norm(readTitulo(stateDir, a.id)),
  }));

  const used = new Set<string>();
  let updated = 0;

  const assign = (id: string, title: string) => {
    const prev = readTitulo(stateDir, id).trim();
    if (prev !== title) {
      writeTitulo(stateDir, id, title);
      updated++;
    }
    used.add(id);
  };

  // Foco UI → único agente activo
  if (focused.length === 1) {
    const active = agents.filter((a) =>
      ['trabajando', 'planificando', 'leyendo', 'subagentes', 'esperando'].includes(
        String(a.state),
      ),
    );
    if (active.length === 1) {
      assign(active[0]!.id, focused[0]!);
    }
  }

  for (const title of uiTitles) {
    const tn = norm(title);
    if (!tn) continue;

    const byTitulo = cands.filter((c) => !used.has(c.id) && c.tituloN && c.tituloN === tn);
    if (byTitulo.length === 1) {
      assign(byTitulo[0]!.id, title);
      continue;
    }

    const byPrompt = cands.filter((c) => !used.has(c.id) && c.promptN && c.promptN === tn);
    if (byPrompt.length === 1) {
      assign(byPrompt[0]!.id, title);
      continue;
    }

    const byPrefix = cands.filter((c) => {
      if (used.has(c.id) || !c.promptN) return false;
      if (c.promptN.startsWith(tn) || tn.startsWith(c.promptN)) return true;
      if (tn.length >= 6 && c.promptN.includes(tn)) return true;
      return false;
    });
    if (byPrefix.length === 1) {
      assign(byPrefix[0]!.id, title);
    }
  }

  const orphans = cands.filter((c) => !used.has(c.id) && !readTitulo(stateDir, c.id).trim());
  const claimed = new Set(
    [...used].map((id) => norm(readTitulo(stateDir, id))).filter(Boolean),
  );
  const freeUi = uiTitles.filter((t) => !claimed.has(norm(t)));
  if (freeUi.length === 1 && orphans.length === 1) {
    assign(orphans[0]!.id, freeUi[0]!);
  }

  return updated;
}

export async function learnTitlesOnce(stateDir: string): Promise<number> {
  if (process.platform !== 'win32') return 0;
  if (busy) return 0;
  const now = Date.now();
  if (now - lastRun < 1500) return 0;
  busy = true;
  lastRun = now;
  try {
    if (!fs.existsSync(stateDir)) return 0;
    const titles = await scrapePs();
    try {
      fs.writeFileSync(path.join(stateDir, 'ui-titles.txt'), titles.join('\n'), 'utf8');
    } catch {
      /* ignore */
    }
    if (titles.length === 0) return 0;
    return matchAndSaveTitles(stateDir, titles);
  } catch {
    return 0;
  } finally {
    busy = false;
  }
}
