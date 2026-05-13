/**
 * appendRefParam — provider.website URL 에 ref 쿼리 파라미터를 안전하게 붙이는 헬퍼.
 *
 * 규칙:
 *   - URL 에 이미 `?` 가 있으면 `&ref=<value>` 로 추가.
 *   - URL 에 `?` 가 없으면 `?ref=<value>` 로 추가.
 *   - ref 값은 encodeURIComponent 처리 (패턴: 'slim-r-<shortId>', URL-safe nanoid 12자).
 *
 * 호출자 (route handler) 가 provider.website 유효성 검증 후 이 함수를 부른다.
 * 이 함수 자체는 URL 유효성을 재검증하지 않음 — 호출자 책임.
 */
export function appendRefParam(baseUrl: string, refValue: string): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}ref=${encodeURIComponent(refValue)}`;
}
