/**
 * CategoryGrid — 블록 2: 카테고리 카드 3개 (ADR-0041 D1 §블록 2, Amendment 1 D7~D8, PLAN 4.13.c).
 *
 * RSC. 홈(variant='hero') + /compare(variant='full') 공유 컴포넌트.
 * ISR revalidate=3600 (admin 메트릭과 동일 신선도).
 *
 * 헌법 §8 #3: 다크패턴 0 — 카드 동일 시각 무게, "추천" 라벨 0.
 * 헌법 P1: 가격 표시 시 source_url + fetched_at tooltip.
 * ADR-0034 D2: 통신 BE 3 카테고리만 (에너지/보험 등 placeholder 0).
 * ADR-0041 D21 (Amendment 4): 가격 강조 = text-accent-dark font-semibold.
 * WCAG AA: text-accent-dark #A98307 vs bg #FAF7F2 ≈ 4.5:1 (AA Pass).
 */

import Link from 'next/link';
import { Smartphone, Tv, Wifi, type LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const CATEGORY_ICONS: Record<CategoryIconKey, LucideIcon> = {
  mobile: Smartphone,
  internet_fixed: Wifi,
  bundle_internet_tv: Tv,
};

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
  /** 데이터 부재 시 표시 문자열 */
  pendingLabel: string;
  /** abbr aria-label 템플릿 "{sourceUrl}" 치환 — 헌법 §8 #6 한글 리터럴 금지 */
  priceSourceAriaLabel: string;
}

function PriceExample({ cheapest, category, exampleLabel, pendingLabel, priceSourceAriaLabel }: PriceExampleProps) {
  const data = cheapest[category];
  if (!data) {
    // ADR-0011 §T2 항목 5 동형 — 0 데이터 정직 표시
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

export async function CategoryGrid({
  variant,
  showExamples = false,
  density = 'compact',
}: CategoryGridProps) {
  // why: RSC 이므로 getTranslations 사용 (await 필요).
  const t = await getTranslations('compare');

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

  // why: ICU placeholder가 있는 메시지는 t() 호출 시 변수를 전달해야 한다.
  // 카드별로 가격 데이터가 다르므로 호출 시점에 변수 전달이 어렵다 → t.raw() 로 raw string
  // 반환 후 PriceExample 안에서 수동 .replace 치환. (next-intl 표준 패턴, FORMATTING_ERROR 회피)
  const exampleLabel = t.raw('exampleCheapestLabel') as string;
  const pendingLabel = t('savingsPreviewPending');
  const priceSourceAriaLabel = t.raw('priceSourceAriaLabel') as string;

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

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TARIFF_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          const label = t(`categories.${category}.label` as Parameters<typeof t>[0]);
          const description = t(`categories.${category}.description` as Parameters<typeof t>[0]);
          return (
            <li key={category}>
              <Link
                href={`/compare/${category}/postal`}
                className="block rounded-2xl outline-none ring-offset-bg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t('ariaStart', { label })}
              >
                {/* ADR-0041 D21: hover active selection → border-accent-dark (그린골드) */}
                <Card className="flex h-full flex-col justify-between transition hover:border-accent-dark hover:bg-bg-warm/70">
                  <CardHeader className="flex flex-row items-center gap-4 pb-3">
                    <span className={iconContainerClass}>
                      <Icon className={iconClass} aria-hidden />
                    </span>
                    <div className="flex flex-col gap-1">
                      <CardTitle className={titleClass}>{label}</CardTitle>
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
                      />
                    </div>
                  )}
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
