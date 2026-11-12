import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { app } from 'electron';

export interface SelectionPayload {
  text: string;
  x: number;
  y: number;
}

type SelectionHandler = (payload: SelectionPayload) => void;

/** 仅在浏览器窗口内取词，其他软件前台时忽略 */
const ALLOW_PROCESSES = [
  'chrome',
  'msedge',
  'firefox',
  'brave',
  'opera',
  'vivaldi',
  'chromium',
  'arc',
  '360se',
  '360chrome',
  '360chromex',
  'qqbrowser',
  'sogouexplorer',
  'ucbrowser',
  'iexplore',
  'liebao',
  'maxthon',
].join(',');

let child: ChildProcessWithoutNullStreams | null = null;
let handler: SelectionHandler | null = null;
let dismissHandler: (() => void) | null = null;
let autoEnabled = true;
let quitting = false;
let restartTimer: NodeJS.Timeout | null = null;

function scriptPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'selection-helper.ps1')
    : join(app.getAppPath(), 'resources', 'selection-helper.ps1');
}

function launch() {
  const proc = spawn(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-WindowStyle',
      'Hidden',
      '-File',
      scriptPath(),
      '-SkipProcesses',
      'electron,translate-desk',
      '-AllowProcesses',
      ALLOW_PROCESSES,
    ],
    { windowsHide: true },
  );
  child = proc;

  createInterface({ input: proc.stdout }).on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return;

    try {
      const event = JSON.parse(trimmed) as {
        type?: string;
        text?: string;
        x?: number;
        y?: number;
      };
      if (event.type === 'dismiss') {
        dismissHandler?.();
        return;
      }
      if (event.type !== 'selection' || typeof event.text !== 'string') return;
      handler?.({
        text: event.text,
        x: Number(event.x) || 0,
        y: Number(event.y) || 0,
      });
    } catch {
      // 忽略无法解析的输出
    }
  });

  proc.stdin.write(`auto ${autoEnabled ? 'on' : 'off'}\n`);

  proc.on('exit', () => {
    child = null;
    if (quitting) return;
    restartTimer = setTimeout(launch, 2000);
  });
}

export function startSelectionHelper(onSelection: SelectionHandler, onDismiss?: () => void) {
  handler = onSelection;
  dismissHandler = onDismiss ?? null;
  launch();
}

export function setSelectionAuto(enabled: boolean) {
  autoEnabled = enabled;
  child?.stdin.write(`auto ${enabled ? 'on' : 'off'}\n`);
}

export function captureSelection() {
  child?.stdin.write('capture\n');
}

export function stopSelectionHelper() {
  quitting = true;
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
  child?.stdin.write('quit\n');
  child?.kill();
  child = null;
}
