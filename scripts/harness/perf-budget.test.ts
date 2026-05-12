/**
 * perf-budget.ts 단위 테스트 — PLAN 3.5.1.a + 3.5.1.b + Amendment 1 (per-route 2-tier)
 *
 * 3.5.1.a: 측정 로직은 Playwright + Lighthouse 런타임 의존이라 단위 테스트 범위 밖.
 *          임계값 참고 상수와 메트릭 추출 규칙을 순수 함수로 분리해 검증한다.
 *
 * 3.5.1.b: evaluateMetric / computeExitCode 순수 함수를 perf-budget.ts 에서 직접 import.
 *          복사본 X — 단일 진실 원천(single source of truth). 상수 변경 시 테스트도 자동 반영.
 *
 * Amendment 1: ceilToTen / routeTier / evaluateJsBudget / JS_BUDGET / isSeoExempt 추가 테스트.
 */

import { describe, expect, it } from 'vitest';
import {
  HARD_LCP_MS,
  HARD_TBT_MS,
  JS_BUDGET,
  SOFT_A11Y,
  SOFT_PERF,
  ceilToTen,
  computeExitCode,
  evaluateJsBudget,
  evaluateMetric,
  isSeoExempt,
  routeTier,
  type MetricEvaluation,
} from './perf-budget';

// ─── 3.5.1.a: 메트릭 추출 헬퍼 (perf-budget.ts 내부 로직과 동형, 독립 검증) ─

// Lighthouse numericValue → ms 반올림 (perf-budget.ts measurePage 내부 동일 로직)
function toRoundedMs(v: number | undefined | null): number | null {
  return typeof v === 'number' ? Math.round(v) : null;
}

// Lighthouse category score 0~1 → 0~100 (perf-budget.ts measurePage 내부 동일 로직)
function toScore(v: number | null | undefined): number | null {
  return typeof v === 'number' ? Math.round(v * 100) : null;
}

// ─── 3.5.1.a 기존 테스트 (16케이스) ─────────────────────────────────────────

describe('LCP 임계값 판정 (hard, 헌법 P2)', () => {
  it('2500ms 이하는 통과', () => {
    // isLcpPass 를 직접 정의하지 않고 evaluateMetric 으로 통과 판정
    expect(evaluateMetric('/', 'lcp', 2500).verdict).toBe('pass');
    expect(evaluateMetric('/', 'lcp', 1200).verdict).toBe('pass');
    expect(evaluateMetric('/', 'lcp', 0).verdict).toBe('pass');
  });

  it('2501ms 이상은 실패', () => {
    expect(evaluateMetric('/', 'lcp', 2501).verdict).toBe('hard-fail');
    expect(evaluateMetric('/', 'lcp', 5000).verdict).toBe('hard-fail');
  });
});

describe('TBT 임계값 판정 (hard, FID lab proxy — ADR-0023 T4)', () => {
  it('200ms 이하는 통과', () => {
    expect(evaluateMetric('/', 'tbt', 200).verdict).toBe('pass');
    expect(evaluateMetric('/', 'tbt', 0).verdict).toBe('pass');
    expect(evaluateMetric('/', 'tbt', 150).verdict).toBe('pass');
  });

  it('201ms 이상은 실패', () => {
    expect(evaluateMetric('/', 'tbt', 201).verdict).toBe('hard-fail');
    expect(evaluateMetric('/', 'tbt', 500).verdict).toBe('hard-fail');
  });
});

describe('Perf 점수 판정 (soft, PLAN 페이즈 3 검증 라인)', () => {
  it('90 이상은 통과', () => {
    expect(evaluateMetric('/', 'perf', 90).verdict).toBe('pass');
    expect(evaluateMetric('/', 'perf', 100).verdict).toBe('pass');
  });

  it('89 이하는 soft 경고 대상', () => {
    expect(evaluateMetric('/', 'perf', 89).verdict).toBe('soft-fail');
    expect(evaluateMetric('/', 'perf', 0).verdict).toBe('soft-fail');
  });
});

describe('A11y 점수 판정 (soft)', () => {
  it('95 이상은 통과', () => {
    expect(evaluateMetric('/', 'a11y', 95).verdict).toBe('pass');
    expect(evaluateMetric('/', 'a11y', 100).verdict).toBe('pass');
  });

  it('94 이하는 soft 경고 대상', () => {
    expect(evaluateMetric('/', 'a11y', 94).verdict).toBe('soft-fail');
  });
});

describe('메트릭 ms 반올림 (toRoundedMs)', () => {
  it('정수 입력은 그대로', () => {
    expect(toRoundedMs(1234)).toBe(1234);
  });

  it('소수점은 반올림', () => {
    expect(toRoundedMs(1234.7)).toBe(1235);
    expect(toRoundedMs(999.4)).toBe(999);
  });

  it('null/undefined 는 null 반환', () => {
    expect(toRoundedMs(null)).toBe(null);
    expect(toRoundedMs(undefined)).toBe(null);
  });
});

describe('Lighthouse 점수 0~1 → 0~100 변환 (toScore)', () => {
  it('0.9 → 90', () => {
    expect(toScore(0.9)).toBe(90);
  });

  it('0.953 → 95 (반올림)', () => {
    expect(toScore(0.953)).toBe(95);
  });

  it('null/undefined → null', () => {
    expect(toScore(null)).toBe(null);
    expect(toScore(undefined)).toBe(null);
  });

  it('1.0 → 100', () => {
    expect(toScore(1.0)).toBe(100);
  });

  it('0 → 0', () => {
    expect(toScore(0)).toBe(0);
  });
});

// ─── 3.5.1.b 신규 테스트 ─────────────────────────────────────────────────────

describe('evaluateMetric — 경계값 정밀 테스트 (ADR-0023 T4)', () => {
  // LCP: ≤ 이므로 경계(2500)는 pass
  it('LCP 2499ms → pass', () => {
    const ev: MetricEvaluation = evaluateMetric('/compare', 'lcp', 2499);
    expect(ev.verdict).toBe('pass');
  });

  it('LCP 2500ms → pass (경계 ≤ 포함)', () => {
    // 헌법 P2 "LCP ≤ 2.5s" — 2500ms 자체는 통과 (이하)
    const ev = evaluateMetric('/compare', 'lcp', 2500);
    expect(ev.verdict).toBe('pass');
  });

  it('LCP 2501ms → hard-fail', () => {
    const ev = evaluateMetric('/compare', 'lcp', 2501);
    expect(ev.verdict).toBe('hard-fail');
    // message 에 라우트와 실제값/임계값 포함
    expect(ev.message).toContain('/compare');
    expect(ev.message).toContain('2501ms');
    expect(ev.message).toContain('2500ms');
  });

  // TBT: ≤ 경계
  it('TBT 200ms → pass (경계 ≤ 포함)', () => {
    const ev = evaluateMetric('/r/abc', 'tbt', 200);
    expect(ev.verdict).toBe('pass');
  });

  it('TBT 201ms → hard-fail', () => {
    const ev = evaluateMetric('/r/abc', 'tbt', 201);
    expect(ev.verdict).toBe('hard-fail');
    expect(ev.message).toContain('201ms');
  });

  // Perf: ≥ 경계
  it('Perf 90 → pass (경계 ≥ 포함)', () => {
    expect(evaluateMetric('/', 'perf', 90).verdict).toBe('pass');
  });

  it('Perf 89 → soft-fail', () => {
    const ev = evaluateMetric('/', 'perf', 89);
    expect(ev.verdict).toBe('soft-fail');
    expect(ev.message).toContain('89');
  });

  // A11y: ≥ 경계
  it('A11y 95 → pass (경계 ≥ 포함)', () => {
    expect(evaluateMetric('/', 'a11y', 95).verdict).toBe('pass');
  });

  it('A11y 94 → soft-fail', () => {
    const ev = evaluateMetric('/', 'a11y', 94);
    expect(ev.verdict).toBe('soft-fail');
    expect(ev.message).toContain('94');
  });

  // Amendment 1: first-load JS 는 이제 tier 기반 판정 (기존 'info 항상' 동작 변경됨)
  it('first-load JS — 50KB (light) → pass', () => {
    // 50KB ≤ 120KB advisory → pass
    expect(evaluateMetric('/', 'js', 50).verdict).toBe('pass');
  });

  it('first-load JS — 200KB (light) → hard-fail (140KB hard 초과)', () => {
    // Amendment 1 이전엔 항상 info 였지만, 이제 tier 기반 판정
    expect(evaluateMetric('/', 'js', 200).verdict).toBe('hard-fail');
  });

  it('first-load JS — null → info (dev 빌드 / .next 부재, 판정 스킵)', () => {
    // null 은 여전히 info (evaluateMetric 상단 null 가드)
    expect(evaluateMetric('/', 'js', null).verdict).toBe('info');
  });

  // null 값 처리
  it('null 값은 항상 info (측정값 없음)', () => {
    expect(evaluateMetric('/', 'lcp', null).verdict).toBe('info');
    expect(evaluateMetric('/', 'tbt', null).verdict).toBe('info');
    expect(evaluateMetric('/', 'perf', null).verdict).toBe('info');
    expect(evaluateMetric('/', 'a11y', null).verdict).toBe('info');
  });
});

describe('computeExitCode — 여러 페이지 결과 → exit code 계산', () => {
  // helper: 최소 PageMetrics 생성
  const okMetrics = (route: string) => ({
    route,
    lcpMs: 1200,
    tbtMs: 100,
    fcpMs: 800,
    perfScore: 95,
    a11yScore: 97,
    bpScore: 100,
    seoScore: 100,
    firstLoadKb: 80,
  });

  it('모두 통과 → 0', () => {
    const rows = [
      { metrics: okMetrics('/') },
      { metrics: okMetrics('/compare') },
    ];
    expect(computeExitCode(rows)).toBe(0);
  });

  it('hard-fail(LCP) 1건이라도 있으면 → 1', () => {
    const rows = [
      { metrics: okMetrics('/') },
      {
        metrics: {
          ...okMetrics('/compare'),
          lcpMs: 3000, // 2500ms 초과 → hard-fail
        },
      },
    ];
    expect(computeExitCode(rows)).toBe(1);
  });

  it('hard-fail(TBT) 1건이라도 있으면 → 1', () => {
    const rows = [
      {
        metrics: {
          ...okMetrics('/'),
          tbtMs: 250, // 200ms 초과 → hard-fail
        },
      },
    ];
    expect(computeExitCode(rows)).toBe(1);
  });

  it('soft-fail(Perf/A11y)만 있으면 → 0 (exit 0, 경고만)', () => {
    // soft 가 exit 0 인 이유: ADR-0002 flaky→noise 교훈 — 환경 변동 민감 메트릭을
    // hard 게이트로 두면 CI noise 화 → 보호 대상이 오히려 무방비.
    const rows = [
      {
        metrics: {
          ...okMetrics('/'),
          perfScore: 85,  // soft-fail
          a11yScore: 90,  // soft-fail
        },
      },
    ];
    expect(computeExitCode(rows)).toBe(0);
  });

  it('skip 된 페이지는 무시 (게이트 실패 아님)', () => {
    const rows = [
      { metrics: okMetrics('/') },
      { metrics: null, skipped: true as true }, // 4번 페이지 seed 부재
    ];
    expect(computeExitCode(rows)).toBe(0);
  });

  it('측정 실패(measureFailed=true) → 1', () => {
    const rows = [
      { metrics: okMetrics('/') },
      { metrics: null, measureFailed: true as true }, // Lighthouse 던짐
    ];
    expect(computeExitCode(rows)).toBe(1);
  });

  it('측정 실패 + hard 위반 혼재 → 1 (둘 다 exit 1)', () => {
    const rows = [
      { metrics: null, measureFailed: true as true },
      { metrics: { ...okMetrics('/compare'), lcpMs: 5000 } },
    ];
    expect(computeExitCode(rows)).toBe(1);
  });
});

describe('임계값 상수 노출 확인 (export 검증)', () => {
  it('HARD_LCP_MS = 2500', () => {
    expect(HARD_LCP_MS).toBe(2500);
  });

  it('HARD_TBT_MS = 200', () => {
    expect(HARD_TBT_MS).toBe(200);
  });

  it('SOFT_PERF = 90', () => {
    expect(SOFT_PERF).toBe(90);
  });

  it('SOFT_A11Y = 95', () => {
    expect(SOFT_A11Y).toBe(95);
  });
});

// ─── Amendment 1: 신규 테스트 ────────────────────────────────────────────────

describe('ceilToTen — 10KB 단위 올림 (Amendment 1 라운딩 규칙)', () => {
  // 라운딩 규칙: ceil 인 이유 = 노이즈 ±10KB 흡수 목적, 반올림 금지
  it('112.3 → 120 (light advisory 계산 근거)', () => {
    expect(ceilToTen(112.3)).toBe(120);
  });

  it('120.0 → 120 (경계 — 이미 10의 배수면 그대로)', () => {
    // 이미 10의 배수면 올리지 않는다 (Math.ceil(120/10)*10 = 120)
    expect(ceilToTen(120.0)).toBe(120);
  });

  it('120.1 → 130 (경계 초과 시 올림)', () => {
    expect(ceilToTen(120.1)).toBe(130);
  });

  it('0 → 0', () => {
    expect(ceilToTen(0)).toBe(0);
  });

  it('132.7 → 140 (light hard 계산 근거)', () => {
    expect(ceilToTen(132.7)).toBe(140);
  });

  it('169.6 → 170 (form advisory 계산 근거)', () => {
    expect(ceilToTen(169.6)).toBe(170);
  });

  it('193.8 → 200 (form hard 계산 근거)', () => {
    expect(ceilToTen(193.8)).toBe(200);
  });
});

describe('routeTier — 라우트 → JS tier 매핑 (Amendment 1)', () => {
  // form 라우트: /compare/[category]/5개 폼 경로
  it('/compare/mobile/postal → form', () => {
    expect(routeTier('/compare/mobile/postal')).toBe('form');
  });

  it('/compare/energy/household → form', () => {
    expect(routeTier('/compare/energy/household')).toBe('form');
  });

  it('/compare/internet/current-provider → form', () => {
    expect(routeTier('/compare/internet/current-provider')).toBe('form');
  });

  it('/compare/mobile/bill → form', () => {
    expect(routeTier('/compare/mobile/bill')).toBe('form');
  });

  it('/compare/mobile/preview → form', () => {
    expect(routeTier('/compare/mobile/preview')).toBe('form');
  });

  // light 라우트: 그 외 전부
  it('/ → light', () => {
    expect(routeTier('/')).toBe('light');
  });

  it('/compare → light', () => {
    expect(routeTier('/compare')).toBe('light');
  });

  it('/r/BxsnzNkAnvcp → light', () => {
    expect(routeTier('/r/BxsnzNkAnvcp')).toBe('light');
  });

  it('알 수 없는 경로 → light (기본값)', () => {
    // 기본값이 light 인 이유: 미래 라우트 누락 시 더 엄격한 light 기준으로 감지
    expect(routeTier('/unknown/route')).toBe('light');
  });
});

describe('evaluateJsBudget — first-load JS tier 기반 판정 (Amendment 1)', () => {
  // light tier: advisory=120, hard=140
  it('light tier — 119KB → pass', () => {
    expect(evaluateJsBudget('/', 119).verdict).toBe('pass');
  });

  it('light tier — 120KB → pass (경계 ≤ advisory)', () => {
    expect(evaluateJsBudget('/', 120).verdict).toBe('pass');
  });

  it('light tier — 121KB → soft-fail (advisory 초과)', () => {
    const ev = evaluateJsBudget('/', 121);
    expect(ev.verdict).toBe('soft-fail');
    expect(ev.message).toContain('light');
  });

  it('light tier — 140KB → soft-fail (경계 ≤ hard, hard 초과 아님)', () => {
    expect(evaluateJsBudget('/', 140).verdict).toBe('soft-fail');
  });

  it('light tier — 141KB → hard-fail (hard 초과)', () => {
    const ev = evaluateJsBudget('/', 141);
    expect(ev.verdict).toBe('hard-fail');
    expect(ev.message).toContain('light');
    expect(ev.message).toContain('141KB');
  });

  // form tier: advisory=170, hard=200
  it('form tier — 170KB → pass (경계 ≤ advisory)', () => {
    expect(evaluateJsBudget('/compare/mobile/postal', 170).verdict).toBe('pass');
  });

  it('form tier — 171KB → soft-fail', () => {
    const ev = evaluateJsBudget('/compare/mobile/postal', 171);
    expect(ev.verdict).toBe('soft-fail');
    expect(ev.message).toContain('form');
  });

  it('form tier — 200KB → soft-fail (경계 ≤ hard)', () => {
    expect(evaluateJsBudget('/compare/energy/household', 200).verdict).toBe('soft-fail');
  });

  it('form tier — 201KB → hard-fail', () => {
    const ev = evaluateJsBudget('/compare/energy/household', 201);
    expect(ev.verdict).toBe('hard-fail');
    expect(ev.message).toContain('form');
  });

  it('null (dev 빌드 / .next 부재) → info, 판정 스킵', () => {
    // .next/ 없으면 computeFirstLoadJs 가 null 반환 → 게이트 실패 아님
    const ev = evaluateJsBudget('/', null);
    expect(ev.verdict).toBe('info');
  });
});

describe('JS_BUDGET 상수 값 검증 — Amendment 표 (120/140/170/200) 회귀 잠금', () => {
  it('light advisory = 120', () => {
    expect(JS_BUDGET.light.advisory).toBe(120);
  });

  it('light hard = 140', () => {
    expect(JS_BUDGET.light.hard).toBe(140);
  });

  it('form advisory = 170', () => {
    expect(JS_BUDGET.form.advisory).toBe(170);
  });

  it('form hard = 200', () => {
    expect(JS_BUDGET.form.hard).toBe(200);
  });
});

describe('isSeoExempt — SEO 게이트 제외 라우트 (ADR-0021 §T9 noindex)', () => {
  it('/r/BxsnzNkAnvcp → true (실 shortId — noindex 의도)', () => {
    // /r/[shortId] 는 noindex 이므로 Lighthouse SEO 점수 낮음이 정상
    expect(isSeoExempt('/r/BxsnzNkAnvcp')).toBe(true);
  });

  it('/r/[shortId] (템플릿 키) → true', () => {
    expect(isSeoExempt('/r/[shortId]')).toBe(true);
  });

  it('/ → false (SEO 게이트 대상)', () => {
    expect(isSeoExempt('/')).toBe(false);
  });

  it('/compare → false', () => {
    expect(isSeoExempt('/compare')).toBe(false);
  });

  it('/compare/mobile/postal → false', () => {
    expect(isSeoExempt('/compare/mobile/postal')).toBe(false);
  });

  // SEO 점수 63 이어도 /r/[shortId] 는 판정 제외
  it('/r/[shortId] SEO 점수 63 → evaluateMetric 이 아닌 isSeoExempt 로 제외 확인', () => {
    // 이 라우트는 SEO 판정 자체를 건너뛴다 (main loop 에서 isSeoExempt 확인)
    expect(isSeoExempt('/r/abc')).toBe(true);
  });
});

describe('computeExitCode — first-load JS hard-fail 포함 (Amendment 1)', () => {
  // helper: 최소 PageMetrics 생성 (okMetrics 와 동형이나 독립 선언)
  const baseMetrics = (route: string) => ({
    route,
    lcpMs: 1200,
    tbtMs: 100,
    fcpMs: 800,
    perfScore: 95,
    a11yScore: 97,
    bpScore: 100,
    seoScore: 100,
    firstLoadKb: 80, // light tier 80KB — pass
  });

  it('first-load JS hard-fail 1건 → exit 1', () => {
    const rows = [
      { metrics: baseMetrics('/') },
      {
        metrics: {
          ...baseMetrics('/compare'),
          firstLoadKb: 141, // light tier hard=140 초과 → hard-fail
        },
      },
    ];
    expect(computeExitCode(rows)).toBe(1);
  });

  it('first-load JS soft-fail 만 → exit 0 (경고, 차단 X)', () => {
    // advisory(120) 초과 but hard(140) 이하 → soft-fail → exit 0
    const rows = [
      {
        metrics: {
          ...baseMetrics('/'),
          firstLoadKb: 125, // 120 < 125 ≤ 140 → soft-fail
        },
      },
    ];
    expect(computeExitCode(rows)).toBe(0);
  });

  it('first-load JS null (dev 빌드) → 판정 무시, exit 0', () => {
    // null 은 판정 스킵 — 게이트 실패 아님
    const rows = [
      {
        metrics: {
          ...baseMetrics('/'),
          firstLoadKb: null,
        },
      },
    ];
    expect(computeExitCode(rows)).toBe(0);
  });

  it('form tier hard-fail: 201KB → exit 1', () => {
    const rows = [
      {
        metrics: {
          ...baseMetrics('/compare/mobile/postal'),
          firstLoadKb: 201, // form hard=200 초과 → hard-fail
        },
      },
    ];
    expect(computeExitCode(rows)).toBe(1);
  });

  it('form tier soft-fail: 171KB → exit 0', () => {
    const rows = [
      {
        metrics: {
          ...baseMetrics('/compare/mobile/postal'),
          firstLoadKb: 171, // form advisory=170 초과 but hard=200 이하 → soft-fail
        },
      },
    ];
    expect(computeExitCode(rows)).toBe(0);
  });
});
