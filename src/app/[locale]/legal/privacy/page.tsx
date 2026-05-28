/**
 * /legal/privacy — 개인정보처리방침 (PLAN 4.12.b).
 *
 * 왜 이 페이지가 필요한가?
 *   ADR-0037 D2: GDPR Art.13 정보제공 의무 — 비교 플로우가 우편번호/가구형태/
 *   현재공급사/사용량을 수집(ADR-0007)하나 공개 처리방침 페이지가 없다.
 *   gdpr-register.md (PA-01~PA-05) 를 공개 Art.13 통지로 단일 노출한다.
 *
 * GDPR Art.13 §1·§2 항목 전수 커버 (ADR-0037 D2 표):
 *   §1(a) 컨트롤러 신원·연락처 — LEGAL_ENTITY
 *   §1(b) DPO — 해당없음 (Art.37 소규모 솔로)
 *   §1(c) 처리 목적 + 법적근거 — PA-01~PA-05
 *   §1(d) 정당한 이익 — PA-04 보안로그 6(1)(f)
 *   §1(e) 수령자/카테고리 — Sentry/PostHog/Neon/Vercel/Resend
 *   §1(f) 제3국 이전 — Neon EU / Sentry US(SCCs) / PostHog EU
 *   §2(a) 보존기간 — 90일/영구/7~10년/즉시NULL
 *   §2(b) 정보주체 권리 — Art.15-21
 *   §2(c) 동의 철회권 — PA-03/PA-05/쿠키
 *   §2(d) 감독기관 민원권 — BE APD / NL AP / LU CNPD
 *   §2(e) 데이터 제공 의무 성격 — 서비스 이행 필수
 *   §2(f) 자동화 의사결정 없음 — 비교엔진=산술, 프로파일링 아님
 *
 * Art.14: 직접 수집 only — 간접 수집 없음, 비대상.
 *
 * i18n: legal.privacy.* 네임스페이스 — legal 검수 게이트(ADR-0033 §T4).
 *   @i18n-allow metadata 마커 금지.
 *
 * RSC — 동적 데이터 없음. affiliate-disclosure 동형.
 *
 * NOTE: 본문 텍스트는 legal 에이전트 검수(PLAN 4.12.f) 대기 중. 초안.
 *       등록 주소 null(ADR-0035) → 컨트롤러 주소 줄 조건부 비노출(LEGAL_ENTITY.address 동형).
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { LEGAL_ENTITY, formatEnterpriseNumber, formatVatNumber } from '@/lib/legal';

// ─── 메타데이터 ─────────────────────────────────────────────────────────────
// ADR-0033 Amd5 패턴: generateMetadata + getTranslations.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: {
      canonical: '/legal/privacy',
    },
  };
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // legal.privacy.* 네임스페이스 — legal 검수 게이트 대상 (ADR-0033 §T4)
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });

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
        <p className="text-xs text-fg-soft">{t('lastUpdated')}</p>
      </header>

      {/* Art.14 비대상 명시 */}
      <p className="mb-8 text-sm leading-relaxed text-fg-soft">
        {t('directCollectionNote')}
      </p>

      <section className="flex flex-col gap-8 text-sm leading-relaxed text-fg-soft">

        {/* ── Art.13 §1(a) 컨트롤러 신원 ───────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('controllerHeading')}
          </h2>
          <p className="mb-3">{t('controllerBody')}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-fg">{t('controllerNameLabel')}</dt>
            <dd>{LEGAL_ENTITY.legalName}</dd>
            <dt className="font-medium text-fg">{t('controllerNumberLabel')}</dt>
            <dd>{formatEnterpriseNumber(LEGAL_ENTITY.enterpriseNumber)}</dd>
            <dt className="font-medium text-fg">{t('controllerVatLabel')}</dt>
            <dd>{formatVatNumber(LEGAL_ENTITY.vatNumber)}</dd>
            {/* 주소: null(ADR-0035) → 비노출. 운영자 주소 수령 시 1줄 변경. */}
            <dt className="font-medium text-fg">{t('controllerEmailLabel')}</dt>
            <dd>
              <a
                href={`mailto:${LEGAL_ENTITY.contactEmail}`}
                className="underline underline-offset-4 hover:text-fg"
              >
                {LEGAL_ENTITY.contactEmail}
              </a>
            </dd>
          </dl>
          {/* Art.13 §1(b) DPO — 해당 없음 */}
          <p className="mt-3 text-xs text-fg-soft">
            <strong className="text-fg">{t('dpoHeading')}</strong>{' '}
            {t('dpoBody')}
          </p>
        </div>

        {/* ── Art.13 §1(c)+(d) 처리 목적 + 법적근거 ───────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('processingHeading')}
          </h2>

          {/* PA-01 비교 요청 처리 */}
          <div className="mb-4">
            <h3 className="mb-1 font-medium text-fg">
              {t('processingPA01Heading')}
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('processingPA01Purpose')}</li>
              <li>{t('processingPA01LegalBasis')}</li>
              <li>{t('processingPA01Data')}</li>
            </ul>
          </div>

          {/* PA-02 비교 결과 보존 */}
          <div className="mb-4">
            <h3 className="mb-1 font-medium text-fg">
              {t('processingPA02Heading')}
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('processingPA02Purpose')}</li>
              <li>{t('processingPA02LegalBasis')}</li>
            </ul>
          </div>

          {/* PA-03 어필리에이트 클릭 */}
          <div className="mb-4">
            <h3 className="mb-1 font-medium text-fg">
              {t('processingPA03Heading')}
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('processingPA03Purpose')}</li>
              <li>{t('processingPA03LegalBasis')}</li>
            </ul>
          </div>

          {/* PA-04 보안 로그 */}
          <div className="mb-4">
            <h3 className="mb-1 font-medium text-fg">
              {t('processingPA04Heading')}
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('processingPA04Purpose')}</li>
              <li>{t('processingPA04LegalBasis')}</li>
            </ul>
          </div>

          {/* PA-05 후속 메일 */}
          <div className="mb-4">
            <h3 className="mb-1 font-medium text-fg">
              {t('processingPA05Heading')}
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('processingPA05Purpose')}</li>
              <li>{t('processingPA05LegalBasis')}</li>
            </ul>
          </div>
        </div>

        {/* ── Art.13 §1(d) 정당한 이익 ─────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('legitimateInterestHeading')}
          </h2>
          <p>{t('legitimateInterestBody')}</p>
        </div>

        {/* ── Art.13 §1(e) 수령자/카테고리 ─────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('recipientsHeading')}
          </h2>
          <p className="mb-2">{t('recipientsBody')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('recipientSentry')}</li>
            <li>{t('recipientPostHog')}</li>
            <li>{t('recipientNeon')}</li>
            <li>{t('recipientVercel')}</li>
            <li>{t('recipientResend')}</li>
          </ul>
          <p className="mt-2 text-xs text-fg-soft">{t('recipientAffiliateNote')}</p>
        </div>

        {/* ── Art.13 §1(f) 제3국 이전 ──────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('internationalTransferHeading')}
          </h2>
          <p>{t('internationalTransferBody')}</p>
        </div>

        {/* ── Art.13 §2(a) 보존기간 ─────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('retentionHeading')}
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('retentionPA01')}</li>
            <li>{t('retentionPA02')}</li>
            <li>{t('retentionPA03Click')}</li>
            <li>{t('retentionPA05Email')}</li>
          </ul>
        </div>

        {/* ── Art.13 §2(b) 정보주체 권리 ───────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('rightsHeading')}
          </h2>
          <p className="mb-2">{t('rightsBody')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('rightAccess')}</li>
            <li>{t('rightRectification')}</li>
            <li>{t('rightErasure')}</li>
            <li>{t('rightRestriction')}</li>
            <li>{t('rightObject')}</li>
            <li>{t('rightPortability')}</li>
            <li>{t('rightWithdraw')}</li>
          </ul>
        </div>

        {/* ── Art.13 §2(c) 동의 철회권 ─────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('withdrawConsentHeading')}
          </h2>
          <p>{t('withdrawConsentBody')}</p>
        </div>

        {/* ── Art.13 §2(d) 감독기관 민원권 ─────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('supervisoryHeading')}
          </h2>
          <p className="mb-2">{t('supervisoryBody')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('supervisoryBE')}</li>
            <li>{t('supervisoryNL')}</li>
            <li>{t('supervisoryLU')}</li>
          </ul>
        </div>

        {/* ── Art.13 §2(e) 데이터 제공 의무 성격 ───────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('obligationHeading')}
          </h2>
          <p>{t('obligationBody')}</p>
        </div>

        {/* ── Art.13 §2(f) 자동화 의사결정 없음 ────────────────────────── */}
        {/* 헌법 §8 #4: 알고리즘 순위 = 절약액 산술, 프로파일링 아님 */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('automatedDecisionHeading')}
          </h2>
          <p>{t('automatedDecisionBody')}</p>
        </div>

        {/* ── 연락처 ────────────────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            {t('contactHeading')}
          </h2>
          <p className="mb-2">{t('contactBody')}</p>
          <p>
            <a
              href={`mailto:${LEGAL_ENTITY.contactEmail}`}
              className="underline underline-offset-4 hover:text-fg"
            >
              {LEGAL_ENTITY.contactEmail}
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
          {t('backLink')}
        </Link>
      </footer>
    </main>
  );
}
