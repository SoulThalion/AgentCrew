import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const FILE = 'panel-prefs.json';

export type PanelPrefs = {
  /** Electron `Display.id`. `null` = pantalla principal. */
  displayId: number | null;
};

const DEFAULTS: PanelPrefs = { displayId: null };

function prefsPath(): string {
  return path.join(app.getPath('userData'), FILE);
}

export function loadPanelPrefs(): PanelPrefs {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath(), 'utf8')) as Partial<PanelPrefs>;
    const id = raw.displayId;
    return {
      displayId: typeof id === 'number' && Number.isFinite(id) ? id : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePanelPrefs(prefs: PanelPrefs): void {
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2), 'utf8');
}
