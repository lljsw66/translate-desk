import type { LangCode } from '../../../shared/translate';

const LANG: Record<LangCode, string> = {
  auto: 'Auto',
  zh: 'zh-CHS',
  'zh-TW': 'zh-CHT',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ru: 'ru',
};

interface YoudaoResponse {
  errorCode?: string;
  translation?: string[];
}

const ERRORS: Record<string, string> = {
  '102': '不支持的语言类型',
  '108': '应用 ID 无效',
  '202': '签名校验失败',
  '206': '时间戳过期',
  '401': '账户已欠费',
  '411': '访问频率受限',
  '1001': '无效的请求参数',
};

/** 有道翻译免 Key 接口 */
export async function youdaoTranslate(
  text: string,
  from: LangCode,
  to: LangCode,
): Promise<string> {
  const body = new URLSearchParams({ q: text, from: LANG[from], to: LANG[to] });

  const res = await fetch('https://aidemo.youdao.com/trans', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    },
    body,
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as YoudaoResponse;
  const code = data.errorCode ?? '0';
  if (code !== '0') throw new Error(ERRORS[code] ?? `有道错误码 ${code}`);

  const out = (data.translation ?? []).filter(Boolean).join('\n').trim();
  if (!out) throw new Error('返回结果为空');
  return out;
}
