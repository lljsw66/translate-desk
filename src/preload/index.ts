import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig } from '../shared/config';
import type { LangCode, TranslateRequest, TranslateResponse } from '../shared/translate';

const api = {
  minimize: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  hide: () => ipcRenderer.invoke('window:hide') as Promise<void>,
  togglePin: () => ipcRenderer.invoke('window:toggle-pin') as Promise<boolean>,
  openSettings: () => ipcRenderer.invoke('app:open-settings') as Promise<void>,
  translate: (req: TranslateRequest) =>
    ipcRenderer.invoke('translate:run', req) as Promise<TranslateResponse>,
  getConfig: () => ipcRenderer.invoke('config:get') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) =>
    ipcRenderer.invoke('config:save', config) as Promise<void>,
  setSelectionAuto: (enabled: boolean) =>
    ipcRenderer.invoke('selection:set-auto', enabled) as Promise<void>,
  captureSelection: () => ipcRenderer.invoke('selection:capture') as Promise<void>,
  setPopupTarget: (lang: LangCode) =>
    ipcRenderer.invoke('selection:set-target', lang) as Promise<void>,
  onSelectionText: (callback: (payload: { text: string; to: LangCode }) => void) => {
    ipcRenderer.on('selection:text', (_event, payload: { text: string; to: LangCode }) =>
      callback(payload),
    );
  },
  resizePopup: (width: number, height: number) =>
    ipcRenderer.invoke('popup:resize', width, height) as Promise<void>,
};

contextBridge.exposeInMainWorld('desktop', api);
