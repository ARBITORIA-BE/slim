/**
 * next-intl getRequestConfig (ADR-0033 §T1 배선).
 *
 * 메시지 로드 전략 — locale 3-통합 후 (ADR-0033 Amd 6, 2026-06-07):
 *
 *   [단일 locale 로드] (ADR-0033 Amd 6 §A6.7(c) "routing.locales 단일 출처"):
 *     - routing.locales = ['nl', 'fr', 'en'] → 각 locale 이 단독 파일을 가짐.
 *     - nl-BE/nl-NL → nl 통합, fr-BE/fr-LU → fr 통합 → base+delta 분리 무의미.
 *     - 단일 loadMessages(locale) 호출로 충분.
 *     왜 base+delta 제거인가: ADR-0033 Amd 6 이전에는 5-locale 구조에서 region delta
 *     병합이 필요했으나, 3-locale 통합 후 nl/fr/en 각각이 완전한 파일 → dead code.
 *
 *   [G1-a] ko 오버레이 쿠키 (§A2.7 G1-a):
 *     - 요청 쿠키 `ko_gate_token` 이 env `KO_GATE_TOKEN` 과 constantTimeEqual
 *       일치 시 → locale 무관하게 messages/ko.json 로드 (메시지만 ko 스왑).
 *     - URL/hreflang/sitemap/lang 속성은 nl 등 그대로 — "메시지 소스 스왑"만.
 *     - 무쿠키/불일치 → 단일 locale 로드 (공개 경로 정적 렌더 불변).
 *     왜 쿠키 오버레이인가: 게이트 해제 이후에도 운영자가 공개 사이트 위에서
 *     한국어로 검증 가능 — "편집자 모드처럼" (ADR-0033 §A2.7).
 *     새 env 없음 — 4.5.j.1 게이트 토큰 재사용 (KO_GATE_TOKEN).
 *     무쿠키 정적 렌더 회귀 0: 쿠키 없는 요청(검색 봇 포함)은 스왑 0 → 공개 locale.
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { AbstractIntlMessages } from 'next-intl';

import { constantTimeEqual } from '@/lib/constant-time-equal';
import { routing } from './routing';

// ─── 메시지 파일 로드 헬퍼 ──────────────────────────────────────────────────

/**
 * 단일 메시지 파일을 dynamic import 로 로드.
 * 파일 누락 시 빈 객체 반환 (γ — 미번역 허용, phase A 골격 파일).
 *
 * 왜 dynamic import 인가:
 *   빌드 시 모든 locale 메시지를 번들에 포함하지 않기 위해.
 *   요청별로 필요한 파일만 서버에서 로드 (서버 컴포넌트 환경).
 *
 * @builder-justification: next-intl 메시지는 dynamic import로 런타임에 locale별 로드.
 *   타입을 AbstractIntlMessages로 단언하는 것이 유일한 실용적 방법.
 */
export async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(`../../messages/${locale}.json`);
    return mod.default as AbstractIntlMessages;
  } catch {
    // 파일 미존재(Phase A 골격) 또는 미번역 — 빈 객체로 γ fallback
    return {};
  }
}

// ─── ko 오버레이 판정 ────────────────────────────────────────────────────────

/**
 * 쿠키 토큰과 KO_GATE_TOKEN env 를 비교하여 ko 오버레이 여부를 판정.
 * constantTimeEqual 재사용 — edge-safe, 신규 crypto 0 (ADR-0033 §A2.7 G1-a).
 *
 * @internal — 테스트 가능하도록 export.
 * @param cookieToken 요청 쿠키 `ko_gate_token` 값 (없으면 undefined).
 * @param envToken KO_GATE_TOKEN env 값 (없으면 undefined).
 * @returns true = ko.json 로드, false = 공개 locale 로드.
 */
export function shouldOverrideKo(
  cookieToken: string | undefined,
  envToken: string | undefined,
): boolean {
  // env 미설정 = 게이트 비활성 → 오버레이 0
  if (!envToken) return false;
  // 쿠키 없음 → 오버레이 0 (무쿠키 정적 렌더 회귀 0)
  if (!cookieToken) return false;
  // constant-time 비교 — timing attack 방지
  return constantTimeEqual(cookieToken, envToken);
}

// ─── getRequestConfig ────────────────────────────────────────────────────────

export default getRequestConfig(async ({ requestLocale }) => {
  // next-intl v3 패턴: requestLocale await 후 유효성 검증
  let locale = await requestLocale;

  // locale 이 없거나 목록에 없으면 defaultLocale 사용
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  // ── [G1-a] ko 오버레이 쿠키 체크 ───────────────────────────────────────
  // 왜 여기서 쿠키를 읽는가:
  //   next-intl getRequestConfig 는 서버 컴포넌트 컨텍스트에서 실행된다.
  //   next/headers cookies() 는 여기서 접근 가능 (RSC / Server Action 환경).
  //   쿠키 없는 요청(SSG 정적 경로, 검색 봇)은 쿠키 스토어가 비어 있어
  //   자동으로 스왑 0 → 공개 locale 그대로 → 정적 렌더 회귀 없음.
  const koGateEnv = process.env.KO_GATE_TOKEN;
  try {
    const cookieStore = await cookies();
    const koToken = cookieStore.get('ko_gate_token')?.value;
    if (shouldOverrideKo(koToken, koGateEnv)) {
      // 유효 쿠키 → ko.json 로드 (locale 무관 메시지 스왑)
      const koMessages = await loadMessages('ko');
      return { locale, messages: koMessages };
    }
  } catch {
    // cookies() 가 정적 렌더링 컨텍스트에서 throw 할 수 있음 (Next.js 15 동작).
    // 이 경우 스왑 없이 공개 locale 메시지 사용 — 무쿠키 정적 렌더 회귀 0.
  }

  // ── 단일 locale 로드 ────────────────────────────────────────────────────
  // ADR-0033 Amd 6: locale 5→3 통합 후 base+delta 분리 무의미.
  // nl/fr/en 각각이 완전한 메시지 파일을 가짐 → 단일 loadMessages 호출.
  const messages = await loadMessages(locale);
  return { locale, messages };
});
