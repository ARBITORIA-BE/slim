'use client';
/**
 * StaleLabel — 데이터 신선도 경고 컴포넌트 (P1).
 *
 * 왜 'use client'인가?
 *   useLocale() / useTranslations() 는 Client Component 훅이다.
 *   서버에서 locale 을 주입하려면 getLocale() 을 써야 하지만,
 *   이 컴포넌트는 PriceWithSource 트리 안에서 사용되며 PriceWithSource 도
 *   클라이언트 컴포넌트 — 일관성 유지.
 *
 * 왜 Intl.RelativeTimeFormat(locale) 인가?
 *   locale 을 useLocale() 로 런타임에 읽어 각 언어 RTF 로 현지화.
 *   date-fns / dayjs 추가 없이 브라우저 네이티브 API 재사용 (ADR-0011 §T4 #5).
 *
 * data-fidelity harness Rule 3 이 이 파일의 존재를 error 수준으로 요구한다 (P1 계약).
 * 이 파일을 삭제하면 harness:data 가 RED 가 된다.
 */

import { useLocale, useTranslations } from 'next-intl';

interface StaleLabelProps {
  fetchedAt: string;
}

export function StaleLabel({ fetchedAt }: StaleLabelProps) {
  const locale = useLocale();
  const t = useTranslations('dataDisplay');

  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const ageMinutes = Math.floor(ageMs / (1000 * 60));
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  // Intl.RelativeTimeFormat — 브라우저 네이티브 현지화 (locale 반영)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (ageMinutes < 60) {
    // 1시간 미만: "방금 전" / "just now" 등 RTF 산출값 그대로
    return (
      <span className="text-xs text-muted">
        {rtf.format(-ageMinutes, 'minute')}
      </span>
    );
  }

  if (ageHours < 24) {
    // 1~23시간: "3시간 전" / "3 hours ago" 등
    return (
      <span className="text-xs text-muted">
        {rtf.format(-ageHours, 'hour')}
      </span>
    );
  }

  // 24시간 이상: 경고 색상 + ICU 키 staleData (상대 시간 포함)
  // ⚠️ 이모지는 JSX 리터럴 (한글 아님) — harness 통과
  return (
    <span className="text-xs text-amber-600">
      {'⚠️ '}
      {t('staleData', { relative: rtf.format(-ageDays, 'day') })}
    </span>
  );
}
