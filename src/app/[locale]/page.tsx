/**
 * 홈 메인 페이지 — 5블록 hero 구조 (ADR-0041, PLAN 4.13.c).
 *
 * RSC 컴포지션 컨테이너. 67줄 → ≤80줄.
 * 블록 구조 (위→아래):
 *   1. HeroHeader   — H1 + subheading (정체성)
 *   2. CategoryGrid — 카테고리 카드 3개 (CTA 통합, 홈→postal 직진)
 *   3. ProviderLogos — Proximus/Telenet/Orange BE (신뢰 시그널 1)
 *   4. SavingsExample — 예시 절약액 placeholder (가치 제안)
 *   5. TrustSignals — 광고0/수수료공개/제외공개 (신뢰 시그널 2)
 *
 * ADR-0041 D2: 단일 CTA "지금 비교하기" 삭제 (Q5 옵션 B). 카드 자체가 CTA.
 * ADR-0041 D3: 모바일 우선 세로 스택. 블록 2 md:grid-cols-3 (3카드 한 줄).
 * i18n: generateMetadata + getTranslations (RSC) — 'home' 네임스페이스.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/lib/alternates';
import { HeroHeader } from '@/components/Hero/HeroHeader';
import { CategoryGrid } from '@/components/Hero/CategoryGrid';
import { ProviderLogos } from '@/components/Hero/ProviderLogos';
import { SavingsExample } from '@/components/Hero/SavingsExample';
import { TrustSignals } from '@/components/Hero/TrustSignals';

/**
 * absolute title — layout template('%s · Slim') 무시.
 * ADR-0041 D4: metaTitle 재정의 "베네룩스 통신 비교" 정체성 반영.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // next-intl v3: metadata 컨텍스트는 setRequestLocale 보장 안 됨 → locale 명시 (§A2.9.1 규칙 2)
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'home' });

  // hreflang: 5 locale × '/' — Google Localized Versions (PLAN 3.5.4, ADR-0034 D5)
  const alts = buildAlternates(locale, '/');

  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: alts,
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // next-intl v3 static rendering 활성화 (RSC 컴포넌트 내부)
  setRequestLocale(locale);

  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 py-10 md:px-6 md:py-16">
      {/* 블록 1: H1 + subheading */}
      <HeroHeader />

      {/* 블록 2: 카테고리 카드 3개 (홈→postal 직진 CTA) */}
      <div className="w-full">
        <CategoryGrid variant="hero" showExamples density="compact" />
      </div>

      {/* 블록 3: 공급사 로고 3개 + 시장 점유율 캡션 (신뢰 시그널 1) */}
      <ProviderLogos />

      {/* 블록 4: 예시 절약액 placeholder (ADR-0029 §T2 정직성 토큰) */}
      <div className="w-full max-w-md">
        <SavingsExample />
      </div>

      {/* 블록 5: 광고0/수수료공개/제외공개 (헌법 P3, 신뢰 시그널 2) */}
      <TrustSignals />
    </main>
  );
}
