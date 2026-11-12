param(
  [string]$SkipProcesses = 'electron,translate-desk',
  [string]$AllowProcesses = 'chrome,msedge,firefox,brave,opera,vivaldi,chromium,arc,360se,360chrome,360chromex,qqbrowser,sogouexplorer,ucbrowser,iexplore,liebao,maxthon'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public class SelectionHelper {
    const int WH_MOUSE_LL = 14;
    const int WM_LBUTTONDOWN = 0x0201;
    const int WM_LBUTTONUP = 0x0202;

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSLLHOOKSTRUCT {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }
    [StructLayout(LayoutKind.Explicit)]
    struct INPUTUNION {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public INPUTUNION u; }

    delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)]
    static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")]
    static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll")]
    static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")]
    static extern sbyte GetMessage(out MSG msg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
    [DllImport("user32.dll")]
    static extern bool TranslateMessage(ref MSG msg);
    [DllImport("user32.dll")]
    static extern IntPtr DispatchMessage(ref MSG msg);

    static HookProc proc;
    static IntPtr hook = IntPtr.Zero;
    static POINT downPt;
    static long lastUpTick;
    static long lastEmitTick;
    static bool autoOn = true;
    static bool pending = false;
    static long dueTick;
    static int popupX;
    static int popupY;
    static string[] skip = new string[0];
    static string[] allow = new string[0];
    static string lastText = "";
    static readonly object emitLock = new object();

    public static void Start(string skipList, string allowList) {
        skip = skipList.ToLowerInvariant().Split(',');
        allow = allowList.ToLowerInvariant().Split(',');

        Thread hookThread = new Thread(HookLoop);
        hookThread.IsBackground = true;
        hookThread.SetApartmentState(ApartmentState.STA);
        hookThread.Start();

        Thread worker = new Thread(WorkerLoop);
        worker.IsBackground = true;
        worker.Start();

        Emit("{\"type\":\"ready\"}");

        string line;
        while ((line = Console.In.ReadLine()) != null) {
            Handle(line.Trim());
        }
    }

    static void Handle(string line) {
        if (line == "quit") {
            Environment.Exit(0);
        } else if (line == "auto on") {
            autoOn = true;
        } else if (line == "auto off") {
            autoOn = false;
        } else if (line == "capture") {
            POINT p;
            GetCursorPosSafe(out p);
            Schedule(30, p.X, p.Y);
        }
    }

    [DllImport("user32.dll")]
    static extern bool GetCursorPos(out POINT p);

    static void GetCursorPosSafe(out POINT p) {
        try { GetCursorPos(out p); } catch { p = new POINT(); }
    }

    static void HookLoop() {
        proc = Callback;
        hook = SetWindowsHookEx(WH_MOUSE_LL, proc, GetModuleHandle(null), 0);
        if (hook == IntPtr.Zero) {
            Emit("{\"type\":\"error\",\"message\":\"hook install failed\"}");
            return;
        }

        MSG msg;
        sbyte code;
        while ((code = GetMessage(out msg, IntPtr.Zero, 0, 0)) > 0) {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }
        UnhookWindowsHookEx(hook);
    }

    static IntPtr Callback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && autoOn) {
            int msg = wParam.ToInt32();
            if (msg == WM_LBUTTONDOWN) {
                downPt = ReadStruct(lParam).pt;
                // any new click clears the previous selection, so dismiss the tooltip
                lastText = "";
                Emit("{\"type\":\"dismiss\"}");
            } else if (msg == WM_LBUTTONUP) {
                MSLLHOOKSTRUCT info = ReadStruct(lParam);
                int dx = Math.Abs(info.pt.X - downPt.X);
                int dy = Math.Abs(info.pt.Y - downPt.Y);
                long now = Environment.TickCount;
                bool dragged = dx > 8 || dy > 8;
                bool doubleClick = !dragged && (now - lastUpTick) < 450;
                lastUpTick = now;
                if (dragged || doubleClick) Schedule(140, info.pt.X, info.pt.Y);
            }
        }
        return CallNextHookEx(hook, nCode, wParam, lParam);
    }

    static MSLLHOOKSTRUCT ReadStruct(IntPtr lParam) {
        return (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
    }

    static void Schedule(int delay, int x, int y) {
        long now = Environment.TickCount;
        if (now - lastEmitTick < 300) return;
        dueTick = now + delay;
        popupX = x;
        popupY = y;
        pending = true;
    }

    static void WorkerLoop() {
        while (true) {
            Thread.Sleep(15);
            if (!pending) continue;
            if (Environment.TickCount < dueTick) continue;
            pending = false;
            TryCapture();
        }
    }

    static void TryCapture() {
        if (!IsAllowedForeground()) return;

        string text = CaptureViaClipboard();
        if (text == null) return;

        text = text.Trim();
        if (text.Length == 0) return;
        if (text.Length > 2000) text = text.Substring(0, 2000);
        if (text == lastText) return;

        lastText = text;
        lastEmitTick = Environment.TickCount;
        Emit("{\"type\":\"selection\",\"x\":" + popupX + ",\"y\":" + popupY + ",\"text\":\"" + Escape(text) + "\"}");
    }

    static bool IsAllowedForeground() {
        try {
            IntPtr hwnd = GetForegroundWindow();
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            string name = Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();

            for (int i = 0; i < skip.Length; i++) {
                if (skip[i].Length > 0 && name == skip[i].Trim()) return false;
            }
            if (allow.Length == 0) return true;
            for (int i = 0; i < allow.Length; i++) {
                if (allow[i].Length > 0 && name == allow[i].Trim()) return true;
            }
        } catch { }
        return false;
    }

    static string CaptureViaClipboard() {
        string result = null;
        Thread sta = new Thread(delegate() {
            string backup = "";
            bool hadText = false;
            try {
                hadText = Clipboard.ContainsText();
                if (hadText) backup = Clipboard.GetText();
            } catch { }

            try {
                SendCtrlC();
                for (int i = 0; i < 8; i++) {
                    Thread.Sleep(60);
                    string current = "";
                    try { current = Clipboard.ContainsText() ? Clipboard.GetText() : ""; } catch { }
                    if (current.Length > 0 && current != backup) {
                        result = current;
                        break;
                    }
                }
            } finally {
                if (result != null) {
                    Thread.Sleep(60);
                    try {
                        if (hadText && backup.Length > 0) Clipboard.SetText(backup);
                        else Clipboard.Clear();
                    } catch { }
                }
            }
        });
        sta.SetApartmentState(ApartmentState.STA);
        sta.Start();
        sta.Join(2500);
        return result;
    }

    static void SendCtrlC() {
        INPUT[] seq = new INPUT[] {
            Key(0x11, false),
            Key(0x43, false),
            Key(0x43, true),
            Key(0x11, true)
        };
        SendInput((uint)seq.Length, seq, Marshal.SizeOf(typeof(INPUT)));
    }

    static INPUT Key(ushort vk, bool up) {
        INPUT item = new INPUT();
        item.type = INPUT_KEYBOARD;
        item.u.ki.wVk = vk;
        item.u.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
        return item;
    }

    static string Escape(string text) {
        StringBuilder sb = new StringBuilder(text.Length + 16);
        for (int i = 0; i < text.Length; i++) {
            char c = text[i];
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.ToString();
    }

    static void Emit(string line) {
        lock (emitLock) {
            try {
                Console.Out.WriteLine(line);
                Console.Out.Flush();
            } catch { }
        }
    }
}
'@

[SelectionHelper]::Start($SkipProcesses, $AllowProcesses)
