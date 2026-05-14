/**
 * 길이 동일 + XOR 누적으로 짧은 prefix 일치 시에도 동일 시간을 사용한다.
 * Node 의 `crypto.timingSafeEqual` 은 edge runtime (middleware) 에서 호출 불가능.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
