export type LangCode =
  | 'auto'
  | 'zh'
  | 'zh-TW'
  | 'en'
  | 'ja'
  | 'ko'
  | 'fr'
  | 'de'
  | 'es'
  | 'ru';

export interface TranslateRequest {
  text: string;
  from: LangCode;
  to: LangCode;
}

export interface TranslateAttempt {
  provider: string;
  message: string;
}

export type TranslateResponse =
  | { ok: true; text: string; provider: string; cached: boolean }
  | { ok: false; message: string; attempts: TranslateAttempt[] };
