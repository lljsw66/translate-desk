import { createHash, createHmac } from 'node:crypto';
import type { LangCode } from '../../../shared/translate';

const LANG: Record<LangCode, string> = {
  auto: 'auto',
  zh: 'zh',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ru: 'ru',
};

const HOST = 'tmt.tencentcloudapi.com';
const SERVICE = 'tmt';
const ACTION = 'TextTranslate';
const VERSION = '2018-03-21';

interface TencentResponse {
  Response?: {
    TargetText?: string;
    Error?: { Code: string; Message: string };
  };
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, input: string) {
  return createHmac('sha256', key).update(input, 'utf8').digest();
}

/** 腾讯云机器翻译（TC3-HMAC-SHA256 签名） */
export async function tencentTranslate(
  text: string,
  from: LangCode,
  to: LangCode,
  secretId: string,
  secretKey: string,
  region = 'ap-guangzhou',
): Promise<string> {
  const payload = JSON.stringify({
    SourceText: text,
    Source: LANG[from],
    Target: LANG[to],
    ProjectId: 0,
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const contentType = 'application/json; charset=utf-8';

  const canonicalHeaders = `content-type:${contentType}\nhost:${HOST}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256Hex(payload),
  ].join('\n');

  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`TC3${secretKey}`, date);
  const kService = hmac(kDate, SERVICE);
  const kSigning = hmac(kService, 'tc3_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const res = await fetch(`https://${HOST}`, {
    method: 'POST',
    headers: {
      authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'content-type': contentType,
      'x-tc-action': ACTION,
      'x-tc-version': VERSION,
      'x-tc-timestamp': String(timestamp),
      'x-tc-region': region,
    },
    body: payload,
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as TencentResponse;
  const error = data.Response?.Error;
  if (error) throw new Error(`腾讯错误 ${error.Code}: ${error.Message}`);

  const out = data.Response?.TargetText;
  if (!out) throw new Error('返回结果为空');
  return out;
}
