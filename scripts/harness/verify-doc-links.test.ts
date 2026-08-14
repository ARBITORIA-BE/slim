/**
 * verify-doc-links 단위 테스트 — ADR-0044 Amendment 1 §A1.V1
 *
 * 픽스처 전략: 인-메모리 마크다운 문자열 (실 파일시스템 X).
 * 순수 함수(stripCodeFences / extractMdLinks / resolveTarget) 를 직접 임포트해서
 * 픽스처 입력 → 추출·해석 결과 검증.
 *
 * 회귀 재현: 2026-08-14 고아 ADR 사고 — PLAN.md 가 main 에 없는
 * docs/adr/0048-*.md 를 11건 [x] 격상 근거로 링크했으나 게이트가 잡지 못했다.
 *
 * 실행: pnpm test:run
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
  stripCodeFences,
  stripInlineCode,
  extractMdLinks,
  resolveTarget,
} from './verify-doc-links';

// why: resolve() 는 플랫폼 구분자를 쓴다 (Windows → 'C:\repo\...').
// 기대값도 같은 resolve 로 만들고 구분자만 통일해야 OS 무관하게 성립한다.
const norm = (p: string): string => p.split('\\').join('/');
const expectedPath = (cwd: string, rel: string): string => norm(resolve(cwd, rel));

// =============================================================================
// stripCodeFences — 코드블록 안의 링크는 실 링크가 아니다
// =============================================================================

describe('stripCodeFences', () => {
  it('펜스 코드블록 내부를 제거한다', () => {
    const md = [
      '본문 [진짜](a.md)',
      '```',
      '[예시](없는파일.md)',
      '```',
      '끝 [진짜2](b.md)',
    ].join('\n');

    const out = stripCodeFences(md);
    expect(out).toContain('[진짜](a.md)');
    expect(out).toContain('[진짜2](b.md)');
    expect(out).not.toContain('없는파일.md');
  });

  it('줄 수를 보존한다 (위반 라인 번호 정합)', () => {
    const md = ['a', '```', 'x', '```', 'b'].join('\n');
    expect(stripCodeFences(md).split('\n')).toHaveLength(5);
  });

  it('언어 태그가 붙은 펜스도 처리한다', () => {
    const md = ['```ts', '[x](없음.md)', '```'].join('\n');
    expect(stripCodeFences(md)).not.toContain('없음.md');
  });
});

// =============================================================================
// stripInlineCode — 링크 문법을 설명하는 문서가 스스로를 깨뜨리지 않게
// =============================================================================

describe('stripInlineCode', () => {
  it('백틱 인라인 코드 안의 링크 문법을 제거한다', () => {
    const md = '룰 (iv) — 마크다운 상대 링크 `[텍스트](경로.md)` 대상 파일 실재 검증';
    expect(extractMdLinks(stripInlineCode(md))).toHaveLength(0);
  });

  it('인라인 코드 밖의 진짜 링크는 남긴다', () => {
    const md = '`[예시](가짜.md)` 와 진짜 [ADR](docs/adr/0044-x.md)';
    const links = extractMdLinks(stripInlineCode(md));
    expect(links).toHaveLength(1);
    expect(links[0]?.target).toBe('docs/adr/0044-x.md');
  });

  it('길이를 보존한다 (위반 라인 번호 정합)', () => {
    const md = 'a `code` b';
    expect(stripInlineCode(md)).toHaveLength(md.length);
  });

  it('줄 수를 보존한다', () => {
    const md = ['a `x` b', 'c `y` d'].join('\n');
    expect(stripInlineCode(md).split('\n')).toHaveLength(2);
  });
});

// =============================================================================
// extractMdLinks — 상대 .md 링크만 골라낸다
// =============================================================================

describe('extractMdLinks', () => {
  it('상대 .md 링크를 추출한다', () => {
    const links = extractMdLinks('근거: [ADR-0048](docs/adr/0048-phase-6.md) 참조');
    expect(links).toHaveLength(1);
    expect(links[0]?.target).toBe('docs/adr/0048-phase-6.md');
  });

  it('앵커를 잘라내고 경로만 남긴다', () => {
    const links = extractMdLinks('[Amd 1](0051-organic.md#amendment-1-한글-앵커)');
    expect(links[0]?.target).toBe('0051-organic.md');
  });

  it('외부 URL 은 건너뛴다', () => {
    const md =
      '[web](https://example.com/a.md) [mail](mailto:a@b.com) [tel](tel:+321)';
    expect(extractMdLinks(md)).toHaveLength(0);
  });

  it('앵커 단독 링크는 건너뛴다', () => {
    expect(extractMdLinks('[위로](#section)')).toHaveLength(0);
  });

  it('.md 아닌 대상은 건너뛴다 (코드 파일 링크는 룰 (i) 소관)', () => {
    expect(extractMdLinks('[src](src/lib/legal.ts) [img](a.png)')).toHaveLength(0);
  });

  it('링크 타이틀이 붙어도 경로를 추출한다', () => {
    const links = extractMdLinks('[a](docs/a.md "제목")');
    expect(links[0]?.target).toBe('docs/a.md');
  });

  it('라인 번호를 정확히 매긴다', () => {
    const md = ['첫 줄', '둘째 줄', '[링크](x.md)'].join('\n');
    expect(extractMdLinks(md)[0]?.line).toBe(3);
  });

  it('한 줄에 여러 링크가 있어도 모두 추출한다', () => {
    const links = extractMdLinks('[a](a.md) 그리고 [b](b.md)');
    expect(links.map((l) => l.target)).toEqual(['a.md', 'b.md']);
  });
});

// =============================================================================
// resolveTarget — 문서 위치 기준 상대 해석
// =============================================================================

describe('resolveTarget', () => {
  const cwd = resolve('/repo');

  it('ADR 내부 상대 링크는 docs/adr 기준으로 푼다', () => {
    const r = resolveTarget(cwd, 'docs/adr/0043-telecom.md', '0007-schema.md');
    expect(norm(r)).toBe(expectedPath(cwd, 'docs/adr/0007-schema.md'));
  });

  it('루트 문서의 docs/ 링크는 저장소 루트 기준으로 푼다', () => {
    const r = resolveTarget(cwd, 'PLAN.md', 'docs/adr/0048-phase-6.md');
    expect(norm(r)).toBe(expectedPath(cwd, 'docs/adr/0048-phase-6.md'));
  });

  it('선행 슬래시 경로도 저장소 루트 기준으로 푼다 (파일시스템 루트 아님)', () => {
    const r = resolveTarget(cwd, 'docs/adr/0043-telecom.md', '/docs/a.md');
    expect(norm(r)).toBe(expectedPath(cwd, 'docs/a.md'));
  });

  it('상위 디렉토리 참조를 처리한다', () => {
    const r = resolveTarget(cwd, 'docs/adr/0043-telecom.md', '../m16-eval.md');
    expect(norm(r)).toBe(expectedPath(cwd, 'docs/m16-eval.md'));
  });
});

// =============================================================================
// 회귀 재현 — 2026-08-14 고아 ADR 사고
// =============================================================================

describe('회귀: 고아 ADR 링크 (2026-08-14)', () => {
  it('PLAN 본문의 ADR-0048 링크를 추출해 경로로 해석한다', () => {
    const plan =
      '- [x] **6.1** 어드민 대시보드 v1 — **격상 ([ADR-0048](docs/adr/0048-phase-6-bulk-promotion-option-c.md) §D6)**';

    const links = extractMdLinks(stripCodeFences(plan));
    expect(links).toHaveLength(1);

    const cwd = resolve('/repo');
    const resolved = resolveTarget(cwd, 'PLAN.md', links[0]?.target ?? '');
    expect(norm(resolved)).toBe(
      expectedPath(cwd, 'docs/adr/0048-phase-6-bulk-promotion-option-c.md'),
    );
  });

  it('같은 줄에 근거 ADR 2건이 링크돼도 둘 다 잡는다', () => {
    const changelog =
      '- 11건 격상 ([ADR-0048](docs/adr/0048-bulk.md) §D6 + [ADR-0049](docs/adr/0049-gdpr.md) 재정의)';
    expect(extractMdLinks(changelog)).toHaveLength(2);
  });
});
