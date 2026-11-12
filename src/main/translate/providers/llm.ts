import type { LangCode } from '../../../shared/translate';

const LANG_NAME: Record<LangCode, string> = {
  auto: '',
  zh: '简体中文',
  'zh-TW': '繁体中文',
  en: '英语',
  ja: '日语',
  ko: '韩语',
  fr: '法语',
  de: '德语',
  es: '西班牙语',
  ru: '俄语',
};

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** OpenAI 兼容接口，走 chat/completions */
export async function llmTranslate(
  text: string,
  from: LangCode,
  to: LangCode,
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const source = from === 'auto' ? '自动识别到的语言' : LANG_NAME[from];
  const target = LANG_NAME[to];

  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是专业翻译引擎。只输出译文，不要解释、不要加引号、不要重复原文。保留原文的换行与段落结构。',
        },
        { role: 'user', content: `把下面的${source}翻译成${target}：\n\n${text}` },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as ChatResponse;
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error('返回结果为空');
  return out;
}
