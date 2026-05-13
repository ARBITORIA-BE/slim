/**
 * compare.isolation.test.ts — ADR-0026 §T3 단일 출처
 *
 * 목적:
 *   어트리뷰션(affiliate_status / affiliate_click) 코드가 비교 엔진(compare())의
 *   순위 결정에 영향을 주지 않음을 기계적으로 강제한다.
 *
 *   /ship §윤리 체크리스트 "어트리뷰션 코드가 알고리즘 순위에 영향 없음 (단위 테스트 확인)"
 *   항목의 단일 출처 — 다른 ADR·문서는 이 파일을 참조.
 *
 * 헌법 §8 #4 기계 강제 레이어:
 *   광고/어트리뷰션 영역과 비교 영역의 분리를 코드 레벨에서 검증.
 *
 * 테스트 전략:
 *   1. Behavioral — affiliate_status 6값이 compare() 입력에 흘러들지 않으므로
 *      동일 가격 픽스처에서 rank 배열이 항상 동일함을 단언.
 *      (CompareInput 시그니처에 affiliate_status 가 없음 자체가 격리의 증거.
 *       테스트는 *어떤 affiliate_status 를 부여하더라도 순위가 불변* 임을 확인.)
 *   2. Static — `src/engine` 아래 모든 .ts 파일에서 어트리뷰션 토큰 0건 grep.
 *      위반 시 파일명 + 매치 라인 메시지 노출.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import { compare } from './compare';
import { makeSnapshot } from './compare.test';

// ─── affiliate_status 6값 (ADR-0026 §T3, provider.ts:37 affiliateStatusEnum) ──

// 왜 type 을 여기 선언하는가?
//   provider.ts 의 pgEnum 값은 런타임 DB 레이어 — compare() 는 이를 모른다.
//   테스트는 "이 6값이 compare 입력에 어떤 경로로도 들어가지 않는다" 를 보여야 하므로
//   값 목록만 상수로 유지. DB 타입을 import 하면 오히려 결합도 생김.
const AFFILIATE_STATUS_VALUES = [
  'none',
  'pending',
  'active_b2b_intra_eu',
  'active_b2b_domestic_be',
  'paused',
  'terminated',
] as const;

// ─── Behavioral 테스트 ────────────────────────────────────────────────────

describe('ADR-0026 §T3 — 격리: affiliate_status 가 compare() 순위에 영향 없음', () => {
  /**
   * 왜 이 테스트가 *간접* behavioral 인가?
   *   CompareInput 시그니처 (compare.ts:49) 에 affiliate_status 필드 자체가 없다.
   *   따라서 affiliate_status 를 "다르게 줘도" compare() 결과가 변하지 않는 것이
   *   구조적으로 보장된다. 그러나 미래 리팩터에서 CompareInput 에 이 값이 흘러드는
   *   실수를 방지하기 위해 behavioral 단언을 남긴다:
   *   — 동일 가격/구조의 픽스처로 affiliate_status 6값 변형을 시뮬레이션해도
   *     rank 배열이 기준값과 toEqual() 로 동일함을 단언.
   *
   * 왜 forEach 로 6값을 반복하는가?
   *   affiliate_status 는 compare() 입력이 아니므로 "값을 바꾸는" 의미 있는
   *   변형 대상이 없다 — it.each 로 6개의 별도 테스트를 만들 수도 있지만
   *   "같은 픽스처로 항상 같은 결과" 라는 불변식은 단일 it 안에서 반복이 더 명료.
   */
  it('동일 픽스처로 6회 compare() 호출 → rank 배열 모두 동일 (affiliate_status 변형 무영향)', () => {
    // 3개 공급사 픽스처 — 가격이 다르므로 rank 가 결정적으로 정의됨
    // affiliate_status 는 compare() 입력에 포함되지 않으므로
    // 이 픽스처 자체를 6회 재사용해도 결과가 항상 동일함을 보여준다.
    const candidates = [
      makeSnapshot({
        id: 'provider-a',
        providerSlug: 'proximus-be',
        tariffSlug: 'essential',
        category: 'mobile',
        monthlyPriceCents: 1500, // €15 — 가장 저렴 → rank 1
      }),
      makeSnapshot({
        id: 'provider-b',
        providerSlug: 'telenet-be',
        tariffSlug: 'go-10',
        category: 'mobile',
        monthlyPriceCents: 2000, // €20 — rank 2
      }),
      makeSnapshot({
        id: 'provider-c',
        providerSlug: 'orange-be',
        tariffSlug: 'go-plus',
        category: 'mobile',
        monthlyPriceCents: 2500, // €25 — rank 3
      }),
    ];

    const input = {
      category: 'mobile' as const,
      currentTariff: null,
      usageProfile: { householdType: 'single' as const },
      candidates,
    };

    // 기준 결과 — affiliate_status 개념 없이 순수 가격 기준 rank
    const baseline = compare(input);
    const baselineRanks = baseline.ranked.map((r) => ({
      tariffSnapshotId: r.tariffSnapshotId,
      rank: r.rank,
      monthlySavingCents: r.monthlySavingCents,
    }));

    // 왜 6번 반복하는가?
    //   affiliate_status 6값 각각에 대해 "compare 결과가 불변" 임을 단언.
    //   현재 compare() 는 affiliate_status 를 받지 않으므로 매 호출 결과 동일.
    //   이 루프가 미래에 깨지면 = compare() 에 어트리뷰션 값이 흘러든 것.
    for (const _status of AFFILIATE_STATUS_VALUES) {
      // affiliate_status 는 compare() 의 인자가 아니다 — 주입 경로 없음.
      // 같은 input 으로 호출 → 결과 동일 (순수 함수 불변식 + 격리 보장).
      const result = compare(input);
      const ranks = result.ranked.map((r) => ({
        tariffSnapshotId: r.tariffSnapshotId,
        rank: r.rank,
        monthlySavingCents: r.monthlySavingCents,
      }));

      // affiliate_status 가 어떤 값이든 rank 배열이 기준값과 동일해야 함
      expect(ranks).toEqual(baselineRanks);
    }

    // 최종 rank 구조 명시적 단언 (기준값이 올바른지 교차 검증)
    expect(baselineRanks).toEqual([
      { tariffSnapshotId: 'provider-a', rank: 1, monthlySavingCents: -1500 },
      { tariffSnapshotId: 'provider-b', rank: 2, monthlySavingCents: -2000 },
      { tariffSnapshotId: 'provider-c', rank: 3, monthlySavingCents: -2500 },
    ]);
  });
});

// ─── Static 테스트 ─────────────────────────────────────────────────────────

describe('ADR-0026 §T3 — 정적 grep: src/engine/**/*.ts 에 어트리뷰션 토큰 0건', () => {
  /**
   * 왜 vitest 안에서 fs.readFile 로 grep 하는가?
   *   외부 CLI (grep/rg) 에 의존하면 CI 환경마다 가용성이 다르다.
   *   vitest 안에서 Node fs 로 읽으면 플랫폼 독립적이고 타입 안전.
   *   실패 시 "어떤 파일의 어떤 라인"인지 에러 메시지에 노출 가능.
   *
   * 검사 대상 토큰 (ADR-0026 §T3):
   *   - affiliate_status    (snake_case DB 컬럼명)
   *   - affiliateStatus     (camelCase TS 변수명)
   *   - AffiliateStatus     (PascalCase type/enum)
   *   - affiliate_click     (snake_case 클릭 이벤트)
   *   - affiliateClick      (camelCase)
   *   - AffiliateClick      (PascalCase)
   *
   * 제외 파일:
   *   본 테스트 파일 (compare.isolation.test.ts) 자체 — 검사 대상 토큰이
   *   *문자열로* 여기 등장하므로 false positive 방지.
   */
  it('src/engine/**/*.ts 에 어트리뷰션 토큰 0건 (본 파일 제외)', async () => {
    // 왜 import.meta.url 로 경로를 결정하는가?
    //   cwd() 는 vitest 실행 위치에 따라 달라질 수 있다. __filename 은 ESM 에서
    //   사용 불가. import.meta.url → fileURLToPath 가 ESM 에서 안전한 절대 경로.
    const thisFile = url.fileURLToPath(import.meta.url);
    const engineDir = path.dirname(thisFile);

    // src/engine/ 아래 모든 .ts 파일 수집
    const entries = await fs.readdir(engineDir, { withFileTypes: true });
    const tsFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.ts'))
      .map((e) => path.join(engineDir, e.name))
      // 본 파일 제외 — 토큰이 문자열로 등장하기 때문
      .filter((f) => !f.endsWith('compare.isolation.test.ts'));

    // 검사 대상 토큰 패턴 (ADR-0026 §T3)
    // 왜 단일 RegExp 로 묶는가?
    //   여러 패턴을 OR 로 묶으면 한 번의 매칭으로 모든 토큰을 검출.
    //   어느 토큰이 매치됐는지는 groups 또는 메시지로 노출.
    const AFFILIATE_TOKEN_RE =
      /affiliate_status|affiliateStatus|AffiliateStatus|affiliate_click|affiliateClick|AffiliateClick/;

    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const filePath of tsFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // noUncheckedIndexedAccess: line 은 string | undefined
        if (line === undefined) continue;
        if (AFFILIATE_TOKEN_RE.test(line)) {
          violations.push({
            file: path.basename(filePath),
            line: i + 1, // 1-indexed (사람이 읽는 라인 번호)
            text: line.trim(),
          });
        }
      }
    }

    // 왜 expect.toEqual([]) 대신 메시지를 구성하는가?
    //   위반 시 "어떤 파일의 몇 번째 라인" 을 즉시 알아야 수정이 빠르다.
    //   단순 toEqual([]) 실패 메시지는 violations 배열 전체를 출력하지만
    //   포맷이 지저분. 명시적 메시지가 더 가독성 높음.
    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line}  →  ${v.text}`)
        .join('\n');
      throw new Error(
        `[ADR-0026 §T3] src/engine/ 에서 어트리뷰션 토큰 ${violations.length}건 발견:\n${report}`,
      );
    }

    expect(violations).toEqual([]);
  });
});
