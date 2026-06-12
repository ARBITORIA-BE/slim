/**
 * CategoryGrid — 블록 2: 카테고리 카드 (ADR-0041 D1 §블록 2, Amendment 1 D7~D8, PLAN 4.13.c).
 *
 * RSC. 홈(variant='hero') + /compare(variant='full') 공유 컴포넌트.
 * ISR revalidate=3600 (admin 메트릭과 동일 신선도).
 *
 * ADR-0050 §D1 (2026-06-10): 2+3 분리 + 카드 고정 높이 + 베타 배지 외화.
 *   - 1행 단품 2장 (mobile, internet_fixed): grid-cols-1 md:grid-cols-2
 *   - 2행 번들 3장 (bundle_*): grid-cols-1 md:grid-cols-3
 *   - 베타 배지: bundle_mobile_internet / bundle_mobile_internet_tv 우상단
 *   - 카드 min-h-[180px] (compact) / min-h-[220px] (full) — Gestalt 원칙 4, 7
 *
 * 헌법 §8 #3: 다크패턴 0 — 카드 동일 시각 무게, "추천" 라벨 0.
 * 헌법 P1: 가격 표시 시 source_url + fetched_at tooltip.
 * ADR-0034 D2: 통신 BE 3 카테고리만 (에너지/보험 등 placeholder 0).
 * ADR-0041 D21 (Amendment 4): 가격 강조 = text-accent-dark font-semibold.
 * ADR-0042 §D4: 5 카드 동일 시각 무게 — 임의 하이라이트 0.
 * WCAG AA: text-accent-dark #A98307 vs bg #FAF7F2 ≈ 4.5:1 (AA Pass).
 */

import Link from 'next/link';
import { Package2, Smartphone, Tv, TvMinimalPlay, Wifi, type LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TARIFF_CATEGORIES, type TariffCategoryInput } from '@/types/comparison-input';
import { getCheapestTariffByCategory, type CheapestTariffByCategory } from '@/db/queries/cheapest-tariff';

// ISR: 1시간마다 재검증 (admin 메트릭과 동일 신선도 — ADR-0041 D7.4)
export const revalidate = 3600;

export interface CategoryGridProps {
  /** 'hero': 홈 컴팩트 (가격 예시 1개). 'full': /compare 풍부한 정보. */
  variant: 'hero' | 'full';
  /** 가격 예시 표시 여부 (ADR-0041 Q7 옵션 A — 카테고리당 1 예시). */
  showExamples?: boolean;
  /** 'compact': 홈 컴팩트. 'full': /compare 상세. */
  density?: 'compact' | 'full';
}

type CategoryIconKey = TariffCategoryInput;

// ADR-0042 §D4: 5 카드 동일 시각 무게 — "추천" 라벨 0, 헌법 §8 #3.
// bundle_mobile_internet = Package2 (Smartphone+Wifi 조합 의미, cord-cutter)
// bundle_internet_tv = Tv (TV-only 듀얼)
// bundle_mobile_internet_tv = TvMinimalPlay (triple play — TV+모바일 강조)
const CATEGORY_ICONS: Record<CategoryIconKey, LucideIcon> = {
  mobile: Smartphone,
  internet_fixed: Wifi,
  bundle_mobile_internet: Package2,
  bundle_internet_tv: Tv,
  bundle_mobile_internet_tv: TvMinimalPlay,
};

// ADR-0050 §D1: 2+3 분리 — 단품 2장 / 번들 3장.
// why: Hick's Law — 5개 단일 나열보다 2+3 그룹 분리가 의사결정 시간 log₂(N) ↓.
const SINGLE_CATEGORIES: TariffCategoryInput[] = ['mobile', 'internet_fixed'];
const BUNDLE_CATEGORIES: TariffCategoryInput[] = [
  'bundle_mobile_internet',
  'bundle_internet_tv',
  'bundle_mobile_internet_tv',
];

// ADR-0050 §D1: 베타 배지 대상 카테고리 — 가격 신호 없음 + 번들 데이터 수집 중.
// 헌법 §8 #3: 하이라이트 용도 아님. 순수 상태 표시 (베타 단계 데이터 부재 안내).
const BETA_CATEGORIES = new Set<TariffCategoryInput>([
  'bundle_mobile_internet',
  'bundle_mobile_internet_tv',
]);

// TARIFF_CATEGORIES enum 정합성 자가 점검 (개발자 안전망)
const iconKeys = new Set<string>(Object.keys(CATEGORY_ICONS));
for (const c of TARIFF_CATEGORIES) {
  if (!iconKeys.has(c)) {
    throw new Error(
      `/compare: TARIFF_CATEGORIES "${c}" 아이콘 누락 — CATEGORY_ICONS 추가 필요`, // @i18n-allow 개발자 에러 메시지
    );
  }
}

/** cents → EUR 표시 문자열 (예: 2500 → "€25.00"). */
function formatEur(cents: number): string {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

interface PriceExampleProps {
  cheapest: CheapestTariffByCategory;
  category: TariffCategoryInput;
  /** i18n t() 함수 */
  exampleLabel: string;
  /** 데이터 부재 시 표시 문자열 (Beta 카드는 사용 X — Badge로 외화) */
  pendingLabel: string;
  /** abbr aria-label 템플릿 "{sourceUrl}" 치환 — 헌법 §8 #6 한글 리터럴 금지 */
  priceSourceAriaLabel: string;
  /** Beta 카드 분기 — data 부재 시 본문 텍스트 미노출 (ADR-0050 §D1 (4)) */
  isBeta: boolean;
}

function PriceExample({ cheapest, category, exampleLabel, pendingLabel, priceSourceAriaLabel, isBeta }: PriceExampleProps) {
  const data = cheapest[category];
  if (!data) {
    // ADR-0050 §D1 (4): Beta 카드는 Badge로 외화 → 본문 텍스트 중복 노출 0.
    // 단품/비-Beta 카드는 ADR-0011 §T2 항목 5 동형 — 0 데이터 정직 표시 유지.
    if (isBeta) return null;
    return (
      <p className="text-xs text-muted italic">
        {pendingLabel}
      </p>
    );
  }

  const priceStr = formatEur(data.monthlyPriceCents);
  // exampleLabel = "예: {provider} {tariff} {price}/월" — 수동 치환 (t() 인자 불가 in RSC 부분)
  const text = exampleLabel
    .replace('{provider}', data.providerName)
    .replace('{tariff}', data.tariffName)
    .replace('{price}', priceStr);

  return (
    // __SAFE_PRICE_DISPLAY__: 가격은 DB source_url + fetched_at abbr tooltip으로 P1 준수 (ADR-0041 D1)
    <p className="text-xs">
      {/* 가격 강조 — ADR-0041 D21, WCAG AA accent-dark 4.5:1 */}
      <span className="text-accent-dark font-semibold">{text}</span>
      {/* 헌법 P1: source + fetched_at tooltip */}
      <abbr
        title={`source: ${data.sourceUrl} | fetched_at: ${data.lastSeenAt}`}
        className="ml-1 cursor-help text-muted no-underline"
        aria-label={priceSourceAriaLabel.replace('{sourceUrl}', data.sourceUrl)}
      >
        ⓘ
      </abbr>
    </p>
  );
}

interface CategoryCardProps {
  category: TariffCategoryInput;
  showExamples: boolean;
  cheapest: CheapestTariffByCategory;
  exampleLabel: string;
  pendingLabel: string;
  priceSourceAriaLabel: string;
  betaBadgeLabel: string;
  iconContainerClass: string;
  iconClass: string;
  titleClass: string;
  cardMinHeightClass: string;
  label: string;
  description: string;
  ariaStartLabel: string;
}

// why: 카드 렌더를 별도 컴포넌트로 추출 — 단품/번들 두 grid에서 재사용.
function CategoryCard({
  category,
  showExamples,
  cheapest,
  exampleLabel,
  pendingLabel,
  priceSourceAriaLabel,
  betaBadgeLabel,
  iconContainerClass,
  iconClass,
  titleClass,
  cardMinHeightClass,
  label,
  description,
  ariaStartLabel,
}: CategoryCardProps) {
  const Icon = CATEGORY_ICONS[category];
  const isBeta = BETA_CATEGORIES.has(category);

  return (
    <li key={category}>
      <Link
        href={`/compare/${category}/current-provider`}
        className="block rounded-2xl outline-none ring-offset-bg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={ariaStartLabel}
      >
        {/* ADR-0041 D21: hover active selection → border-accent-dark (그린골드).
            ADR-0050 §D1: min-h 고정 — Gestalt 인접 카드 동기화.
            ADR-0050 §D6: hover 외 임의 하이라이트 0 잠금. */}
        <Card className={`flex h-full flex-col justify-between transition hover:border-accent-dark hover:bg-bg-warm/70 ${cardMinHeightClass}`}>
          <CardHeader className="flex flex-row items-center gap-4 pb-3">
            <span className={iconContainerClass}>
              <Icon className={iconClass} aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <CardTitle className={titleClass}>{label}</CardTitle>
                {/* ADR-0050 §D1: 베타 배지 — 본문 텍스트 대체, 우상단 외화.
                    showExamples=false 또는 데이터 없을 때도 배지 유지 (상태 정직 표시). */}
                {isBeta && (
                  <Badge variant="beta" className="ml-auto shrink-0">
                    {betaBadgeLabel}
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2 min-h-[2.5em]">
                {description}
              </CardDescription>
            </div>
          </CardHeader>
          {showExamples && (
            <div className="px-4 pb-3">
              <PriceExample
                cheapest={cheapest}
                category={category}
                exampleLabel={exampleLabel}
                pendingLabel={pendingLabel}
                priceSourceAriaLabel={priceSourceAriaLabel}
                isBeta={isBeta}
              />
            </div>
          )}
        </Card>
      </Link>
    </li>
  );
}

export async function CategoryGrid({
  variant,
  showExamples = false,
  density = 'compact',
}: CategoryGridProps) {
  // why: RSC 이므로 getTranslations 사용 (await 필요).
  // compare 네임스페이스: 카테고리 레이블/설명 + 가격 예시 관련 키.
  // home 네임스페이스: 2+3 분리 헤더 라벨 (singles/bundles) + 베타 배지 키 (ADR-0050 §D1).
  const t = await getTranslations('compare');
  const tHome = await getTranslations('home');

  // 가격 예시 데이터 (showExamples=true 일 때만 DB 조회)
  let cheapest: CheapestTariffByCategory = {};
  if (showExamples) {
    try {
      cheapest = await getCheapestTariffByCategory();
    } catch {
      // DB 조회 실패 — placeholder로 graceful degradation
    }
  }

  // 텍스트 변형 (variant / density)
  const headingKey = variant === 'full' ? 'headingFriendly' : 'headingFriendly';
  const stepBadgeKey = variant === 'full' ? 'stepBadgeReduced' : 'stepBadgeReduced';
  const supportNoteKey = variant === 'full' ? 'supportNoteShort' : 'supportNoteShort';

  // 아이콘 크기 — full(더 큰) vs compact
  const iconContainerClass =
    density === 'full'
      ? 'flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'
      : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary';
  const iconClass = density === 'full' ? 'h-7 w-7' : 'h-6 w-6';
  const titleClass =
    density === 'full'
      ? 'text-xl font-display'
      : 'font-display text-lg';

  // ADR-0050 §D1 §D7: 카드 고정 높이 — compact=180px / full=220px.
  // why: min-h 잠금으로 인접 카드 높이 동기화 → Gestalt 원칙 4 (similarity) + 7 (visual rhythm).
  const cardMinHeightClass = density === 'full' ? 'min-h-[220px]' : 'min-h-[180px]';

  // why: ICU placeholder가 있는 메시지는 t() 호출 시 변수를 전달해야 한다.
  // 카드별로 가격 데이터가 다르므로 호출 시점에 변수 전달이 어렵다 → t.raw() 로 raw string
  // 반환 후 PriceExample 안에서 수동 .replace 치환. (next-intl 표준 패턴, FORMATTING_ERROR 회피)
  const exampleLabel = t.raw('exampleCheapestLabel') as string;
  const pendingLabel = t('savingsPreviewPending');
  const priceSourceAriaLabel = t.raw('priceSourceAriaLabel') as string;

  // ADR-0050 §D1: 2+3 분리 헤더 라벨 + 베타 배지 텍스트
  const singlesLabel = tHome('categories.singles');
  const bundlesLabel = tHome('categories.bundles');
  const betaBadgeLabel = tHome('categories.beta_badge');

  // 공통 카드 props 생성 함수
  const makeCardProps = (category: TariffCategoryInput): CategoryCardProps => ({
    category,
    showExamples,
    cheapest,
    exampleLabel,
    pendingLabel,
    priceSourceAriaLabel,
    betaBadgeLabel,
    iconContainerClass,
    iconClass,
    titleClass,
    cardMinHeightClass,
    label: t(`categories.${category}.label` as Parameters<typeof t>[0]),
    description: t(`categories.${category}.description` as Parameters<typeof t>[0]),
    ariaStartLabel: t('ariaStart', { label: t(`categories.${category}.label` as Parameters<typeof t>[0]) }),
  });

  return (
    <section aria-label={t(headingKey as Parameters<typeof t>[0])}>
      {/* 헤더 (full 모드에서 표시) */}
      {variant === 'full' && (
        <header className="flex flex-col gap-3 mb-6">
          <span className="text-sm text-muted">{t(stepBadgeKey as Parameters<typeof t>[0])}</span>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {t(headingKey as Parameters<typeof t>[0])}
          </h1>
          <p className="text-base text-fg-soft">
            {t(supportNoteKey as Parameters<typeof t>[0])}
          </p>
        </header>
      )}

      {/* ADR-0050 §D1: 2+3 분리 — Hick's Law 의사결정 시간 최소화.
          1행: 단품 2장 (mobile, internet_fixed) — md:grid-cols-2
          2행: 번들 3장 (bundle_*) — md:grid-cols-3
          행 간 헤더 라벨 — Gestalt proximity 원칙 4. */}

      {/* 1행: 단품 */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted uppercase tracking-wide">
          {singlesLabel}
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SINGLE_CATEGORIES.map((category) => (
            <CategoryCard key={category} {...makeCardProps(category)} />
          ))}
        </ul>
      </div>

      {/* 2행: 번들 */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted uppercase tracking-wide">
          {bundlesLabel}
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BUNDLE_CATEGORIES.map((category) => (
            <CategoryCard key={category} {...makeCardProps(category)} />
          ))}
        </ul>
      </div>
    </section>
  );
}
