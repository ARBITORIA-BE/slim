/**
 * GET /go/[shortId]/[itemId] — 동의 인터스티셜 Server Component (PLAN 4.1.c).
 *
 * 표시 (ADR-0026 §T2 + 헌법 §8 #1/#3):
 *   - 받는 회사명 (provider.name)
 *   - "전송 데이터: 없음 (단순 리다이렉트)"
 *   - "방문 사실은 어트리뷰션을 위해 Slim 서버에 기록됩니다"
 *   - [동의하고 이동] — POST /go/[shortId]/[itemId]/confirm
 *   - [동의 없이 외부 링크] — provider.website 직접 링크, ?ref 미부착
 *
 * 다크 패턴 0 (헌법 §8 #3):
 *   - 두 버튼 동등 가시성 // TODO(4.1.d) — 스타일 상세화
 *   - 긴급성 표현 X
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
          {/* TODO(4.1.d) — 4.1.d 에서 헤딩 최종 문구 및 provider 로고 배치 결정 */}
          {providerName} 사이트로 이동
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
          {/* TODO(4.1.d) — 다크패턴 0 검증: 문구 최종화 + 동등 가시성 검토 */}
          이동 전 확인 사항
        </h2>

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">받는 회사</dt>
            <dd className="text-fg-soft">{providerName}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">전송 데이터</dt>
            {/* ADR-0026 §T1 — IP/fingerprint/session 0건 */}
            <dd className="text-fg-soft">없음 (단순 리다이렉트)</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-fg">Slim 기록</dt>
            {/* ADR-0026 §T2 — consentGivenAt NOT NULL 강제 = 동의 없으면 INSERT 0 */}
            <dd className="text-fg-soft">
              방문 사실은 어트리뷰션을 위해 Slim 서버에 기록됩니다
            </dd>
          </div>
        </dl>

        {/* TODO(4.1.d) — 버튼 배치/스타일 최종화: 동등 가시성, 주요 버튼 강조 X */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          {/* 동의 경로 — POST → confirm route handler → INSERT + 302 */}
          <form
            method="POST"
            action={`/go/${shortId}/${itemId}/confirm`}
            className="contents"
          >
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-fg px-6 py-2.5 text-sm font-medium text-bg transition hover:bg-primary"
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
              className="inline-flex items-center justify-center rounded-full border border-fg/15 bg-bg px-6 py-2.5 text-sm font-medium text-fg transition hover:border-fg/30"
            >
              동의 없이 외부 링크로 이동{' '}
              <span aria-hidden="true" className="ml-1">
                ↗
              </span>
              <span className="sr-only"> (새 창에서 열림)</span>
            </a>
          ) : (
            // provider.website 없음 — 이동 불가 안내만
            <p className="text-sm text-fg-soft">
              {/* TODO(4.1.d) — 에러 상태 UI 최종화 */}
              공급사 웹사이트 정보가 없습니다. 관리자에게 문의하세요.
            </p>
          )}
        </div>
      </article>

      {/* 결과 페이지 복귀 링크 */}
      <a
        href={`/r/${shortId}`}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        ← 비교 결과로 돌아가기
      </a>
    </main>
  );
}
