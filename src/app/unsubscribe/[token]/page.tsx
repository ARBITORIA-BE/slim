/**
 * GET /unsubscribe/[token] — 1-click 후속 메일 해제 (PLAN 4.5.e).
 *
 * RSC (Server Component) 선택 근거:
 *   - GET 1-click 트리거 = RSC side-effect 허용 컨텍스트 (Resend 권장 패턴).
 *   - 4.1.c /go/[shortId]/[itemId]/page.tsx 인터스티셜 패턴 일관.
 *   - 'use client' 불필요 — 인터랙션 없음 (confirmation 표시만).
 *
 * 다크패턴 0 (ADR-0028 §T7, CMA Dark Pattern Taxonomy):
 *   - 재구독 유도 0   — "다시 받으시려면" 류 없음
 *   - 마케팅 톤 0    — "그동안 감사" / "다음에 만나요" 류 없음
 *   - Confirmshaming 0 — "정말 해제?" 류 없음 (1-click = 이미 해제 완료 결과 표시만)
 *
 * 금지 (헌법 §8 #1):
 *   - headers() / cookies() / Set-Cookie 0건
 *   - IP / User-Agent / Referer 읽기 0건
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { unsubscribeByToken } from '@/db/queries/follow-up-email';

// ADR-0028 §T2 unsubscribe_token = nanoid(16) URL-safe alphabet
// /^[A-Za-z0-9_-]{16}$/ — 정확히 16자
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // 1. 형식 검증 — 16자 nanoid URL-safe alphabet. 불일치 → 404.
  if (!TOKEN_PATTERN.test(token)) {
    notFound();
  }

  // 2. DB 처리 — SELECT + 조건부 atomic UPDATE
  //    headers() / cookies() 없음 (헌법 §8 #1)
  const result = await unsubscribeByToken(token);

  // 3. 토큰 매칭 없음 → 404
  if (result.kind === 'not-found') {
    notFound();
  }

  // 4. confirmation UI — 단순화: 첫 클릭 / 재클릭 동일 메시지 (idempotency)
  //    DoD §1 "단순화 권장" 선택 — 상태 차이 노출 X (사용자 관점: "해제됨" 결과 동일)
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        {/*
          다크패턴 0 점검:
          - "해제 완료" = 사실 명시 (마케팅 톤 X)
          - 이모지 없음 (DoD 명세상 허용이나 중립 선택)
        */}
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          후속 메일 해제
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
          Slim 후속 메일 해제 완료
        </h1>
      </header>

      <article
        aria-labelledby="unsubscribe-heading"
        className="flex flex-col gap-4 rounded-2xl border border-fg/10 bg-bg-warm/60 p-6"
      >
        <h2
          id="unsubscribe-heading"
          className="text-base font-semibold text-fg"
        >
          해제 내용
        </h2>

        {/*
          본문 — ADR-0028 §T7 다크패턴 0 준수:
          1. 사실 명시 (해제됨)
          2. 법적 근거 (GDPR Art. 6(1)(c) 회계 의무 — 클릭 기록 유지 사유)
          3. 재구독 유도 0 / 마케팅 톤 0 / Confirmshaming 0
        */}
        <p className="text-sm leading-relaxed text-fg-soft">
          지정하신 이메일 주소를 Slim 후속 메일 명단에서 제외했습니다.
        </p>
        <p className="text-sm leading-relaxed text-fg-soft">
          어트리뷰션 클릭 기록은 GDPR Art. 6(1)(c) 회계 의무로 유지되며,
          본 해제는 후속 메일 발송 중단만 의미합니다. 이메일 주소는 즉시 익명화됩니다
          (ADR-0028 §T5).
        </p>
      </article>

      {/* 홈 복귀 링크 — DoD §1 "← Slim 홈으로 돌아가기" */}
      <Link
        href="/"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        ← Slim 홈으로 돌아가기
      </Link>
    </main>
  );
}
