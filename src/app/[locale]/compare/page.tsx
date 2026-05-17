/**
 * /compare — 카테고리 선택 (ADR-0016 §T2).
 *
 * RSC. 3 카드 (mobile/internet_fixed/bundle_internet_tv) 동일 시각
 * 무게 — 다크 패턴 0 (헌법 §8 #3 "추천" 라벨 / 색상 강조 0).
 * landline 제거: ADR-0005 §Amendment 1 (2026-05-16), D-1 흔적 제거.
 *
 * 평균 절약액 미리보기는 페이즈 4 베타 후 노출 (ADR-0011 §T2 항목 5 동형 — 0
 * 데이터 정직 표시).
 *
 * ADR-0033 §T1: [locale] 세그먼트 — setRequestLocale 추가.
 */

import type { Metadata } from 'next';
import { Smartphone, Tv, Wifi, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: '요금제 비교 시작',
  description:
    '모바일, 인터넷, 인터넷+TV — 비교할 카테고리를 선택하세요. 5단계, 5분 안에 완료.',
  alternates: {
    canonical: '/compare',
  },
};
import { TARIFF_CATEGORIES, type TariffCategoryInput } from '@/types/comparison-input';

interface CategoryMeta {
  category: TariffCategoryInput;
  label: string;
  description: string;
  icon: LucideIcon;
}

const CATEGORIES: CategoryMeta[] = [
  {
    category: 'mobile',
    label: '모바일',
    description: '월 €15~€35, 한 회선당',
    icon: Smartphone,
  },
  {
    category: 'internet_fixed',
    label: '인터넷',
    description: '월 €35~€70, 가정용 광/케이블',
    icon: Wifi,
  },
  {
    category: 'bundle_internet_tv',
    label: '인터넷 + TV',
    description: '월 €60~€100, 번들 약정',
    icon: Tv,
  },
];

// TARIFF_CATEGORIES enum 정합성 자가 점검 (개발자 안전망)
const declaredCategories = new Set<string>(CATEGORIES.map((c) => c.category));
for (const c of TARIFF_CATEGORIES) {
  if (!declaredCategories.has(c)) {
    throw new Error(`/compare: TARIFF_CATEGORIES "${c}" 누락 — 카드 추가 필요`);
  }
}

export default function ComparePage() {
  // setRequestLocale은 [locale]/layout.tsx에서 처리됨 (next-intl v3 패턴)
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-10 md:px-6 md:py-16">
      <header className="flex flex-col gap-3">
        <span className="text-sm text-muted">5단계 · 5분</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          어떤 요금제를 비교하시겠어요?
        </h1>
        <p className="text-base text-fg-soft">
          현재 벨기에(BE) 통신 비교를 지원합니다. 네덜란드(NL) / 룩셈부르크(LU)는 페이즈 3에서 추가 예정입니다.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:auto-rows-fr md:grid-cols-2">
        {CATEGORIES.map(({ category, label, description, icon: Icon }) => (
          <li key={category}>
            <Link
              href={`/compare/${category}/postal`}
              className="block rounded-2xl outline-none ring-offset-bg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={`${label} 비교 시작`}
            >
              <Card className="flex h-full flex-col justify-between transition hover:border-primary/40 hover:bg-bg-warm/70">
                <CardHeader className="flex flex-row items-center gap-4 pb-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="flex flex-col gap-1">
                    <CardTitle>{label}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[2.5em]">{description}</CardDescription>
                  </div>
                </CardHeader>
                <p className="text-xs text-muted">평균 절약액 미리보기는 베타 후 노출 예정</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="border-t border-fg/10 pt-6 text-xs text-muted">
        시작 시 본 사이트의{' '}
        <Link href="/legal/terms" className="underline underline-offset-4 hover:text-fg-soft">
          이용 약관
        </Link>{' '}
        에 동의한 것으로 간주됩니다 (GDPR Art. 6(1)(b) 계약 본질).
      </footer>
    </main>
  );
}
