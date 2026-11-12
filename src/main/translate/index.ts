import type {
  LangCode,
  TranslateAttempt,
  TranslateRequest,
  TranslateResponse,
} from '../../shared/translate';
import { readConfig, type AppConfig } from '../config';
import { baiduTranslate } from './providers/baidu';
import { bingTranslate } from './providers/bing';
import { llmTranslate } from './providers/llm';
import { tencentTranslate } from './providers/tencent';
import { youdaoTranslate } from './providers/youdao';

interface Provider {
  name: string;
  enabled: (cfg: AppConfig) => boolean;
  run: (text: string, from: LangCode, to: LangCode, cfg: AppConfig) => Promise<string>;
}

/** 顺序即优先级：官方 API → 网页接口 → 大模型 */
const providers: Provider[] = [
  {
    name: '百度',
    enabled: (cfg) => Boolean(cfg.baidu?.appId && cfg.baidu?.key),
    run: (text, from, to, cfg) =>
      baiduTranslate(text, from, to, cfg.baidu!.appId, cfg.baidu!.key),
  },
  {
    name: '腾讯',
    enabled: (cfg) => Boolean(cfg.tencent?.secretId && cfg.tencent?.secretKey),
    run: (text, from, to, cfg) =>
      tencentTranslate(
        text,
        from,
        to,
        cfg.tencent!.secretId,
        cfg.tencent!.secretKey,
        cfg.tencent!.region,
      ),
  },
  {
    name: '有道',
    enabled: (cfg) => cfg.youdaoEnabled !== false,
    run: (text, from, to) => youdaoTranslate(text, from, to),
  },
  {
    name: '必应',
    enabled: (cfg) => cfg.bingEnabled !== false,
    run: (text, from, to) => bingTranslate(text, from, to),
  },
  {
    name: '大模型',
    enabled: (cfg) => Boolean(cfg.llm?.baseUrl && cfg.llm?.apiKey && cfg.llm?.model),
    run: (text, from, to, cfg) =>
      llmTranslate(text, from, to, cfg.llm!.baseUrl, cfg.llm!.apiKey, cfg.llm!.model),
  },
];

const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 500;

interface CacheEntry {
  text: string;
  provider: string;
  at: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(from: LangCode, to: LangCode, text: string) {
  return `${from}|${to}|${text}`;
}

function readCache(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function writeCache(key: string, entry: CacheEntry) {
  cache.set(key, entry);
  if (cache.size <= CACHE_LIMIT) return;

  // 超限时优先清理已过期条目，再按写入时间淘汰最旧的
  for (const [k, v] of cache) {
    if (Date.now() - v.at > CACHE_TTL) cache.delete(k);
  }
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? '请求超时' : error.message;
  }
  return String(error);
}

export async function translateText(req: TranslateRequest): Promise<TranslateResponse> {
  const text = req.text.trim();
  const { from, to } = req;

  if (!text) return { ok: true, text: '', provider: '', cached: false };
  if (from !== 'auto' && from === to) {
    return { ok: true, text, provider: '同语种', cached: false };
  }

  const key = cacheKey(from, to, text);
  const hit = readCache(key);
  if (hit) return { ok: true, text: hit.text, provider: hit.provider, cached: true };

  const cfg = readConfig();
  const attempts: TranslateAttempt[] = [];
  const available = providers.filter((item) => item.enabled(cfg));

  if (!available.length) {
    return { ok: false, message: '没有可用的翻译源，请检查 config.json', attempts };
  }

  for (const provider of available) {
    try {
      const out = (await provider.run(text, from, to, cfg)).trim();
      if (!out) {
        attempts.push({ provider: provider.name, message: '返回空结果' });
        continue;
      }
      writeCache(key, { text: out, provider: provider.name, at: Date.now() });
      return { ok: true, text: out, provider: provider.name, cached: false };
    } catch (error) {
      attempts.push({ provider: provider.name, message: errorMessage(error) });
    }
  }

  return { ok: false, message: '翻译失败，所有翻译源均不可用', attempts };
}
