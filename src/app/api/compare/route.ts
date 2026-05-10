/**
 * POST /api/compare — 페이즈 2 입력 플로우의 종착점 (ADR-0016 §T7).
 *
 * 페이즈 2 1차 (현재): Zod 재검증 + shortId(nanoid 12자) 생성만. DB insert +
 * compare() 호출 + comparison_result item insert 풀 구현은 페이즈 3 진입 시
 * 별도 ADR로 추가 (ADR-0011 §T2 항목 5 "런칭 초기" 동형 정직 노출 — preview
 * 페이지가 placeholder shortId 안내).
 *
 * 클라이언트 우회 방어: 본 라우트가 sessionStorage 입력을 *재검증* (T7).
 * Zod safeParse 실패 → 400, 통과 → 200 + shortId.
 *
 * 동기 5초 timeout: ADR-0007 §T10. 페이즈 2 1차 stub 응답은 ms 단위라 timeout
 * 위험 0. 페이즈 3 풀 구현 시 setTimeout(5000) 또는 AbortController 추가.
 */

import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { comparisonInputSchema } from '@/types/comparison-input';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = comparisonInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // ADR-0007 §T7 nanoid 12자 + alphabet 36 (소문자+숫자) → 36^12 ≈ 4.7e18 공간
  const shortId = nanoid(12);

  // TODO (페이즈 3 진입 시): comparison_request insert + compare() 호출
  // + comparison_result + comparison_result_item insert (ADR-0016 §T7)

  return NextResponse.json({ ok: true, shortId });
}
