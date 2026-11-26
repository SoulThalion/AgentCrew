/// <reference types="vite/client" />

interface PanelPrefsView {
  muted: boolean;
  muteUntil: string | null;
  volume: number;
  aviso: 'voz' | 'sonido';
  cuando: 'siempre' | 'inactivo';
  muestra: boolean;
}

interface AgentCrewApi {
  listAgents: () => Promise<string>;
  focusAgent: (payload?: string | { id?: string; title?: string }) => Promise<boolean>;
  showHoverCard: (payload: {
    title: string;
    state: string;
    stateColor: string;
    phrase: string;
    anchorX: number;
    anchorY: number;
    anchorH: number;
  }) => Promise<boolean>;
  hideHoverCard: () => Promise<boolean>;
  onAgentsUpdate: (cb: (payload: string) => void) => () => void;
  getSettings: () => Promise<unknown>;
  saveSettings: (patch: unknown) => Promise<unknown>;
  testVoice: (text?: string) => Promise<unknown>;
  discoverCast: () => Promise<{
    ok: boolean;
    devices: Array<{ name: string; host: string; port: number }>;
    error?: string;
  }>;
  testCast: () => Promise<{
    ok: boolean;
    device?: { name: string; host: string; port: number };
    url?: string;
    error?: string;
  }>;
  listCastLanIps: (opts?: {
    announceIp?: string;
    preferHost?: string;
  }) => Promise<{
    ok: boolean;
    ips: string[];
    resolved: string;
  }>;
  openSettings: () => Promise<boolean>;
  openFishPortal: () => Promise<{ ok: boolean; url: string }>;
  listDisplays: () => Promise<{
    currentId: number;
    primaryId: number;
    displays: Array<{ id: number; label: string; primary: boolean }>;
  }>;
  setDisplay: (displayId: number | null) => Promise<{
    currentId: number;
    primaryId: number;
    displays: Array<{ id: number; label: string; primary: boolean }>;
  }>;
  getPanelPrefs: () => Promise<PanelPrefsView>;
  toggleMute: () => Promise<PanelPrefsView>;
  setMuestra: (on: boolean) => Promise<PanelPrefsView>;
  stopPanel: () => Promise<boolean>;
  quitPanel: () => Promise<boolean>;
  onPrefsUpdate: (cb: (prefs: PanelPrefsView) => void) => () => void;
}

interface Window {
  agentcrew: AgentCrewApi;
  agentcrewBoot?: { page: 'settings' | 'strip' };
}
