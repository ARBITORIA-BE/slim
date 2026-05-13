/**
 * GET /go/[shortId]/[itemId] — 동의 인터스티셜 Server Component (PLAN 4.1.c / 4.1.d).
 *
 * 필수 5항목 (EDPB Guidelines 05/2020 on consent, ADR-0026 §검토 2):
 *   1. 받는 회사명 — provider.name
 *   2. 처리 목적 — "어트리뷰션 목적으로 Slim 서버에 기록됩니다"
 *   3. 전송 데이터 3 sub-항목 (리다이렉트 흐름 / 전송 없음 / 공급사 자체 수집 고지)
 *   4. 동의 철회 방법 — "기록 없이 취소됩니다"
 *   5. freely given — "거부해도 비교 결과는 그대로 유지됩니다"
 *
 * 다크 패턴 0 (CMA Dark Pattern Taxonomy, ADR-0026 §검토 6):
 *   - Visual Interference X — 두 버튼 동등 가시성 (둘 다 filled, 시각적 무게 동등)
 *   - Confirmshaming X — 거부 카피 중립
 *   - Fake Urgency X — 긴급성 표현 0건
 *   - Pre-checked X — 체크박스 없음
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

import { getInterstitialData } from '@/db/queries/affiliate-click';

// ADR-0007 §T7 — nanoid 12자 URL-safe alphabet 형식 검증
const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
// UUID v4 형식 검증 (comparison_result_item.id)
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GoInterstitialPage({
  params,
}: {
  params: Promise<{ shortId: string; itemId: string }>;
}) {
  const { shortId, itemId } = await params;

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
          외부 사이트 이동
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
          {providerName} 사이트로 이동합니다
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
          이동 전 확인 사항
        </h2>

        {/* 필수 5항목 (EDPB Guidelines 05/2020 on consent) */}
        <dl className="flex flex-col gap-3 text-sm">
          {/* 항목 1 — 받는 회사명 */}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">받는 회사</dt>
            <dd className="text-fg-soft">{providerName}</dd>
          </div>

          {/* 항목 2 — 처리 목적 */}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">Slim 기록 목적</dt>
            {/* ADR-0026 §T2 — consentGivenAt NOT NULL 강제 = 동의 없으면 INSERT 0 */}
            <dd className="text-fg-soft">
              방문 사실이 Slim 서버에 어트리뷰션 목적으로 기록됩니다
            </dd>
          </div>

          {/* 항목 3 — 전송 데이터 3 sub-항목 */}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">데이터 흐름</dt>
            <dd className="text-fg-soft">
              <ul className="flex flex-col gap-1">
                {/* sub 3-1: 리다이렉트 흐름 */}
                <li>
                  Slim → 귀하의 브라우저 → {providerName} 사이트로 리다이렉트됩니다
                </li>
                {/* sub 3-2: Slim이 공급사에 전송하는 데이터 없음 */}
                <li>
                  Slim이 공급사에 전송하는 데이터: 없음 (단순 리다이렉트,{' '}
                  <code className="rounded bg-fg/5 px-1 text-xs">
                    ?ref=slim-r-{shortId}
                  </code>{' '}
                  캠페인 태그만 포함)
                </li>
                {/* sub 3-3: 공급사 자체 수집 고지 */}
                <li>
                  공급사가 자체적으로 IP·브라우저 정보를 수집할 수 있습니다
                  — 공급사의 개인정보처리방침에 따릅니다
                </li>
              </ul>
            </dd>
          </div>

          {/* 항목 4 — 동의 철회 방법 */}
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">동의 철회</dt>
            <dd className="text-fg-soft">
              이 페이지를 닫거나 &apos;비교 결과로 돌아가기&apos;를 누르면
              기록 없이 취소됩니다
            </dd>
          </div>
        </dl>

        {/* 항목 5 — freely given 명시 (단독 줄, 부각) */}
        <p className="rounded-lg bg-fg/5 px-4 py-2.5 text-sm font-medium text-fg">
          거부해도 비교 결과는 그대로 유지됩니다
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
        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          {/* 동의 경로 — POST → confirm route handler → INSERT + 302 */}
          <form
            method="POST"
            action={`/go/${shortId}/${itemId}/confirm`}
            className="contents"
          >
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-bg transition hover:opacity-90"
            >
              동의하고 이동
            </button>
          </form>

          {/* 거부 경로 — INSERT 0, provider.website 직접 링크, ?ref 미부착 (ADR-0026 §T2) */}
          {hasWebsite ? (
            <a
              href={providerWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-fg/10 px-6 py-2.5 text-sm font-medium text-fg transition hover:bg-fg/15"
            >
              {/* Confirmshaming 0: 중립 카피 (ADR-0026 §검토 6) */}
              동의 없이 외부 링크로 이동{' '}
              <span aria-hidden="true" className="ml-1">
                ↗
              </span>
              <span className="sr-only"> (새 창에서 열림)</span>
            </a>
          ) : (
            // provider.website 없음 — 이동 불가 안내 (에러 UI 4.1.d)
            // 사용자 책임이 아님을 명시 — "관리자에게 문의" 류 X
            <p className="text-sm text-fg-soft">
              이 공급사의 웹사이트 정보가 아직 등록되지 않아 외부 이동이
              불가합니다. 비교 결과로 돌아가세요.
            </p>
          )}
        </div>
      </article>

      {/* 결과 페이지 복귀 링크 — 동의 철회 1단계 */}
      <a
        href={`/r/${shortId}`}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        ← 비교 결과로 돌아가기
      </a>

      {/*
        VI.99 랭킹 명시 (ADR-0026 §검토 5) — 1줄.
        비교 결과 정렬 기준을 인터스티셜에서도 확인 가능하도록 표시.
      */}
      <p className="text-xs text-muted">
        정렬 기준: 절약액 내림차순. 제휴 여부는 정렬에 영향 없음.
      </p>
    </main>
  );
}
