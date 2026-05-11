/**
 * withTimeout — Promise + 절대 시간 race (Sub-task 5).
 *
 * ADR-0007 §T10 동기 5초 timeout 정합. /api/compare 풀 흐름 (DB insert + compare
 * + result insert) 전체를 한 race 로 감싼다.
 *
 * 주의 (neon-http AbortSignal 미지원):
 *   - timeout 발화해도 진행 중 DB 쿼리는 그대로 흐른다.
 *   - 결과적으로 comparison_request 만 남고 comparison_result 가 없는 *orphan*
 *     row 가 1건 남을 수 있음. ADR-0021 §T3 "부분 실패 시 분석 가치" 정합 —
 *     운영자가 4.5.1 어드민에서 orphan 비율 모니터.
 *
 * 사용:
 *   try {
 *     const result = await withTimeout(impl(), 5000, 'POST /api/compare');
 *   } catch (e) {
 *     if (e instanceof TimeoutError) return 504;
 *     throw e;
 *   }
 */

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
