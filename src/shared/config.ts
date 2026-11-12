export interface AppConfig {
  /** 百度翻译开放平台，申请后填入 */
  baidu?: { appId: string; key: string };
  /** 腾讯云机器翻译，需给子账号授予 TMT 权限 */
  tencent?: { secretId: string; secretKey: string; region?: string };
  /** 任意 OpenAI 兼容接口 */
  llm?: { baseUrl: string; apiKey: string; model: string };
  /** 显式关闭免 Key 网页接口（默认开启） */
  youdaoEnabled?: boolean;
  bingEnabled?: boolean;
}
