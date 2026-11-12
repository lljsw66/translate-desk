import { createHash } from 'node:crypto';
import type { LangCode } from '../../../shared/translate';

const LANG: Record<LangCode, string> = {
  auto: 'auto',
  zh: 'zh',
  'zh-TW': 'cht',
  en: 'en',
  ja: 'jp',
  ko: 'kor',
  fr: 'fra',
  de: 'de',
  es: 'spa',
  ru: 'ru',
};

interface BaiduResponse {
  error_code?: string;
  error_msg?: string;
  trans_result?: { src: string; dst: string }[];
}

/** 百度翻译开放平台通用文本翻译 */
export async function baiduTranslate(
  text: string,
  from: LangCode,
  to: LangCode,
  appId: string,
  key: string,
): Promise<string> {
  const salt = Date.now().toString();
  const sign = createHash('md5').update(appId + text + salt + key).digest('hex');

  const body = new URLSearchParams({
    q: text,
    from: LANG[from],
    to: LANG[to],
    appid: appId,
    salt,
    sign,
  });

  const res = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as BaiduResponse;
  if (data.error_code) throw new Error(`百度错误 ${data.error_code}: ${data.error_msg ?? ''}`);

  const lines = (data.trans_result ?? []).map((item) => item.dst).filter(Boolean);
  if (!lines.length) throw new Error('返回结果为空');
  return lines.join('\n');
}
