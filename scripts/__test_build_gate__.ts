/**
 * 의도적 typecheck 에러 — D.1 DoD #3 검증용 (음성 PR).
 * docs/build-gate-negative-test.md 참조.
 *
 * 본 파일은 PR close 후 즉시 삭제. main 브랜치에 절대 머지하지 않는다.
 *
 * 검증 기대 결과:
 * - Vercel preview build = ✅ 통과 (next build는 scripts/ 제외)
 * - GitHub Actions ci.yml typecheck = ❌ 실패 (전체 scripts/ 포함)
 * - PR merge 차단 (D.1.c main 보호 룰)
 */

const x: number = 'string'; // intentional type error for D.1 DoD #3

export {};

// suppress unused var warning by referencing
console.log(x);
