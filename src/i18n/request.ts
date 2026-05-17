/**
 * next-intl getRequestConfig (ADR-0033 §T1 배선).
 *
 * 메시지 로드 전략 (ADR-0033 §T2/§T3 베타 γ):
 *   - defaultLocale(nl-BE) → messages/nl-BE.json (베타 동안 ko 내용 채움)
 *   - 기타 locale → messages/{locale}.json (골격 fallback)
 *   - 파일 누락 시 빈 객체 fallback (nl/fr/en 미번역 허용 — γ 시나리오)
 *
 * 왜 dynamic import 인가?
 *   빌드 시 모든 locale 메시지를 번들에 포함하지 않기 위해.
 *   요청별로 locale에 맞는 파일만 로드 (서버 컴포넌트 환경).
 */

import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // next-intl v3 패턴: requestLocale await 후 유효성 검증
  let locale = await requestLocale;

  // locale이 없거나 목록에 없으면 defaultLocale 사용
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  // 메시지 파일 로드 — 없으면 빈 객체 fallback (nl/fr/en 미번역 허용, γ)
  let messages: AbstractIntlMessages = {};
  try {
    // @builder-justification: next-intl 메시지 파일은 dynamic import로 로드되며 런타임에 구조가 결정됨
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(`../../messages/${locale}.json`);
    messages = mod.default as AbstractIntlMessages;
  } catch {
    // 메시지 파일 누락 시 빈 객체 (nl/fr/en fallback — 4.9 런치 게이트에서 채움)
    messages = {};
  }

  return {
    locale,
    messages,
  };
});
