/**
 * /r/[shortId]/not-found.tsx — 잘못된 shortId 또는 미존재 결과 (ADR-0021 §T1).
 *
 * Next.js App Router 표준 — `notFound()` 호출 시 본 컴포넌트가 렌더되며
 * HTTP 404 응답. 정규식 미달(`/^[A-Za-z0-9_-]{12}$/`)이 1차 트리거. DB 존재 여부
 * 검증(Sub-task 5)은 별도 트리거.
 *
 * P3 정직성 — 사용자에게 *왜* 못 찾는지 + *다음 단계* 명시.
 *
 * i18n: getTranslations (RSC) — 'result.notFound' 네임스페이스.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function ResultNotFoundPage() {
  // why: RSC 이므로 getTranslations 사용.
  const t = await getTranslations('result.notFound');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-muted">{t('linkLabel')}</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t('heading')}
        </h1>
      </header>

      <section className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-6 text-sm leading-relaxed text-fg-soft">
        <p>
          {t('body')}
        </p>
        <p className="mt-3 text-xs">
          {t('formatNote')}{' '}
          {/* why: formatCode 는 기술적 포맷 설명 — 언어별 번역으로 제공 */}
          <code className="rounded bg-bg px-1.5 py-0.5 font-mono">{t('formatCode')}</code>
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/compare"
          className="inline-flex items-center justify-center rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition hover:bg-primary"
        >
          {t('newCompare')}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-fg/20 px-6 py-3 text-sm font-medium text-fg transition hover:bg-bg-warm"
        >
          {t('goHome')}
        </Link>
      </div>
    </main>
  );
}
