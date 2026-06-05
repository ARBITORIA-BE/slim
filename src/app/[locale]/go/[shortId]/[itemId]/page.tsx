/**
 * GET /go/[shortId]/[itemId] — 동의 인터스티셜 Server Component (PLAN 4.1.c / 4.1.d / 4.5.c).
 *
 * 필수 5항목 (EDPB Guidelines 05/2020 on consent, ADR-0026 §검토 2):
 *   1. 받는 회사명 — provider.name
 *   2. 처리 목적 — "어트리뷰션 목적으로 Slim 서버에 기록됩니다"
 *   3. 전송 데이터 3 sub-항목 (리다이렉트 흐름 / 전송 없음 / 공급사 자체 수집 고지)
 *   4. 동의 철회 방법 — "기록 없이 취소됩니다"
 *   5. freely given — "거부해도 비교 결과는 그대로 유지됩니다"
 *
 * 다크 패턴 0 (CMA Dark Pattern Taxonomy, ADR-0026 §검토 6 + ADR-0028 §T7):
 *   - Visual Interference X — 두 버튼 동등 가시성 (둘 다 filled, 시각적 무게 동등)
 *   - Confirmshaming X — 거부 카피 중립
 *   - Fake Urgency X — 긴급성 표현 0건
 *   - Pre-checked X — 체크박스 defaultChecked={false} 명시 (PLAN 4.5.c — pre-checked 0 강제, ADR-0028 §T7)
 *   - Roach Motel X — 거부 1단계, 복귀 1단계
 *
 * VI.99 랭킹 명시 (ADR-0026 §검토 5) — 푸터에 1줄
 *
 * 금지 (ADR-0026 §T1):
 *   - IP / User-Agent / Referer 헤더 읽기 X
 *   - 쿠키 읽기/쓰기 X
 *   - 이 페이지 자체는 affiliate_click INSERT 하지 않음 (→ confirm 에서만)
 */

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getInterstitialData } from '@/db/queries/affiliate-click';

// ADR-0007 §T7 — nanoid 12자 URL-safe alphabet 형식 검증
const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
// UUID v4 형식 검증 (comparison_result_item.id)
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GoInterstitialPage({
  params,
}: {
  params: Promise<{ locale: string; shortId: string; itemId: string }>;
}) {
  const { locale, shortId, itemId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'affiliateInterstitial' });

  // 1. 형식 검증 — 미달 시 즉시 404.
  if (!SHORT_ID_PATTERN.test(shortId) || !UUID_PATTERN.test(itemId)) {
    notFound();
  }

  // 2. DB 조회 — 없으면 404.
  //    이 시점에서 어떤 쿠키/헤더도 읽지 않는다 (ADR-0026 §T1).
  const data = await getInterstitialData(shortId, itemId);
  if (!data) {
    notFound();
  }

  const { providerName, providerWebsite } = data;

  // provider.website 가 비어 있으면 거부 경로 링크도 없음 — 결과 페이지로 복귀만 안내.
  const hasWebsite = Boolean(providerWebsite && providerWebsite.trim() !== '');

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          {t('externalSiteLabel')}
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
          {t('heading', { providerName })}
        </h1>
      </header>

      <article
        aria-labelledby="consent-heading"
        className="flex flex-col gap-4 rounded-2xl border border-fg/10 bg-bg-warm/60 p-6"
      >
        <h2
          id="consent-heading"
          className="text-base font-semibold text-fg"
        >
          {t('consentHeading')}
        </h2>

        {/* 필수 5항목 (EDPB Guidelines 05/2020 on consent) */}
        <dl className="flex flex-col gap-3 text-sm">
          {/* 항목 1 — 받는 회사명 */}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">{t('receiverLabel')}</dt>
            <dd className="text-fg-soft">{providerName}</dd>
          </div>

          {/* 항목 2 — 처리 목적 */}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">{t('slimPurposeLabel')}</dt>
            {/* ADR-0026 §T2 — consentGivenAt NOT NULL 강제 = 동의 없으면 INSERT 0 */}
            <dd className="text-fg-soft">
              {t('slimPurposeBody')}
            </dd>
          </div>

          {/* 항목 3 — 전송 데이터 3 sub-항목 */}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">{t('dataFlowLabel')}</dt>
            <dd className="text-fg-soft">
              <ul className="flex flex-col gap-1">
                {/* sub 3-1: 리다이렉트 흐름 */}
                <li>
                  {t('dataFlowRedirect', { providerName })}
                </li>
                {/* sub 3-2: Slim이 공급사에 전송하는 데이터 없음 */}
                <li>
                  {t('dataFlowNoTransfer')}{' '}
                  <code className="rounded bg-fg/5 px-1 text-xs">
                    ?ref=slim-r-{shortId}
                  </code>{' '}
                  {t('dataFlowNoTransferEnd')}
                </li>
                {/* sub 3-3: 공급사 자체 수집 고지 */}
                <li>
                  {t('dataFlowProviderCollects')}
                </li>
              </ul>
            </dd>
          </div>

          {/* 항목 4 — 동의 철회 방법 */}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">{t('consentWithdrawalLabel')}</dt>
            <dd className="text-fg-soft">
              {t('consentWithdrawalBody')}
            </dd>
          </div>
        </dl>

        {/* 항목 5 — freely given 명시 (단독 줄, 부각) */}
        <p className="rounded-lg bg-fg/5 px-4 py-2.5 text-sm font-medium text-fg">
          {t('freelyGivenNotice')}
        </p>

        {/*
          Visual Interference 0 (CMA, ADR-0026 §검토 6):
          동의/거부 두 버튼 모두 filled (동등 시각적 무게).
          동의 = primary 색상 (bg-primary text-bg)
          거부 = secondary 색상 (bg-fg/10 text-fg)
          — 둘 다 solid fill, 동일 padding/font-size/font-weight.
          색상으로 의미를 구분하되 어느 한쪽이 명백히 더 눈에 띄지 않음.
          (일반 CTA hierarchy 와 다른 결정 — 동의 UI 에서 동등이 법적 요건)
        */}
        <form
          method="POST"
          action={`/go/${shortId}/${itemId}/confirm`}
          className="flex flex-col gap-4"
        >
          {/*
            ─── 후속 메일 섹션 (선택) ───────────────────────────────────────
            PLAN 4.5.c — Art. 13 정보 제공 (ADR-0028 §T4) + 다크패턴 0 (ADR-0028 §T7).
            - pre-checked 0: defaultChecked={false} 명시 (아래 체크박스 참조)
            - fake urgency 0: 긴급 표현 없음
            - confirmshaming 0: "받지 않을게요" 류 없음
            - 동등 가시성: 체크/미체크 둘 다 자연스러운 선택
          */}
          <section
            aria-labelledby="follow-up-heading"
            className="flex flex-col gap-3 rounded-xl border border-fg/10 bg-bg-warm/40 px-5 py-4"
          >
            <h3
              id="follow-up-heading"
              className="text-sm font-semibold text-fg"
            >
              {t('followUpHeading')}
            </h3>

            {/* Art. 13 정보 제공 카피 (ADR-0028 §T4) */}
            <p
              id="follow-up-help"
              className="text-sm leading-relaxed text-fg-soft"
            >
              {t('followUpDescription')}
            </p>
            <p className="text-sm leading-relaxed text-fg-soft">
              {t('followUpAnonymizeNote')}
            </p>
            <p className="text-sm leading-relaxed text-fg-soft">
              {t('followUpUnsubscribeNote')}{' '}
              <code className="rounded bg-fg/5 px-1 text-xs">/unsubscribe/[token]</code> (4.5.e).
            </p>

            {/* 이메일 입력 (선택) */}
            <input
              type="email"
              name="email"
              placeholder=""
              aria-describedby="follow-up-help"
              className="w-full rounded-lg border border-fg/15 bg-bg px-3 py-2 text-sm text-fg placeholder-fg-soft/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            {/*
              체크박스 — PLAN 4.5.c — pre-checked 0 강제 (ADR-0028 §T7)
              defaultChecked={false} 명시: 브라우저가 저장된 상태 복원 시에도 unchecked 유지.
            */}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-soft">
              {/* PLAN 4.5.c — pre-checked 0 강제 (ADR-0028 §T7) */}
              <input
                type="checkbox"
                name="followUp"
                value="yes"
                defaultChecked={false}
                className="h-4 w-4 rounded border-fg/20 accent-primary"
              />
              {t('followUpCheckbox')}
            </label>

            {/* 어트리뷰션 동의 종속 안내 — 오해 방지 (ADR-0028 §T3) */}
            <p className="text-xs leading-relaxed text-fg-soft/70">
              {t('followUpConsentNote')}
            </p>
          </section>

          {/* 버튼 행 */}
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* 동의 경로 — POST → confirm route handler → INSERT + 302 */}
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-bg transition hover:opacity-90"
            >
              {t('submitButton')}
            </button>

            {/* 거부 경로 — form 밖 링크 (INSERT 0, ?ref 미부착, ADR-0026 §T2) */}
            {hasWebsite ? (
              <a
                href={providerWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-fg/10 px-6 py-2.5 text-sm font-medium text-fg transition hover:bg-fg/15"
              >
                {/* Confirmshaming 0: 중립 카피 (ADR-0026 §검토 6) */}
                {t('declineButton')}{' '}
                <span aria-hidden="true" className="ml-1">
                  ↗
                </span>
                <span className="sr-only"> {t('declineButtonNewTab')}</span>
              </a>
            ) : (
              // provider.website 없음 — 이동 불가 안내 (에러 UI 4.1.d)
              // 사용자 책임이 아님을 명시 — "관리자에게 문의" 류 X
              <p className="text-sm text-fg-soft">
                {t('noWebsiteMessage')}
              </p>
            )}
          </div>
        </form>
      </article>

      {/* 결과 페이지 복귀 링크 — 동의 철회 1단계 */}
      <a
        href={`/r/${shortId}`}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t('backToResults')}
      </a>

      {/*
        VI.99 랭킹 명시 (ADR-0026 §검토 5) — 1줄.
        비교 결과 정렬 기준을 인터스티셜에서도 확인 가능하도록 표시.
      */}
      <p className="text-xs text-muted">
        {t('rankingNote')}
      </p>
    </main>
  );
}
