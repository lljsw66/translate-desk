/// <reference types="vite/client" />

interface DesktopApi {
  minimize: () => Promise<void>;
  hide: () => Promise<void>;
  togglePin: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  translate: (
    req: import('@shared/translate').TranslateRequest,
  ) => Promise<import('@shared/translate').TranslateResponse>;
  getConfig: () => Promise<import('@shared/config').AppConfig>;
  saveConfig: (config: import('@shared/config').AppConfig) => Promise<void>;
  setSelectionAuto: (enabled: boolean) => Promise<void>;
  captureSelection: () => Promise<void>;
  setPopupTarget: (lang: import('@shared/translate').LangCode) => Promise<void>;
  onSelectionText: (
    callback: (payload: {
      text: string;
      to: import('@shared/translate').LangCode;
    }) => void,
  ) => void;
  resizePopup: (width: number, height: number) => Promise<void>;
}

interface Window {
  desktop?: DesktopApi;
}
