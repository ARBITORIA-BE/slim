/**
 * /r/[shortId]/not-found.tsx — 잘못된 shortId 또는 미존재 결과 (ADR-0021 §T1).
 *
 * Next.js App Router 표준 — `notFound()` 호출 시 본 컴포넌트가 렌더되며
 * HTTP 404 응답. 정규식 미달(`/^[A-Za-z0-9_-]{12}$/`)이 1차 트리거. DB 존재 여부
 * 검증(Sub-task 5)은 별도 트리거.
 *
 * P3 정직성 — 사용자에게 *왜* 못 찾는지 + *다음 단계* 명시.
 */

import Link from 'next/link';

export default function ResultNotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-muted">결과 링크 — 404</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          이 결과는 더 이상 존재하지 않습니다
        </h1>
      </header>

      <section className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-6 text-sm leading-relaxed text-fg-soft">
        <p>
          링크가 잘못 입력됐거나, 결과가 만료됐을 수 있습니다. 새로 비교를 시작하면
          영구 링크가 다시 생성됩니다.
        </p>
        <p className="mt-3 text-xs">
          영구 링크 형식: <code className="rounded bg-bg px-1.5 py-0.5 font-mono">/r/{'{12자 영문/숫자/_/-}'}</code>
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/compare"
          className="inline-flex items-center justify-center rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition hover:bg-primary"
        >
          새로 비교 시작
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-fg/20 px-6 py-3 text-sm font-medium text-fg transition hover:bg-bg-warm"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
