/**
 * CookieConsent — 쿠키 동의 배너 (PLAN 4.12.c).
 *
 * 왜 client island인가:
 *   localStorage 접근 + 동적 visibility 관리는 브라우저 런타임이 필요하다.
 *   서버 컴포넌트에서는 localStorage 접근 불가 → 'use client' 필수.
 *
 * 동의 저장 = localStorage key 'slim_cookie_consent' (서버 쿠키 사용 금지 — ADR-0037 §결정:
 *   서버 쿠키를 사용하면 Set-Cookie 헤더가 정적 렌더를 dynamic으로 강제,
 *   Vercel Edge Cache miss 증가 → LCP 예산 위반 위험).
 *
 * PostHog 게이팅: accepted 시에만 lazy import+init, env 키 없으면 no-op.
 *   왜 lazy import인가: 동의 전에 posthog 번들이 로드되면 GDPR Art.6(1)(a) 위반 가능.
 *
 * GBA Reject-all 동등 노출 (헌법 §8 #3 다크패턴 0):
 *   Accept/Reject 버튼 동일 시각 무게 — "rejectAll" 버튼을 outline variant로,
 *   "acceptAll" 버튼을 solid variant로 렌더하되 크기·위치는 동등.
 *
 * 쿠키 설정 재오픈: footer의 버튼이 'slim:cookie-settings-open' 커스텀 이벤트를 dispatch →
 *   CookieConsent가 window 리스너로 수신 후 배너 재노출.
 */
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'slim_cookie_consent';

// 동의 값 타입 — null은 아직 결정 안 한 상태
type Consent = 'accepted' | 'rejected' | null;

export function CookieConsent() {
  const t = useTranslations('legal.cookie');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // SSR 회귀 방지: window 존재 확인 후 localStorage 읽기
    const stored =
      typeof window !== 'undefined'
        ? (localStorage.getItem(STORAGE_KEY) as Consent | null)
        : null;
    // 이전 동의 없으면 배너 노출
    setVisible(stored === null);

    // footer '쿠키 설정' 버튼 클릭 → 배너 재오픈
    const reopen = () => setVisible(true);
    window.addEventListener('slim:cookie-settings-open', reopen);
    return () => window.removeEventListener('slim:cookie-settings-open', reopen);
  }, []);

  function persist(v: 'accepted' | 'rejected') {
    localStorage.setItem(STORAGE_KEY, v);
    setVisible(false);

    if (v === 'accepted') {
      // PostHog lazy init — 동의 게이트 안에서만 실행 (GDPR Art.6(1)(a))
      // env 키 없으면 no-op (로컬 개발 / 테스트 환경 안전)
      const key = process.env['NEXT_PUBLIC_POSTHOG_KEY'];
      const host = process.env['NEXT_PUBLIC_POSTHOG_HOST'];
      if (key && host) {
        import('posthog-js').then(({ default: posthog }) => {
          posthog.init(key, { api_host: host, persistence: 'localStorage' });
        });
      }
    } else {
      // 거부 시: 이미 init 된 posthog 인스턴스가 있으면 opt-out
      // why: 이전 세션에서 동의 후 현재 세션에서 철회한 경우 대비
      try {
        // @builder-justification: window.posthog 는 posthog-js가 전역에 주입하는 런타임 값
        // — 컴파일 타임 타입 정보가 없어 any 단언 필요. 캐치 블록이 런타임 에러를 흡수.
        const ph = (window as { posthog?: { opt_out_capturing?: () => void } }).posthog;
        if (ph?.opt_out_capturing) ph.opt_out_capturing();
      } catch {
        // opt-out 실패해도 사용자 플로우를 막지 않는다
      }
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-body"
      aria-modal="false"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-fg/10 bg-bg px-4 py-5 shadow-lg md:bottom-4 md:left-auto md:right-4 md:w-[26rem] md:rounded-2xl md:border"
    >
      <h2
        id="cookie-title"
        className="mb-2 text-base font-semibold text-fg"
      >
        {t('title')}
      </h2>
      <p id="cookie-body" className="mb-3 text-sm text-fg-soft">
        {t('body')}
      </p>

      {/* 필수 vs 분석 구분 — 명세 (다) */}
      <ul className="mb-4 space-y-1 text-xs text-fg-soft">
        <li className="flex items-start gap-1.5">
          <span className="mt-0.5 text-fg">•</span>
          {t('essentialCategory')}
        </li>
        <li className="flex items-start gap-1.5">
          <span className="mt-0.5 text-fg">•</span>
          {t('analyticsCategory')}
        </li>
      </ul>

      {/* Accept/Reject 동등 비중 (GBA Reject-all, 헌법 §8 #3) */}
      <div className="flex gap-2">
        {/* rejectAll: outline 스타일로 동등 노출 — 작거나 숨기지 않음 */}
        <button
          type="button"
          onClick={() => persist('rejected')}
          className="flex-1 rounded-lg border border-fg/20 px-3 py-2 text-sm font-medium text-fg transition hover:border-fg/40 hover:bg-bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('rejectAll')}
        </button>
        {/* acceptAll: solid 스타일 — 동일 크기 */}
        <button
          type="button"
          onClick={() => persist('accepted')}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('acceptAll')}
        </button>
      </div>
    </div>
  );
}
