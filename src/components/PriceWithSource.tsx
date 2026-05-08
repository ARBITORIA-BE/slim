import { StaleLabel } from './StaleLabel';

interface Props {
  amount: number;
  currency: 'EUR';
  fetchedAt: string;
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 모든 가격 표시는 이 컴포넌트로 — 출처/신선도/신뢰도가 강제됨 (P1).
 * data-fidelity harness가 이 사용을 검증한다.
 */
export function PriceWithSource({ amount, currency, fetchedAt, sourceUrl, confidence }: Props) {
  const formatted = new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency,
  }).format(amount);

  return (
    <div className="inline-flex flex-col gap-1">
      <span className="font-medium text-lg" data-confidence={confidence}>
        {formatted}
      </span>
      <a href={sourceUrl} className="text-xs text-muted underline" target="_blank" rel="noreferrer">
        원본 보기
      </a>
      <StaleLabel fetchedAt={fetchedAt} />
    </div>
  );
}
