/**
 * 다크패턴 0 자가 검증 테스트 (PLAN 4.1.d / 4.5.c).
 *
 * page.tsx 소스를 fs.readFile 로 읽어 정규식 스캔.
 * 목적: 향후 카피 수정 시 금지 토큰이 유입되면 즉시 FAIL.
 *
 * 검증 범위:
 *   A. Fake Urgency 금지 토큰 0건
 *   B. Confirmshaming 금지 토큰 0건 (4.5.c 후속 메일 섹션 포함)
 *   C. Pre-checked 입력 0건 (defaultChecked={false} 는 허용, ={true} 는 금지)
 *   D. 필수 5항목 문자열 존재 (EDPB Guidelines 05/2020 on consent)
 *   E. VI.99 한 줄 존재 (ADR-0026 §검토 5)
 *   F. §T1 금지 — cookies()/headers()/Set-Cookie 0건
 *   G. 4.5.c — 후속 메일 pre-checked 0 + Art. 13 카피 존재 (ADR-0028 §T4/T7)
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { describe, expect, it, beforeAll } from 'vitest';

// fileURLToPath 사용 — Windows '/C:/...' pathname 을 올바른 드라이브 경로로 변환
const PAGE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'page.tsx',
);

let src: string;

beforeAll(async () => {
  src = await readFile(PAGE_PATH, 'utf-8');
});

// ─────────────────────────────────────────────
// A. Fake Urgency 금지 토큰
// ─────────────────────────────────────────────
describe('A. Fake Urgency 금지 토큰 0건', () => {
  const FAKE_URGENCY_PATTERNS: Array<{ label: string; re: RegExp }> = [
    { label: '지금만', re: /지금만/i },
    { label: '오늘만', re: /오늘만/i },
    { label: 'X분 안에 (숫자+분+안에)', re: /\d+\s*분\s*안에/i },
    { label: '마감', re: /마감/i },
    { label: '곧 종료', re: /곧\s*종료/i },
    { label: '빨리', re: /빨리/i },
    { label: '서두르세요', re: /서두르세요/i },
    { label: 'Limited time', re: /limited\s+time/i },
    { label: 'Only N (Only + 숫자)', re: /only\s+\d+/i },
    { label: 'Hurry', re: /hurry/i },
  ];

  for (const { label, re } of FAKE_URGENCY_PATTERNS) {
    it(`"${label}" 금지 토큰 0건`, () => {
      const match = src.match(re);
      if (match) {
        // 어느 줄에서 발생했는지 노출
        const line = src.substring(0, src.search(re)).split('\n').length;
        expect.fail(
          `Fake Urgency 금지 토큰 발견: "${label}" (line ~${line})\n매치: "${match[0]}"`,
        );
      }
      expect(match).toBeNull();
    });
  }
});

// ─────────────────────────────────────────────
// B. Confirmshaming 금지 토큰
// ─────────────────────────────────────────────
describe('B. Confirmshaming 금지 토큰 0건', () => {
  const CONFIRMSHAMING_PATTERNS: Array<{ label: string; re: RegExp }> = [
    { label: '그냥 (단어 경계)', re: /\b그냥\b/ },
    { label: '원치 않아요', re: /원치\s*않아요/ },
    { label: '필요 없어요', re: /필요\s*없어요/ },
    { label: '포기 (단어 경계)', re: /\b포기\b/ },
  ];

  for (const { label, re } of CONFIRMSHAMING_PATTERNS) {
    it(`"${label}" 금지 토큰 0건`, () => {
      const match = src.match(re);
      if (match) {
        const line = src.substring(0, src.search(re)).split('\n').length;
        expect.fail(
          `Confirmshaming 금지 토큰 발견: "${label}" (line ~${line})\n매치: "${match[0]}"`,
        );
      }
      expect(match).toBeNull();
    });
  }
});

// ─────────────────────────────────────────────
// C. Pre-checked 입력 0건
// 주의: defaultChecked={false} 는 허용 (pre-checked 0 명시 강제).
//       defaultChecked={true} / checked={true} / checked="true" 만 금지.
// ─────────────────────────────────────────────
describe('C. Pre-checked 입력 0건', () => {
  it('defaultChecked={true} 없음 (false 는 허용)', () => {
    // defaultChecked={false} 는 pre-checked 0 명시 — 허용.
    // defaultChecked={true} 만 금지.
    expect(src).not.toMatch(/defaultChecked=\{true\}/);
  });

  it('checked={true} 없음', () => {
    expect(src).not.toMatch(/checked=\{true\}/);
  });

  it('checked="true" 없음', () => {
    expect(src).not.toMatch(/checked="true"/);
  });
});

// ─────────────────────────────────────────────
// D. 필수 5항목 문자열 존재 (EDPB Guidelines 05/2020)
// ─────────────────────────────────────────────
describe('D. 필수 5항목 문자열 존재', () => {
  it('항목 3-1: 리다이렉트 흐름 표시 — "Slim → 귀하의 브라우저"', () => {
    expect(src).toMatch(/Slim → 귀하의 브라우저/);
  });

  it('항목 3-2: 전송 데이터 없음 — "Slim이 공급사에 전송하는 데이터"', () => {
    expect(src).toMatch(/Slim이 공급사에 전송하는 데이터/);
  });

  it('항목 3-3: 공급사 자체 수집 고지 — "공급사가 자체적으로"', () => {
    expect(src).toMatch(/공급사가 자체적으로/);
  });

  it('항목 4: 동의 철회 방법 — "기록 없이 취소됩니다"', () => {
    expect(src).toMatch(/기록 없이 취소됩니다/);
  });

  it('항목 5: freely given — "거부해도 비교 결과는 그대로 유지됩니다"', () => {
    expect(src).toMatch(/거부해도 비교 결과는 그대로 유지됩니다/);
  });
});

// ─────────────────────────────────────────────
// E. VI.99 한 줄 존재 (ADR-0026 §검토 5)
// ─────────────────────────────────────────────
describe('E. VI.99 랭킹 명시 한 줄 존재', () => {
  it('"정렬 기준" 또는 "절약액 내림차순" 텍스트 포함', () => {
    expect(src).toMatch(/정렬 기준|절약액 내림차순/);
  });
});

// ─────────────────────────────────────────────
// F. §T1 금지 — 사용자 추적 API 없음
// ─────────────────────────────────────────────
describe('F. ADR-0026 §T1 — 사용자 추적 API 0건', () => {
  it('cookies() 호출 없음', () => {
    expect(src).not.toMatch(/cookies\(\)/);
  });

  it('headers().get 없음', () => {
    expect(src).not.toMatch(/headers\(\)\.get/);
  });

  it('Set-Cookie 없음', () => {
    expect(src).not.toMatch(/Set-Cookie/i);
  });
});

// ─────────────────────────────────────────────
// G. 4.5.c — 후속 메일 pre-checked 0 + Art. 13 카피 + Confirmshaming 0
//    ADR-0028 §T4 (Art. 13 정보 제공) + §T7 (다크패턴 0)
// ─────────────────────────────────────────────
describe('G. 4.5.c 후속 메일 — pre-checked 0 + Art. 13 카피 존재', () => {
  it('체크박스 defaultChecked={false} 명시 존재 (pre-checked 0 강제, ADR-0028 §T7)', () => {
    // page.tsx 에 defaultChecked={false} 가 명시되어야 한다.
    // 이 값이 없으면 브라우저가 이전 상태를 복원해 pre-checked 위험 발생.
    const match = src.match(/defaultChecked=\{false\}/);
    if (!match) {
      const line = src.split('\n').findIndex((l) => l.includes('type="checkbox"')) + 1;
      expect.fail(
        `defaultChecked={false} 미발견 — pre-checked 0 강제 위반 (ADR-0028 §T7), 체크박스 근처 line ~${line}`,
      );
    }
    expect(match).not.toBeNull();
  });

  it('Art. 13 — "7일 후" 문구 존재 (ADR-0028 §T4)', () => {
    expect(src).toMatch(/7일\s*후/);
  });

  it('Art. 13 — "익명화" 또는 "발송 직후 익명" 문구 존재 (ADR-0028 §T4)', () => {
    expect(src).toMatch(/익명화|발송\s*직후\s*익명/);
  });

  it('Art. 13 / Art. 7(3) — "unsubscribe" 또는 "해제" 문구 존재 (ADR-0028 §T4)', () => {
    expect(src).toMatch(/unsubscribe|해제/);
  });

  it('후속 메일 Confirmshaming 0 — "손해" / "후회" / "그냥 받지" 류 없음 (ADR-0028 §T7)', () => {
    const patterns: Array<{ label: string; re: RegExp }> = [
      { label: '손해', re: /손해/ },
      { label: '후회', re: /후회/ },
      { label: '그냥 받지', re: /그냥\s*받지/ },
      { label: '받지 않으면', re: /받지\s*않으면/ },
    ];
    for (const { label, re } of patterns) {
      const match = src.match(re);
      if (match) {
        const line = src.substring(0, src.search(re)).split('\n').length;
        expect.fail(
          `후속 메일 Confirmshaming 금지 토큰 발견: "${label}" (line ~${line})\n매치: "${match[0]}"`,
        );
      }
      expect(match).toBeNull();
    }
  });
});
