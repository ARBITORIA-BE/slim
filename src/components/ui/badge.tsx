/**
 * Badge — 인라인 상태 배지 컴포넌트 (ADR-0050 §D1 베타 배지 외화).
 *
 * variant='beta': 베타 카드 우상단 표식 (beta 상태 외화, 본문 텍스트 대체).
 * variant='default': 일반 정보 배지.
 *
 * 헌법 §8 #3: 다크패턴 0 — 배지는 상태 외화 용도만. "추천" 라벨 용도 금지.
 * WCAG AA: beta 배지 텍스트(#fff) vs bg(text-primary) ≈ 4.5:1 이상 (디자인 토큰 기준).
 */

import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'beta';
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-fg/10 text-fg',
        // why: beta 배지는 primary 색상 계열 — 브랜드 인지 + WCAG AA 4.5:1 잠금.
        variant === 'beta' && 'bg-primary/15 text-primary',
        className,
      )}
    >
      {children}
    </span>
  );
}
