/**
 * LocaleSwitcher — 언어 전환 client 섬 (PLAN 4.11.a, ADR-0036 D3).
 *
 * 왜 'use client':
 *   usePathname (next-intl navigation) 은 client hook 이므로 RSC 에서 호출 불가.
 *   SiteFooter (RSC) 안에 client 서브컴포넌트로 분리 → footer 본문 JS 0 유지.
 *
 * 경로 보존 원리:
 *   usePathname() 은 locale prefix 가 제거된 순수 경로를 반환한다.
 *   <Link href={pathname} locale={loc}> 가 as-needed prefix 를 자동 처리하여
 *   현재 경로는 그대로 두고 locale 만 교체한 URL 을 생성한다.
 *
 * 언어 표시명:
 *   각 locale 은 자기 언어로 자기 이름을 표시한다 (endonym).
 *   정적 맵 — i18n 메시지 키가 아님 (번역 필요 없음, Latin 문자 — harness 통과).
 *
 * 3 locale 전체 순회 (ADR-0033 Amd 6 5→3 통합):
 *   routing.locales 단일 출처. 하드코딩 금지 (ADR-0036 D3).
 *   ko 는 routing.locales 비포함이라 자동 제외 (별도 필터 불요).
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * locale → 자기 언어 표시명 (endonym, 정적 맵).
 * 5 locale → 3 locale 통합 (ADR-0033 Amd 6 + ADR-0036 Amd 1, 2026-06-07).
 * UI 세부 교체는 4.15.c 트랙 — 여기서는 타입 정합만 보장.
 */
const LOCALE_ENDONYMS: Record<(typeof routing.locales)[number], string> = {
  nl: 'Nederlands',
  fr: 'Français',
  en: 'English',
};

export function LocaleSwitcher() {
  // locale prefix 가 제거된 현재 경로 (next-intl navigation)
  const pathname = usePathname();
  // 현재 활성 locale
  const current = useLocale();
  // nav aria-label 은 현재 locale 기준으로 번역 (footer 네임스페이스)
  const t = useTranslations('footer');

  return (
    <nav
      aria-label={t('languageLabel')}
      className="flex flex-wrap gap-x-3 gap-y-1"
    >
      {routing.locales.map((loc) => {
        const isActive = loc === current;
        return (
          <Link
            key={loc}
            href={pathname}
            locale={loc}
            aria-current={isActive ? 'true' : undefined}
            className={
              isActive
                ? // 현재 locale: 강조 (font-semibold + 전경색)
                  'font-semibold text-fg'
                : // 비활성: 소프트 + 호버 언더라인
                  'text-fg-soft underline-offset-4 hover:text-fg hover:underline'
            }
          >
            {LOCALE_ENDONYMS[loc]}
          </Link>
        );
      })}
    </nav>
  );
}
