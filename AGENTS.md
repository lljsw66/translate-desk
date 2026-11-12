# AGENTS.md

本文件为在此仓库中工作的 AI 编码代理提供指引。面向人类的使用文档见 [README.md](./README.md)。

## 项目概览

Windows 桌面翻译工具「译 · 桌面翻译」，Electron 主进程 + Vue 3 渲染进程，使用 electron-vite 构建、electron-builder 打包。核心能力：多翻译源自动降级、浏览器内划词 Tooltip 翻译、托盘常驻。

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发模式（热更新）
npm run typecheck    # 主进程 + 渲染进程类型检查
npm run build        # typecheck + 构建到 out/
npm run dist         # 构建 + 打包 NSIS 安装包到 release/
```

- 改完代码至少运行 `npm run typecheck`；涉及构建配置或打包资源时再运行 `npm run build`。
- 仓库未配置测试框架，验证以前述命令 + 手动运行开发模式为主。

## 架构要点

- **进程划分**：`src/main`（主进程）、`src/preload`（contextBridge）、`src/renderer`（Vue）、`src/shared`（跨进程共享类型）。
- **窗口分发**：三个窗口复用同一个渲染入口，`src/renderer/src/App.vue` 根据 URL 参数 `?win=main|popup|settings` 渲染对应组件；窗口创建与定位集中在 [windows.ts](src/main/windows.ts)。
- **IPC**：所有主进程能力通过 `ipcMain.handle` 注册在 [index.ts](src/main/index.ts) 的 `setupIpc()`，preload 以 `window.desktop` 暴露，渲染进程通过 [desktop.ts](src/renderer/src/lib/desktop.ts) 调用。新增能力需同时改动这三处并在 `src/renderer/src/env.d.ts` 补类型。
- **翻译调度**：`src/main/translate/index.ts` 维护 providers 数组（顺序即优先级）、缓存与错误聚合；每个翻译源实现统一的 `run(text, from, to, cfg)` 签名，新增源需在 providers 数组注册并在 `AppConfig` 中补充配置项。
- **划词取词**：`src/main/selection.ts` 拉起 `resources/selection-helper.ps1` 子进程，通过 stdin 发送 `auto on|off` / `capture` / `quit`，从 stdout 读取 JSON 行（`selection` / `dismiss`）。
- **配置持久化**：`src/main/config.ts` 每次操作都重新读取/写入 `app.getPath('userData')/config.json`，因此修改即时生效。

## 硬性约束（不要违背）

1. 翻译源优先级固定为：百度 → 腾讯 → 有道 → 必应 → 大模型，未配置的源自动跳过。
2. 划词总开关统一控制所有划词入口；关闭时立即隐藏浮层并停止钩子回调。
3. 翻译缓存：键为 `(from, to, text)`，TTL 24 小时，上限 500 条，超限先清过期再按写入顺序淘汰。
4. 主窗关闭只隐藏到托盘，不退出进程；退出仅通过托盘菜单或 `before-quit`。
5. 划词浮层使用 `showInactive()` + `setIgnoreMouseEvents(true)`，不得改为抢焦点模式，否则会破坏用户选区。
6. 划词翻译仅在浏览器进程内生效（`selection.ts` 的 `ALLOW_PROCESSES` 白名单）；扩展支持时改白名单，不要移除过滤。
7. 浮层为 Tooltip 样式，只展示「原文 | 译文」，取消选中立即隐藏，不做延时关闭。
8. `src/renderer/index.html` 的 CSP 必须保留 `file:` 白名单，否则打包后白屏。

## 编码约定

- TypeScript 严格模式，`noUnusedLocals` 开启；不要提交未使用变量。
- 渲染进程引用别名：`@renderer/*`、`@shared/*`；主进程内使用相对路径。
- 注释与界面文案使用中文，代码标识符使用英文。
- 保持最小化改动，不做与需求无关的重构或格式化。
- 共享类型放 `src/shared`，不要在 main / renderer 各自重复定义。
- 新增 IPC 时返回类型要明确，preload 中用 `as Promise<T>` 断言，保持 `desktop.ts` 封装一致。
- 新增翻译源必须处理：HTTP 非 2xx、空结果、超时（`AbortSignal.timeout`）、错误信息中文化。

## UI 约定

- 浅色主题 + 天蓝色系品牌色，CSS 变量定义在 `src/renderer/src/styles.css`。
- 不使用屎黄色、木纹等装饰元素。
- 窗口无系统边框，自绘标题栏，统一复用 `WindowControls.vue`。
- 浮层尺寸由渲染内容测量后经 `resizePopup` 调整，主进程侧有 60–480 × 24–220 的硬限制，改样式时注意内容会被裁剪。

## 已知陷阱

- Electron 透明窗口在 Windows 上不可缩放，因此所有窗口使用 `transparent: false`；圆角/阴影通过普通背景实现。
- 浮层 `resizable: false` 会导致 `setSize` 失效，浮层必须保持 `resizable: true`。
- 划词脚本非管理员运行时无法捕获管理员权限程序的选区，这是系统限制，不要试图在脚本内绕过。
- 有道 `aidemo.youdao.com`、必应 `cn.bing.com` 为免 Key 网页接口，随时可能变更；替换时保持 provider 的错误抛出约定。
- 必应会话缓存 20 分钟，首次请求需抓取翻译页，启动时已通过 `warmUpBing()` 预热。
- 打包时图标和取词脚本来自 `extraResources`，需同时存在 `resources/icon.png`、`resources/selection-helper.ps1`。
