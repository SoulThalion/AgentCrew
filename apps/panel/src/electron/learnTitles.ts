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
  resolveFocusedIds,
} from '@agentcrew/core';

let busy = false;
let lastRun = 0;
/** Ids de agente cuyo título UI está seleccionado (foco). */
let cachedFocusedIds: string[] = [];
/** Títulos de chats abiertos en Cursor (sin marca de foco). */
let cachedUiTitles: string[] = [];
/** Títulos con tab seleccionado. */
let cachedFocusedTitles: string[] = [];

export function getFocusedAgentIds(): string[] {
  return cachedFocusedIds.slice();
}

export function getUiChatTitles(): string[] {
  return cachedUiTitles.slice();
}

export function getFocusedChatTitles(): string[] {
  return cachedFocusedTitles.slice();
}

/** Tras click en sprite: tratar como foco hasta próximo scrape UIA. */
export function noteFocusedAgentId(id: string): void {
  if (!id.trim()) return;
  cachedFocusedIds = [id.trim()];
}

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
  // Solo cobertura UIA. Dedup por título (case-insensitive) → 1 fila UI / título
  // (evita sprites duplicados). No cambia matching learnTitles/compose.
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
    if (!seen.Add(t)) {
      // Mismo título otra vez: solo subir marca de foco (no segunda fila)
      if (!sel) return;
      for (int i = 0; i < lines.Count; i++) {
        string bare = lines[i].StartsWith("*") ? lines[i].Substring(1) : lines[i];
        if (string.Equals(bare, t, StringComparison.OrdinalIgnoreCase)) {
          if (!lines[i].StartsWith("*")) lines[i] = "*" + bare;
          break;
        }
      }
      return;
    }
    lines.Add((sel ? "*" : "") + t);
  }
  static void ScrapeRoot(AutomationElement root, HashSet<string> seen, List<string> lines) {
    if (root == null) return;
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
        // Variante sin coma / texto distinto pero con Chat Editors
        marca = nombre.IndexOf("Chat Editors", StringComparison.OrdinalIgnoreCase);
        if (marca > 0) {
          string tit = nombre.Substring(0, marca).Trim().TrimEnd(',', ' ', '-', ':');
          AddTitle(seen, lines, tit, Selected(el));
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
  public static string Go() {
    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var lines = new List<string>();
    var pids = new HashSet<int>();
    foreach (var proc in Process.GetProcessesByName("Cursor")) {
      try { pids.Add(proc.Id); } catch { }
    }
    if (pids.Count == 0) return "";
    // Todas las ventanas top-level de procesos Cursor (no solo MainWindowHandle)
    try {
      var winCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Window);
      foreach (AutomationElement win in AutomationElement.RootElement.FindAll(TreeScope.Children, winCond)) {
        int pid = 0;
        try { pid = win.Current.ProcessId; } catch { continue; }
        if (!pids.Contains(pid)) continue;
        ScrapeRoot(win, seen, lines);
      }
    } catch { }
    // Fallback MainWindowHandle por si Children no listó alguna
    foreach (var proc in Process.GetProcessesByName("Cursor")) {
      IntPtr h = IntPtr.Zero;
      try { h = proc.MainWindowHandle; } catch { continue; }
      if (h == IntPtr.Zero) continue;
      AutomationElement root = null;
      try { root = AutomationElement.FromHandle(h); } catch { continue; }
      ScrapeRoot(root, seen, lines);
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
      { windowsHide: true, encoding: 'utf8', timeout: 12000, maxBuffer: 2 * 1024 * 1024 },
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

  const uiNormSet = new Set(uiTitles.map(norm).filter(Boolean));

  const agents = listAgents(stateDir, {
    pruneOlderThan24h: false,
    applyPose: false,
  });
  const cands: AgentCand[] = agents.map((a) => ({
    id: a.id,
    promptN: norm(readPrompt(stateDir, a.id)),
    tituloN: norm(readTitulo(stateDir, a.id)),
  }));

  const used = new Set<string>();
  let updated = 0;

  /** No pisar titulo de chat aún abierto (evita cruces foco≠activo). */
  const assign = (id: string, title: string): boolean => {
    const prev = readTitulo(stateDir, id).trim();
    const prevN = norm(prev);
    const titleN = norm(title);
    if (prev && prevN !== titleN && uiNormSet.has(prevN)) {
      return false;
    }
    if (prev !== title) {
      writeTitulo(stateDir, id, title);
      updated++;
      const cand = cands.find((c) => c.id === id);
      if (cand) cand.tituloN = titleN;
    }
    used.add(id);
    return true;
  };

  // Click sprite → id conocido + tab enfocado: único enlace seguro foco↔agente
  const clickIds = cachedFocusedIds.filter((id) => agents.some((a) => a.id === id));
  if (focused.length === 1 && clickIds.length === 1) {
    assign(clickIds[0]!, focused[0]!);
  }

  // NO: "1 foco + 1 activo → assign" (cruzaba chat idle enfocado con otro trabajando)

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

    // Prefijo solo si título UI ≥ 12 chars (evita includes cortos ambiguos)
    const byPrefix = cands.filter((c) => {
      if (used.has(c.id) || !c.promptN || tn.length < 12) return false;
      if (c.promptN.startsWith(tn) || tn.startsWith(c.promptN)) return true;
      if (c.promptN.includes(tn)) return true;
      return false;
    });
    if (byPrefix.length === 1) {
      assign(byPrefix[0]!.id, title);
    }
  }

  const orphans = cands.filter((c) => !used.has(c.id) && !c.tituloN);
  const claimed = new Set(
    cands.filter((c) => used.has(c.id) && c.tituloN).map((c) => c.tituloN),
  );
  let freeUi = uiTitles.filter((t) => !claimed.has(norm(t)));
  if (freeUi.length === 1 && orphans.length === 1) {
    assign(orphans[0]!.id, freeUi[0]!);
  }

  // Reparar sticky malo: varios agentes mismo título UI + chat UI sin dueño.
  // Keeper = ya used de ese título si existe; surplus = activos no used del grupo.
  const ACTIVE = new Set([
    'trabajando',
    'planificando',
    'leyendo',
    'esperando',
    'subagentes',
  ]);
  const ownedTitulos = new Set(
    cands.filter((c) => c.tituloN && uiNormSet.has(c.tituloN)).map((c) => c.tituloN),
  );
  freeUi = uiTitles.filter((t) => !ownedTitulos.has(norm(t)));
  if (freeUi.length > 0) {
    const byTit = new Map<string, typeof cands>();
    for (const c of cands) {
      if (!c.tituloN || !uiNormSet.has(c.tituloN)) continue;
      const arr = byTit.get(c.tituloN) ?? [];
      arr.push(c);
      byTit.set(c.tituloN, arr);
    }
    const pool: typeof cands = [];
    for (const [, group] of byTit) {
      if (group.length <= 1) continue;
      const keeper =
        group.find((c) => used.has(c.id)) ??
        [...group].sort((a, b) => {
          const aa = agents.find((x) => x.id === a.id);
          const bb = agents.find((x) => x.id === b.id);
          const aAct = aa && ACTIVE.has(String(aa.state)) ? 0 : 1;
          const bAct = bb && ACTIVE.has(String(bb.state)) ? 0 : 1;
          if (aAct !== bAct) return aAct - bAct;
          return (aa?.ageMs ?? 0) - (bb?.ageMs ?? 0);
        })[0];
      for (const c of group) {
        if (c.id === keeper?.id || used.has(c.id)) continue;
        const ag = agents.find((x) => x.id === c.id);
        if (ag && ACTIVE.has(String(ag.state))) pool.push(c);
      }
    }
    pool.sort((a, b) => {
      const aa = agents.find((x) => x.id === a.id);
      const bb = agents.find((x) => x.id === b.id);
      return (aa?.ageMs ?? 0) - (bb?.ageMs ?? 0);
    });
    for (const title of freeUi) {
      const next = pool.shift();
      if (!next) break;
      const titleN = norm(title);
      if (next.tituloN === titleN) {
        used.add(next.id);
        continue;
      }
      writeTitulo(stateDir, next.id, title);
      next.tituloN = titleN;
      used.add(next.id);
      updated++;
      ownedTitulos.add(titleN);
    }
  }

  cachedFocusedTitles = focused;
  cachedUiTitles = uiTitles;
  // Preferir agente activo si hay títulos duplicados (no marcar visto al terminado hermano)
  cachedFocusedIds = resolveFocusedIds(stateDir, agents, focused);

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
    if (titles.length === 0) {
      cachedFocusedIds = [];
      cachedFocusedTitles = [];
      // Conservar últimos títulos conocidos si scrape vacío (UI parpadea)
      return 0;
    }
    return matchAndSaveTitles(stateDir, titles);
  } catch {
    return 0;
  } finally {
    busy = false;
  }
}
