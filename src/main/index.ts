import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
} from 'electron';
import { join } from 'node:path';
import {
  createMainWindow,
  createPopupWindow,
  createSettingsWindow,
  hidePopupWindow,
  markQuitting,
  resizePopupWindow,
  showMainWindow,
  showPopupWindowAt,
  showSettingsWindow,
} from './windows';
import { translateText } from './translate';
import { readConfig, writeConfig, type AppConfig } from './config';
import { warmUpBing } from './translate/providers/bing';
import {
  captureSelection,
  setSelectionAuto,
  startSelectionHelper,
  stopSelectionHelper,
} from './selection';
import type { LangCode, TranslateRequest } from '../shared/translate';

let tray: Tray | null = null;
let popupTarget: LangCode = 'zh';

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    createMainWindow();
    createPopupWindow();
    createSettingsWindow();
    setupTray();
    setupIpc();
    warmUpBing();
    startSelectionHelper(
      (payload) => showPopupWindowAt(payload.text, payload.x, payload.y, popupTarget),
      () => hidePopupWindow(),
    );
    globalShortcut.register('Control+Shift+D', captureSelection);
    globalShortcut.register('Control+Shift+Space', showMainWindow);
  });

  app.on('before-quit', () => {
    markQuitting();
    stopSelectionHelper();
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());

  // 常驻托盘，关闭窗口不退出进程
  app.on('window-all-closed', () => {});
}

function setupTray() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources/icon.png');

  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('译 · 桌面翻译');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗', click: showMainWindow },
      { label: '设置', click: showSettingsWindow },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]),
  );
  tray.on('click', showMainWindow);
}

function setupIpc() {
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle('window:hide', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide();
  });

  ipcMain.handle('window:toggle-pin', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const next = !win.isAlwaysOnTop();
    win.setAlwaysOnTop(next);
    return next;
  });

  ipcMain.handle('app:open-settings', () => {
    showSettingsWindow();
  });

  ipcMain.handle('translate:run', (_event, req: TranslateRequest) => translateText(req));

  ipcMain.handle('config:get', () => readConfig());

  ipcMain.handle('config:save', (_event, config: AppConfig) => {
    writeConfig(config);
  });

  ipcMain.handle('selection:set-auto', (_event, enabled: boolean) => {
    setSelectionAuto(Boolean(enabled));
    if (!enabled) hidePopupWindow();
  });

  ipcMain.handle('selection:capture', () => {
    captureSelection();
  });

  ipcMain.handle('selection:set-target', (_event, lang: LangCode) => {
    popupTarget = lang;
  });

  ipcMain.handle('popup:resize', (_event, width: number, height: number) => {
    resizePopupWindow(Number(width) || 0, Number(height) || 0);
  });
}
