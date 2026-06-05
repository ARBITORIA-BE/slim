/**
 * /legal/affiliate-disclosure — 어필리에이트 수수료 공개 (PLAN 4.3.d).
 *
 * 왜 이 페이지가 필요한가?
 *   헌법 §3 P3: "모든 제휴 수수료는 비교 결과 페이지 하단에 단가까지 공개."
 *   ADR-0026 §T4 + §검토 5 (UCPD + BE CDE VI.99): 수수료 공개 + 정렬 기준 명시 의무.
 *   ADR-0027 §T1~T5: affiliateRates 가 단일 출처 — 이 페이지가 그대로 렌더.
 *   헌법 §8 #4 광고-비교 분리: "비교 순위는 절약액 알고리즘 단일" 명시.
 *
 * 이 페이지는 4.3.c AffiliateDisclosureLine 의 "/legal/affiliate-disclosure" 링크의 도착지다.
 * (코드 cross-ref — 사용자에게 노출 X)
 *
 * RSC — affiliateRates 정적 import, 동적 데이터 없음. revalidate 불필요.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { affiliateRates } from '@/data/affiliate-rates';
import { formatEuroCents } from '@/lib/format-eur';
import { Link } from '@/i18n/navigation';
import { buildAlternates } from '@/lib/alternates';

// ─── 메타데이터 ───────────────────────────────────────────────────────────────
// 왜 generateMetadata 로 변환하는가?
//   hreflang alternates + metadata 텍스트 i18n (B.2).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const alts = buildAlternates(locale, '/legal/affiliate-disclosure');
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('affiliateDisclosure.title'),
    description: t('affiliateDisclosure.description'),
    alternates: alts,
  };
}

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

/**
 * providerId 를 사람이 읽기 좋은 표시명으로 변환 (정책 C 채택).
 *
 * 왜 정책 C인가:
 *   (a) 매핑 테이블: 별도 유지보수 부담. (b) providerName 필드 추가: ADR-0027 §T2 수정 필요.
 *   (c) 문자열 케이스 변환: 단순하고, placeholder 라는 점이 표시명에 노출되어 정직성 일관.
 *   실 UUID가 들어왔을 때의 표시명 매핑은 4.3.b 후속 PR (실 providerId 등록 시점)에서 해결.
 *
 * 예: "placeholder-proximus-be" → "Placeholder Proximus Be"
 */
function formatProviderId(providerId: string): string {
  return providerId
    .split('-')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

/**
 * effectiveTo 날짜 표시 (없으면 "—").
 * ISO 8601 date 문자열을 그대로 표시 — 별도 파싱 없음.
 */
function formatEffectiveTo(effectiveTo: string | undefined): string {
  return effectiveTo ?? '—';
}

/**
 * 모든 entry 의 source 가 'placeholder' 로 시작하는지 확인.
 * placeholder-only 상태면 알림 배너를 표시한다.
 */
function isPlaceholderOnly(rates: typeof affiliateRates): boolean {
  if (rates.length === 0) return false;
  return rates.every((r) => r.source.startsWith('placeholder'));
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export default async function AffiliatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.affiliateDisclosure' });
  const rates = affiliateRates;
  const showPlaceholderBanner = isPlaceholderOnly(rates);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-fg-soft">
          {t('pageSubtitle')}
        </p>
      </header>

      <section className="flex flex-col gap-8 text-sm leading-relaxed text-fg-soft">

        {/* ── 1. 상업적 관계 명시 (UCPD) ──────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">{t('commercialRelationHeading')}</h2>
          <p className="mb-2">
            {t('commercialRelationBody1')}
          </p>
          <p>
            {t('commercialRelationBody2')}
          </p>
        </div>

        {/* ── 2. 순위 알고리즘 독립성 (BE CDE VI.99 + 헌법 §8 #4) ──────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('rankingAlgorithmHeading')}
          </h2>
          <p className="mb-2">
            {t('rankingAlgorithmBody1')}
          </p>
          <p className="mb-2">
            {t('rankingAlgorithmBody2Part1')}{' '}
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              src/engine/compare.ts
            </code>
            {t('rankingAlgorithmBody2Part2')}{' '}
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              affiliate_status
            </code>
            {t('rankingAlgorithmBody2Part3')}{' '}
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              affiliate_click
            </code>{' '}
            {t('rankingAlgorithmBody2Part4')}
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              src/engine/compare.isolation.test.ts
            </code>
            {t('rankingAlgorithmBody2Part5')}
          </p>
          <p>
            {t('rankingAlgorithmBody3')}
          </p>
        </div>

        {/* ── 3. 인터스티셜 카피 cross-ref (4.1.d 일관성) ──────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">{t('interstitialConsistencyHeading')}</h2>
          <p>
            {t('interstitialConsistencyBody')}{' '}
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              /go/...
            </code>
          </p>
        </div>

        {/* ── 4. GDPR / 보존 cross-ref ──────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">{t('gdprRetentionHeading')}</h2>
          <p>
            {t('gdprRetentionBody')}
          </p>
        </div>

        {/* ── 5. 수수료 단가 표 (ADR-0027 §T1 — 데이터 소스에서 렌더) ──── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">{t('ratesHeading')}</h2>

          {/* placeholder-only 알림 배너 — 실 entry 추가 시 자동 사라짐 */}
          {showPlaceholderBanner && (
            <div
              role="note"
              aria-label={t('placeholderBannerAriaLabel')}
              className="mb-4 rounded-2xl border border-fg/10 bg-bg-warm/60 p-4 text-sm"
            >
              {t('placeholderBannerBody')}
            </div>
          )}

          {rates.length === 0 ? (
            /* 빈 배열: 활성 계약 없음 */
            <p>{t('noRatesMessage')}</p>
          ) : (
            /* 표: commissionType === 'CPA' 만 (ADR-0027 §T2 CPA literal 강제) */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-fg/10">
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      {t('tableColProvider')}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      {t('tableColType')}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      {t('tableColRate')}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      {t('tableColCurrency')}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      {t('tableColSource')}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      {t('tableColCheckedAt')}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      {t('tableColEffectiveFrom')}
                    </th>
                    <th scope="col" className="py-2 text-left font-semibold text-fg">
                      {t('tableColEffectiveTo')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rates
                    .filter((r) => r.commissionType === 'CPA')
                    .map((rate) => (
                      <tr
                        key={rate.providerId}
                        className="border-b border-fg/5 last:border-0"
                      >
                        <td className="py-2 pr-3">{formatProviderId(rate.providerId)}</td>
                        <td className="py-2 pr-3">{rate.commissionType}</td>
                        <td className="py-2 pr-3">{formatEuroCents(rate.amountCents)}</td>
                        <td className="py-2 pr-3">{rate.currency}</td>
                        <td className="py-2 pr-3 max-w-[12rem] truncate" title={rate.source}>
                          {rate.source}
                        </td>
                        <td className="py-2 pr-3">{rate.fetchedAt}</td>
                        <td className="py-2 pr-3">{rate.effectiveFrom}</td>
                        <td className="py-2">{formatEffectiveTo(rate.effectiveTo)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 6. 문의 ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">{t('contactHeading')}</h2>
          <p>
            {t('contactBody')}{' '}
            <a
              href="mailto:kim.wonmin91@gmail.com"
              className="underline underline-offset-4 hover:text-fg"
            >
              kim.wonmin91@gmail.com
            </a>
          </p>
        </div>
      </section>

      {/* ── footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-10 border-t border-fg/10 pt-4 text-xs text-fg-soft">
        <Link
          href="/data-sources"
          className="underline-offset-4 hover:underline"
        >
          {t('footerBackLink')}
        </Link>
      </footer>
    </main>
  );
}
