/**
 * translate.mjs — DeepL API 를 사용해 ko.json → nl/fr/en base 번역.
 *
 * ADR-0033 §A2.7 G2 + PLAN 4.5.j.2 Phase B.
 * Phase A: 골격만 — 실행은 Phase B (DEEPL_API_KEY 등록 후).
 *
 * 실행 방법:
 *   DEEPL_API_KEY=<your_key> node scripts/i18n/translate.mjs
 *
 * 동작:
 *   1. messages/ko.json 읽기 (정본 소스 — ADR-0033 §A2.7 G2-ii)
 *   2. DeepL ko→{nl,fr,en} 번역 (base 3 언어)
 *   3. messages/{nl,fr,en}.json 쓰기 (placeholder 값 교체)
 *   4. region delta(nl-BE/nl-NL/fr-BE/fr-LU)는 별도 수동 검토
 *
 * 주의사항 (ADR-0033 §A2.7 G2-iii Q2):
 *   - caveats.* 네임스페이스는 운영자 수동 검수 1회 필수 (가격 오역 = 사용자 손해).
 *   - legal.* 네임스페이스는 이 스크립트 생성 대상 아님 — 4.5.j.3 legal 에이전트.
 *   - 나머지 UI 텍스트는 DeepL raw 공개 + organic 피드백 사후 보정.
 *
 * DeepL ko 소스 지원 확인:
 *   ko(한국어) → nl/fr/en 직역 지원 (DeepL Supported Languages 2026-05 기준).
 *   미지원 시 자동 2-hop (ko→en→nl/fr) 로 fallback — 이 스크립트에서 처리 불요
 *   (DeepL API 가 내부적으로 처리).
 *
 * 왜 일회성 스크립트인가:
 *   번역 = 런타임 로직 아님. scripts/ 하위 = 빌드/배포 산출물 비포함.
 *   RESEND_API_KEY / KO_GATE_TOKEN 과 동일 패턴 — 운영자 발급 + 등록.
 */

// Phase B 실행 시 구현 — Phase A 는 골격만
console.log('translate.mjs — Phase B (DeepL 키 대기 중)');
console.log('');
console.log('실행 전 필요 사항:');
console.log('  1. DEEPL_API_KEY 환경변수 설정 (DeepL Free API, https://www.deepl.com/pro-api)');
console.log('  2. pnpm node scripts/i18n/measure-chars.mjs 로 분량 확인');
console.log('');
console.log('Phase A 완료 상태: 배선/구조/테스트 준비됨 — 번역 값만 대기.');

// TODO (Phase B): DeepL API 호출 구현
// import { readFileSync, writeFileSync } from 'node:fs';
// import { join, dirname } from 'node:path';
// import { fileURLToPath } from 'node:url';
//
// const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
// if (!DEEPL_API_KEY) {
//   console.error('DEEPL_API_KEY 미설정 — Phase B 전제 조건');
//   process.exit(1);
// }
//
// ... DeepL REST API 호출 → nl/fr/en base 파일 생성 ...
