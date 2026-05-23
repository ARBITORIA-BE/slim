'use client';
/**
 * PriceWithSource — 모든 가격 표시의 단일 진입점 (P1).
 *
 * 왜 'use client'인가?
 *   useTranslations() / useLocale() 은 Client Component 훅이다.
 *   StaleLabel 도 클라이언트 컴포넌트 — 트리 일관성 유지.
 *
 * 왜 이 컴포넌트를 삭제하지 않는가?
 *   data-fidelity harness Rule 2 가 PriceWithSource 래퍼를 요구한다 (P1 계약).
 *   Rule 3 이 StaleLabel.tsx 존재를 요구한다.
 *   삭제 시 harness:data RED.
 *
 * 통화 포맷:
 *   Intl.NumberFormat(locale) 으로 locale 반영. EUR 는 모든 로케일에서 동일 통화.
 *
 * data-fidelity harness가 이 사용을 검증한다.
 */

import { useLocale, useTranslations } from 'next-intl';
import { StaleLabel } from './StaleLabel';

interface PriceWithSourceProps {
  amount: number;
  currency: 'EUR';
  fetchedAt: string;
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
}

export function PriceWithSource({
  amount,
  currency,
  fetchedAt,
  sourceUrl,
  confidence,
}: PriceWithSourceProps) {
  const locale = useLocale();
  const t = useTranslations('dataDisplay');

  // locale 반영 통화 포맷 — EUR 는 베네룩스 전역 공통이므로 locale 만 변경
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);

  return (
    <div className="inline-flex flex-col gap-1">
      <span className="font-medium text-lg" data-confidence={confidence}>
        {formatted}
      </span>
      <a
        href={sourceUrl}
        className="text-xs text-muted underline"
        target="_blank"
        rel="noreferrer"
      >
        {t('viewSource')}
      </a>
      <StaleLabel fetchedAt={fetchedAt} />
    </div>
  );
}
