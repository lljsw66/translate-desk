import type { LangCode } from '../../../shared/translate';

const HOST = 'cn.bing.com';

const LANG: Record<LangCode, string> = {
  auto: 'auto-detect',
  zh: 'zh-Hans',
  'zh-TW': 'zh-Hant',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ru: 'ru',
};

interface BingItem {
  translations?: { text: string }[];
}

interface BingSession {
  ig: string;
  iid: string;
  token: string;
  key: string;
  cookie: string;
  expireAt: number;
}

let session: BingSession | null = null;

const SESSION_TTL = 20 * 60 * 1000;

/** 从翻译页抓取 IG / IID / 防滥用 token，页面较重，缓存复用 */
async function loadSession(): Promise<BingSession> {
  if (session && Date.now() < session.expireAt) return session;

  const res = await fetch(`https://${HOST}/translator`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`会话获取失败 HTTP ${res.status}`);

  const html = await res.text();
  const ig = html.match(/IG:"([0-9A-F]+)"/)?.[1];
  const iid = html.match(/data-iid="([\w.]+)"/)?.[1];
  const helper = html.match(/params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)",(\d+)\]/);
  if (!ig || !iid || !helper) throw new Error('翻译会话解析失败');

  const cookies = res.headers.getSetCookie?.() ?? [];
  const cookie = cookies.map((item) => item.split(';')[0]).join('; ');

  session = {
    ig,
    iid,
    key: helper[1],
    token: helper[2],
    cookie,
    expireAt: Date.now() + SESSION_TTL,
  };
  return session;
}

async function request(text: string, from: LangCode, to: LangCode, s: BingSession) {
  const body = new URLSearchParams({
    fromLang: LANG[from],
    to: LANG[to],
    text,
    token: s.token,
    key: s.key,
  });

  const res = await fetch(
    `https://${HOST}/ttranslatev3?isVertical=1&&IG=${s.ig}&IID=${s.iid}.1`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        origin: `https://${HOST}`,
        referer: `https://${HOST}/translator`,
        cookie: s.cookie,
        'accept-language': 'zh-CN,zh;q=0.9',
      },
      body,
      signal: AbortSignal.timeout(15000),
    },
  );

  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  let data: BingItem[] | { statusCode?: number };
  try {
    data = raw ? JSON.parse(raw) : { statusCode: -1 };
  } catch {
    throw new Error('返回内容无法解析');
  }

  if (!Array.isArray(data)) throw new Error(`接口返回错误 ${data.statusCode ?? 'unknown'}`);

  const out = data[0]?.translations?.[0]?.text?.trim();
  if (!out) throw new Error('返回结果为空');
  return out;
}

/** 必应（微软翻译）网页接口，无需 Key */
export async function bingTranslate(text: string, from: LangCode, to: LangCode): Promise<string> {
  const current = await loadSession();
  try {
    return await request(text, from, to, current);
  } catch {
    // 会话可能过期，强制刷新后重试一次
    session = null;
    return request(text, from, to, await loadSession());
  }
}

/** 启动时预热会话，避免首次翻译等待页面下载 */
export function warmUpBing() {
  void loadSession().catch(() => {});
}
