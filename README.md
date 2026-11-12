# 译 · 桌面翻译（TranslateDesk）

基于 Electron + Vue 3 的 Windows 桌面翻译工具。支持主窗输入即时翻译，以及在浏览器页面中划词弹出 Tooltip 式浮层翻译。

## 功能特性

- **多翻译源自动降级**：百度官方 API → 腾讯官方 API → 有道网页接口 → 必应翻译接口 → 大模型，未配置的源自动跳过
- **划词翻译**：在浏览器页面拖选或双击选中文本后，光标附近弹出「原文 | 译文」的 Tooltip 浮层，取消选中立即隐藏
- **主窗即时翻译**：输入即翻译（600ms 防抖），支持源语言/目标语言切换、交换语言、复制结果
- **翻译缓存**：相同 `(源语言, 目标语言, 原文)` 结果缓存 24 小时，最多 500 条（LRU），减少重复请求
- **密钥配置界面**：可视化配置百度、腾讯、大模型（任意 OpenAI 兼容接口）密钥，保存后即时生效
- **常驻托盘**：关闭主窗仅隐藏到托盘，不退出进程；支持窗口置顶
- **单实例运行**：重复启动时唤起已有主窗

## 翻译源优先级

| 顺序 | 翻译源 | 是否需要密钥 | 说明 |
| --- | --- | --- | --- |
| 1 | 百度翻译开放平台 | 需要 AppID + 密钥 | 标准版每月 5 万字符免费 |
| 2 | 腾讯云机器翻译 | 需要 SecretId + SecretKey | 按量计费，每月 500 万字符免费 |
| 3 | 有道翻译 | 不需要 | 免 Key，以中英日为主 |
| 4 | 微软必应 | 不需要 | 免 Key，全语种 |
| 5 | 大模型 | 需要 Base URL + Key + 模型名 | 任意 OpenAI 兼容的 `/chat/completions` 接口 |

任一源失败会自动尝试下一个，全部失败时在界面展示各源的错误信息。

## 快捷键

| 功能 | 快捷键 |
| --- | --- |
| 唤起/聚焦主窗 | `Ctrl + Shift + Space` |
| 手动触发划词翻译 | `Ctrl + Shift + D` |

## 技术栈

- Electron 33
- Vue 3（`<script setup>` + TypeScript）
- electron-vite 2 / Vite 5
- electron-builder（NSIS 安装包）

## 环境要求

- Windows 10 / 11（划词功能依赖全局鼠标钩子与 PowerShell）
- Node.js 18+（建议 20 LTS）
- PowerShell 5.1+（系统自带）

## 快速开始

```bash
# 安装依赖（.npmrc 已配置 Electron 国内镜像）
npm install

# 开发模式（热更新）
npm run dev

# 类型检查
npm run typecheck

# 构建产物到 out/
npm run build

# 打包 Windows 安装包到 release/
npm run dist
```

## 项目结构

```
src/
├── main/                  # 主进程
│   ├── index.ts           # 应用入口：托盘、全局快捷键、IPC 注册
│   ├── windows.ts         # 主窗 / 划词浮层 / 设置窗的创建与定位
│   ├── config.ts          # config.json 读写
│   ├── selection.ts       # 启动/控制划词取词 PowerShell 子进程
│   └── translate/
│       ├── index.ts       # 翻译源调度、降级、缓存
│       └── providers/     # baidu / tencent / youdao / bing / llm 实现
├── preload/index.ts       # contextBridge 暴露 window.desktop API
├── renderer/              # 渲染进程（Vue）
│   └── src/
│       ├── App.vue        # 按 ?win= 参数分发主窗 / 浮层 / 设置窗
│       ├── windows/       # MainWindow / PopupWindow / SettingsWindow
│       ├── components/    # WindowControls 等
│       └── lib/desktop.ts # 对 window.desktop 的类型化封装
└── shared/                # 主进程与渲染进程共享的类型
    ├── config.ts          # AppConfig
    └── translate.ts       # LangCode / TranslateRequest / TranslateResponse
resources/
├── icon.png               # 应用/托盘图标
└── selection-helper.ps1   # 全局划词取词脚本（鼠标钩子 + 模拟 Ctrl+C）
```

## 配置说明

配置保存在用户数据目录下的 `config.json`，Windows 下通常为：

```
%APPDATA%\translate-desk\config.json
```

也可通过主窗右上角「设置」界面修改。文件结构：

```json
{
  "baidu": { "appId": "your-appid", "key": "your-key" },
  "tencent": { "secretId": "your-secret-id", "secretKey": "your-secret-key", "region": "ap-guangzhou" },
  "llm": { "baseUrl": "https://api.openai.com/v1", "apiKey": "sk-xxx", "model": "gpt-4o-mini" },
  "youdaoEnabled": true,
  "bingEnabled": true
}
```

- 未填写的翻译源会自动跳过；`youdaoEnabled` / `bingEnabled` 设为 `false` 可显式关闭免 Key 的网页接口
- 每次翻译都会重新读取配置，修改后立即生效，无需重启
- 腾讯云账号需授予子账号 `TMT`（机器翻译）相关权限

## 划词翻译说明

- 仅在浏览器窗口内生效，内置白名单：Chrome、Edge、Firefox、Brave、Opera、Vivaldi、Chromium、Arc、360 浏览器、QQ 浏览器、搜狗浏览器、UC 浏览器、IE、猎豹、傲游等
- 主窗「划词」开关统一控制自动划词；关闭后立即隐藏浮层
- 浮层为 Tooltip 样式，不抢焦点、鼠标点击穿透，点击页面清除选区后自动隐藏
- 取词实现方式：`selection-helper.ps1` 挂全局鼠标钩子识别拖选/双击，模拟 `Ctrl+C` 读取文本后还原原剪贴板内容

## 已知限制

- 以管理员权限运行的程序，非提权运行的翻译工具无法捕获其划词
- 窗口使用非透明背景，不支持 Electron 透明窗口的圆角/阴影效果
- 有道、必应网页接口为免 Key 方案，可能因对方接口调整而失效
- 右键菜单翻译项尚未实现（暂以 `Ctrl + Shift + D` 替代）

## 常见问题

**划词没有反应？**
确认当前前台程序是受支持的浏览器；尝试用 `Ctrl + Shift + D` 手动触发；若目标程序以管理员权限运行，需要以管理员权限启动本应用。

**翻译全部失败？**
打开设置检查翻译源状态；免 Key 接口偶发限流时可稍后重试，或配置百度/腾讯/大模型任一密钥源。

**打包后界面空白？**
检查 `src/renderer/index.html` 的 CSP 是否包含 `file:` 白名单，以及 `electron-builder.yml` 的 `extraResources` 是否包含图标与取词脚本。
