import type { AppConfig } from '@shared/config';
import type { LangCode, TranslateRequest, TranslateResponse } from '@shared/translate';

export async function minimizeWindow() {
  await window.desktop?.minimize();
}

export async function hideWindow() {
  await window.desktop?.hide();
}

export async function toggleAlwaysOnTop(): Promise<boolean> {
  return (await window.desktop?.togglePin()) ?? false;
}

export async function openSettings() {
  await window.desktop?.openSettings();
}

export async function translateText(req: TranslateRequest): Promise<TranslateResponse> {
  if (!window.desktop) {
    return { ok: false, message: '桌面环境未就绪', attempts: [] };
  }
  return window.desktop.translate(req);
}

export async function setSelectionAuto(enabled: boolean) {
  await window.desktop?.setSelectionAuto(enabled);
}

export async function getConfig(): Promise<AppConfig> {
  return (await window.desktop?.getConfig()) ?? {};
}

export async function saveConfig(config: AppConfig) {
  await window.desktop?.saveConfig(config);
}

export async function setPopupTarget(lang: LangCode) {
  await window.desktop?.setPopupTarget(lang);
}

export function onSelectionText(callback: (payload: { text: string; to: LangCode }) => void) {
  window.desktop?.onSelectionText(callback);
}

export async function resizePopup(width: number, height: number) {
  await window.desktop?.resizePopup(width, height);
}
