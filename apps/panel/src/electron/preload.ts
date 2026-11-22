import { contextBridge, ipcRenderer } from 'electron';

const bootPage = process.argv
  .find((a) => a.startsWith('--agentcrew-page='))
  ?.slice('--agentcrew-page='.length);

contextBridge.exposeInMainWorld('agentcrewBoot', {
  page: bootPage === 'settings' ? 'settings' : 'strip',
});

contextBridge.exposeInMainWorld('agentcrew', {
  listAgents: (): Promise<string> => ipcRenderer.invoke('agents:list'),
  focusAgent: (payload?: string | { id?: string; title?: string }): Promise<boolean> =>
    ipcRenderer.invoke('agents:focus', payload),
  showHoverCard: (payload: {
    title: string;
    state: string;
    stateColor: string;
    phrase: string;
    anchorX: number;
    anchorY: number;
    anchorH: number;
  }): Promise<boolean> => ipcRenderer.invoke('hover:show', payload),
  hideHoverCard: (): Promise<boolean> => ipcRenderer.invoke('hover:hide'),
  onAgentsUpdate: (cb: (payload: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: string) => cb(payload);
    ipcRenderer.on('agents:update', handler);
    return () => ipcRenderer.removeListener('agents:update', handler);
  },
  getSettings: (): Promise<unknown> => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:save', patch),
  testVoice: (text?: string): Promise<unknown> =>
    ipcRenderer.invoke('settings:test', text),
  openSettings: (): Promise<boolean> => ipcRenderer.invoke('settings:open'),
  openFishPortal: (): Promise<{ ok: boolean; url: string }> =>
    ipcRenderer.invoke('fish:openPortal'),
  listDisplays: (): Promise<unknown> => ipcRenderer.invoke('dock:listDisplays'),
  setDisplay: (displayId: number | null): Promise<unknown> =>
    ipcRenderer.invoke('dock:setDisplay', displayId),
  getPanelPrefs: (): Promise<unknown> => ipcRenderer.invoke('prefs:get'),
  toggleMute: (): Promise<{ muted: boolean }> => ipcRenderer.invoke('prefs:toggleMute'),
  setMuestra: (on: boolean): Promise<unknown> =>
    ipcRenderer.invoke('prefs:setMuestra', on),
  stopPanel: (): Promise<boolean> => ipcRenderer.invoke('panel:stop'),
  quitPanel: (): Promise<boolean> => ipcRenderer.invoke('panel:quit'),
  onPrefsUpdate: (cb: (prefs: unknown) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, prefs: unknown) => cb(prefs);
    ipcRenderer.on('prefs:update', handler);
    return () => ipcRenderer.removeListener('prefs:update', handler);
  },
});
