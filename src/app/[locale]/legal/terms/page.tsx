/**
 * /legal/terms — 이용약관 (PLAN 4.12.a).
 *
 * 왜 이 페이지가 필요한가?
 *   ADR-0037 D1: compare/page.tsx 가 /legal/terms 링크를 노출하나
 *   라우트가 없어 404 + 허위 동의 = 헌법 P3 위반 + UCPD 오인유발.
 *   이 페이지 신설로 (1) 404 해소, (2) 실재 약관 링크 제공.
 *
 * 구조 (ADR-0037 D1 범위):
 *   - 서비스 정의 (통신 비교, 정보 제공 only)
 *   - 비교 결과 면책 (가공 0 — 헌법 §8 #2, 절약액 계산만)
 *   - 어필리에이트 cross-ref (/legal/affiliate-disclosure)
 *   - 개인정보처리방침 cross-ref (/legal/privacy)
 *   - 책임 제한
 *   - 준거법 (벨기에)
 *   - 운영자 식별 (LEGAL_ENTITY 재사용)
 *
 * i18n: legal.terms.* 네임스페이스 — legal 검수 게이트(ADR-0033 §T4).
 *   신규 페이지는 처음부터 4 locale i18n — @i18n-allow metadata 마커 금지.
 *
 * RSC — 동적 데이터 없음. affiliate-disclosure 동형.
 *
 * NOTE: 본문 텍스트는 legal 에이전트 검수(PLAN 4.12.f) 대기 중. 초안.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { LEGAL_ENTITY, formatEnterpriseNumber, formatVatNumber } from '@/lib/legal';

// ─── 메타데이터 ─────────────────────────────────────────────────────────────
// ADR-0033 Amd5 패턴: generateMetadata + getTranslations.
// @i18n-allow metadata 마커 사용 금지 (신규 페이지는 처음부터 i18n).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.terms' });

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: {
      canonical: '/legal/terms',
    },
  };
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // legal.terms.* 네임스페이스 — legal 검수 게이트 대상 (ADR-0033 §T4)
  const t = await getTranslations({ locale, namespace: 'legal.terms' });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t('heading')}
        </h1>
        {/* legal 검수 대기 플래그 — PLAN 4.12.f 완료 전 초안 표시 */}
        <p
          role="note"
          aria-label="draft notice"
          className="rounded-2xl border border-fg/10 bg-bg-warm/60 p-3 text-sm text-fg-soft"
        >
          {t('draftNotice')}
        </p>
      </header>

      <section className="flex flex-col gap-8 text-sm leading-relaxed text-fg-soft">

        {/* ── 1. 서비스 정의 ──────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('serviceDefinitionHeading')}
          </h2>
          <p>{t('serviceDefinitionBody')}</p>
        </div>

        {/* ── 2. 비교 결과 면책 (헌법 §8 #2 — 가공 0 원칙 명시) ──────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('comparisonDisclaimerHeading')}
          </h2>
          <p>{t('comparisonDisclaimerBody')}</p>
        </div>

        {/* ── 3. 어필리에이트 관계 cross-ref ──────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('affiliateHeading')}
          </h2>
          <p className="mb-2">{t('affiliateBody')}</p>
          <p>
            <Link
              href="/legal/affiliate-disclosure"
              className="underline underline-offset-4 hover:text-fg"
            >
              {t('affiliateLinkText')} →
            </Link>
          </p>
        </div>

        {/* ── 4. 개인정보 처리 cross-ref ───────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('privacyRefHeading')}
          </h2>
          <p className="mb-2">{t('privacyRefBody')}</p>
          <p>
            <Link
              href="/legal/privacy"
              className="underline underline-offset-4 hover:text-fg"
            >
              {t('privacyLinkText')} →
            </Link>
          </p>
        </div>

        {/* ── 5. 책임 제한 ─────────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('liabilityHeading')}
          </h2>
          <p>{t('liabilityBody')}</p>
        </div>

        {/* ── 6. 준거법 및 관할 ─────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('governingLawHeading')}
          </h2>
          <p>{t('governingLawBody')}</p>
        </div>

        {/* ── 7. 운영자 식별 (LEGAL_ENTITY 재사용 — 헌법 P1) ───────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('operatorHeading')}
          </h2>
          <p className="mb-3">{t('operatorBody')}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-fg">{t('operatorNameLabel')}</dt>
            <dd>{LEGAL_ENTITY.legalName}</dd>
            <dt className="font-medium text-fg">{t('operatorNumberLabel')}</dt>
            <dd>{formatEnterpriseNumber(LEGAL_ENTITY.enterpriseNumber)}</dd>
            <dt className="font-medium text-fg">{t('operatorVatLabel')}</dt>
            <dd>{formatVatNumber(LEGAL_ENTITY.vatNumber)}</dd>
            <dt className="font-medium text-fg">{t('operatorEmailLabel')}</dt>
            <dd>
              <a
                href={`mailto:${LEGAL_ENTITY.contactEmail}`}
                className="underline underline-offset-4 hover:text-fg"
              >
                {LEGAL_ENTITY.contactEmail}
              </a>
            </dd>
          </dl>
        </div>
      </section>

      {/* ── footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-10 border-t border-fg/10 pt-4 text-xs text-fg-soft">
        <Link
          href="/data-sources"
          className="underline-offset-4 hover:underline"
        >
          {t('backLink')}
        </Link>
      </footer>
    </main>
  );
}
