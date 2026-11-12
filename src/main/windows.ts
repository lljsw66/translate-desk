import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

const preload = join(__dirname, '../preload/index.js');

/** 应用图标：打包后由 extraResources 提供，开发态取仓库 resources 目录 */
function appIconPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources/icon.png');
}

let mainWindow: BrowserWindow | null = null;
let popupWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let quitting = false;

export function markQuitting() {
  quitting = true;
}

function load(win: BrowserWindow, name: 'main' | 'popup' | 'settings') {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void win.loadURL(`${devUrl}/index.html?win=${name}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { query: { win: name } });
  }
}

const webPreferences = {
  preload,
  sandbox: false,
  contextIsolation: true,
  nodeIntegration: false,
};

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 520,
    height: 340,
    minWidth: 380,
    minHeight: 240,
    show: false,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#ffffff',
    icon: appIconPath(),
    webPreferences,
  });

  // 部分 Windows 环境下 ready-to-show 不触发，用 did-finish-load 兜底
  const showOnce = () => {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  };
  win.once('ready-to-show', showOnce);
  win.webContents.once('did-finish-load', showOnce);

  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });

  load(win, 'main');
  mainWindow = win;
  return win;
}

export function createPopupWindow() {
  const win = new BrowserWindow({
    width: 320,
    height: 40,
    show: false,
    frame: false,
    transparent: false,
    // setSize 在 resizable:false 时无效，Tooltip 需要按内容动态调整尺寸
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    backgroundColor: '#ffffff',
    webPreferences,
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  // Tooltip 不抢焦点也不接收鼠标，点击会穿透到下层，从而清除选区并关闭浮层
  win.setIgnoreMouseEvents(true);
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });

  load(win, 'popup');
  popupWindow = win;
  return win;
}

export function createSettingsWindow() {
  const win = new BrowserWindow({
    width: 440,
    height: 640,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    parent: mainWindow ?? undefined,
    backgroundColor: '#ffffff',
    icon: appIconPath(),
    webPreferences,
  });

  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });

  load(win, 'settings');
  settingsWindow = win;
  return win;
}

export function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

export function showSettingsWindow() {
  if (!settingsWindow) return;
  settingsWindow.show();
  settingsWindow.focus();
}

export function showPopupWindow() {
  if (!popupWindow) return;
  popupWindow.showInactive();
}

export function hidePopupWindow() {
  popupWindow?.hide();
}

/** 按渲染内容调整浮层尺寸，并保证不超出屏幕 */
export function resizePopupWindow(width: number, height: number) {
  const win = popupWindow;
  if (!win || win.isDestroyed()) return;

  const nextWidth = Math.min(Math.max(Math.round(width), 60), 480);
  const nextHeight = Math.min(Math.max(Math.round(height), 24), 220);
  const [currentWidth, currentHeight] = win.getSize();
  if (currentWidth === nextWidth && currentHeight === nextHeight) return;

  win.setSize(nextWidth, nextHeight, false);
  clampPopupPosition();
}

function clampPopupPosition() {
  const win = popupWindow;
  if (!win || win.isDestroyed()) return;

  const bounds = win.getBounds();
  const { workArea } = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const maxLeft = workArea.x + workArea.width - bounds.width - 4;
  const maxTop = workArea.y + workArea.height - bounds.height - 4;
  const left = Math.min(Math.max(bounds.x, workArea.x + 4), Math.max(workArea.x + 4, maxLeft));
  const top = Math.min(Math.max(bounds.y, workArea.y + 4), Math.max(workArea.y + 4, maxTop));

  if (left !== bounds.x || top !== bounds.y) {
    win.setPosition(Math.round(left), Math.round(top), false);
  }
}

/** 在光标附近显示划词浮层，自动避开屏幕边缘 */
export function showPopupWindowAt(text: string, x: number, y: number, to: string) {
  if (!popupWindow) return;

  const { workArea } = screen.getDisplayNearestPoint({ x, y });
  const [width, height] = popupWindow.getSize();

  let left = x + 14;
  let top = y + 18;
  if (left + width > workArea.x + workArea.width) left = x - width - 14;
  if (top + height > workArea.y + workArea.height) top = y - height - 18;

  left = Math.max(workArea.x + 4, left);
  top = Math.max(workArea.y + 4, top);

  popupWindow.setPosition(Math.round(left), Math.round(top), false);
  popupWindow.webContents.send('selection:text', { text, to });
  popupWindow.showInactive();
}
