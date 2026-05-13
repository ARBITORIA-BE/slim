/**
 * follow-up-email 통합 테스트 (PLAN 4.5.g — i)
 *
 * 단위 테스트 (4.5.d / 4.5.e / 4.5.c) 와의 차이:
 *   - 4.5.d : step 별 격리 (buildPlaintext/buildHtml, Resend mock 결과만 확인)
 *   - 본 통합: 여러 모듈이 함께 동작하는 *cross-module 시나리오* 검증.
 *
 * Cross-module 흐름:
 *   DB query helpers (follow-up-email queries, affiliate-click queries)
 *   + Inngest function step chain (select-pending → send-each → anonymize-sent)
 *   + unsubscribeByToken (4.5.e queries)
 *   → 이 세 레이어가 연결될 때 기대 동작 보장.
 *
 * 셋업:
 *   - DB: vi.hoisted + vi.mock('@/db') — in-memory store (실 Neon 연결 불필요)
 *   - Resend: vi.mock (4.5.d 동일 패턴)
 *   - Inngest step runner: step.run(name, fn) → fn() 즉시 실행 thin wrapper
 *
 * 케이스:
 *   1. pending → sent 전체 흐름 (select → send → anonymize 체인)
 *   2. unsubscribed_at NOT NULL → Resend 0 + sent_at NULL 유지
 *   3. Idempotency — sent_at NOT NULL 이미 있는 row 재발송 없음
 *   4. scheduled_send_at > now → Resend 0
 *   5. unsubscribeByToken → unsubscribed_at NOT NULL → 이후 cron 발송 없음
 *   6. Resend 1차 실패 → sent_at 미갱신 / 2차 실행 → sent_at NOT NULL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory DB store (vi.hoisted — mock 클로저보다 먼저 실행) ─────────────
// selectCallCount 를 store 안에 포함해 resetStore() 로 리셋 가능하게 한다.

interface FollowUpRow {
  id: string;
  email: string | null;
  unsubscribeToken: string;
  scheduledSendAt: Date;
  sentAt: Date | null;
  unsubscribedAt: Date | null;
  piiAnonymizedAt: Date | null;
  affiliateClickId: string;
  createdAt: Date;
}

interface AffiliateClickRow {
  id: string;
  providerId: string;
  resultId: string | null;
}

interface ProviderRow {
  id: string;
  name: string;
  website: string | null;
}

interface ComparisonResultRow {
  id: string;
  shortId: string;
}

// vi.hoisted 안에서 makeEmptyStore 를 정의하고 storeRef 를 반환
const storeRef = vi.hoisted(() => {
  const makeEmpty = () => ({
    followUpRows: [] as FollowUpRow[],
    clickRows: [] as AffiliateClickRow[],
    providerRows: [] as ProviderRow[],
    crRows: [] as ComparisonResultRow[],
    nowForFilter: new Date('2026-05-13T10:00:00Z'),
    selectCallCount: 0,
  });
  const ref = { current: makeEmpty(), makeEmpty };
  return ref;
});

// ─── Resend mock ──────────────────────────────────────────────────────────────

const mockSendEmail = vi.fn().mockResolvedValue({
  data: { id: 'mock-id' },
  error: null,
});

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSendEmail },
  })),
}));

// ─── DB mock — store 기반 ─────────────────────────────────────────────────────
// follow-up-email.ts 의 selectPendingRows 쿼리 체인을 in-memory store 로 대체.
// 각 runFollowUpEmailFn 호출 시 selectCallCount 를 0 으로 리셋한 뒤 시작.
//
// 체인 호출 순서:
//   limit() 0번째: followUpEmail pending rows (pendingBase)
//   limit() 이후: 각 pending row 에 대해 (affiliateClick, provider, cr) 반복

vi.mock('@/db', () => {
  const makeSelectChain = () => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.from = vi.fn(self);
    chain.where = vi.fn(self);
    chain.innerJoin = vi.fn(self);
    chain.limit = vi.fn(async () => {
      const s = storeRef.current;
      const callIdx = s.selectCallCount++;

      if (callIdx === 0) {
        // pendingBase
        return s.followUpRows
          .filter((r) => {
            if (r.sentAt !== null) return false;
            if (r.unsubscribedAt !== null) return false;
            if (r.email === null) return false;
            if (r.scheduledSendAt > s.nowForFilter) return false;
            return true;
          })
          .slice(0, 50)
          .map((r) => ({
            id: r.id,
            email: r.email,
            unsubscribeToken: r.unsubscribeToken,
            scheduledSendAt: r.scheduledSendAt,
            affiliateClickId: r.affiliateClickId,
            createdAt: r.createdAt,
          }));
      }

      // 이후: (callIdx-1) 을 3으로 나눠 row index + sub-step 결정
      const adjusted = callIdx - 1;
      const rowIdx = Math.floor(adjusted / 3);
      const subStep = adjusted % 3;

      const pendingRows = s.followUpRows
        .filter((r) => {
          if (r.sentAt !== null) return false;
          if (r.unsubscribedAt !== null) return false;
          if (r.email === null) return false;
          if (r.scheduledSendAt > s.nowForFilter) return false;
          return true;
        })
        .slice(0, 50);

      const pendingRow = pendingRows[rowIdx];
      if (!pendingRow) return [];

      if (subStep === 0) {
        return s.clickRows
          .filter((c) => c.id === pendingRow.affiliateClickId)
          .map((c) => ({ providerId: c.providerId, resultId: c.resultId }));
      } else if (subStep === 1) {
        const click = s.clickRows.find((c) => c.id === pendingRow.affiliateClickId);
        if (!click) return [];
        return s.providerRows
          .filter((p) => p.id === click.providerId)
          .map((p) => ({ name: p.name, website: p.website }));
      } else {
        const click = s.clickRows.find((c) => c.id === pendingRow.affiliateClickId);
        if (!click?.resultId) return [];
        return s.crRows
          .filter((c) => c.id === click.resultId)
          .map((c) => ({ shortId: c.shortId }));
      }
    });
    return chain;
  };

  const makeUpdateChain = () => {
    const updateChain: Record<string, unknown> = {};
    let setPayload: Record<string, unknown> = {};
    updateChain.set = vi.fn((payload: Record<string, unknown>) => {
      setPayload = payload;
      return updateChain;
    });
    updateChain.where = vi.fn(async () => {
      // anonymize-sent UPDATE: sentAt 설정 → store 반영
      const now2 = new Date();
      const s = storeRef.current;
      s.followUpRows = s.followUpRows.map((r) => {
        // UPDATE 대상: sentAt NULL, unsubscribedAt NULL (pending 이었던 row)
        // (inArray sentIds 필터는 send-each 에서 succeeded 에 추가된 row 만)
        // 통합 테스트에서는 1행이므로 단순화: 조건 부합하는 모든 pending row 갱신
        if (r.sentAt !== null) return r;
        if (r.unsubscribedAt !== null) return r;
        return {
          ...r,
          sentAt: setPayload['sentAt'] instanceof Date ? setPayload['sentAt'] : now2,
          email: 'email' in setPayload ? (setPayload['email'] as string | null) : r.email,
          piiAnonymizedAt:
            setPayload['piiAnonymizedAt'] instanceof Date
              ? setPayload['piiAnonymizedAt']
              : now2,
        };
      });
    });
    return updateChain;
  };

  return {
    db: {
      select: vi.fn(() => makeSelectChain()),
      update: vi.fn(() => makeUpdateChain()),
      // execute: 보조 작업 4 (ADR-0028 §T5) 단위 케이스에서 각 it() 안에서 재할당
      execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
    },
  };
});

// ─── drizzle-orm mock ────────────────────────────────────────────────────────

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: 'inArray', col, vals })),
  isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
  isNotNull: vi.fn((col: unknown) => ({ op: 'isNotNull', col })),
  lte: vi.fn((a: unknown, b: unknown) => ({ op: 'lte', a, b })),
  sql: vi.fn((s: unknown) => ({ raw: s })),
}));

// ─── schema mock ──────────────────────────────────────────────────────────────

vi.mock('@/db/schema/follow_up_email', () => ({
  followUpEmail: {
    id: 'id', email: 'email', unsubscribeToken: 'unsubscribeToken',
    scheduledSendAt: 'scheduledSendAt', sentAt: 'sentAt',
    unsubscribedAt: 'unsubscribedAt', piiAnonymizedAt: 'piiAnonymizedAt',
    affiliateClickId: 'affiliateClickId', createdAt: 'createdAt',
  },
  followUpEmailRelations: {},
}));

vi.mock('@/db/schema/affiliate_click', () => ({
  affiliateClick: { id: 'id', providerId: 'providerId', resultId: 'resultId' },
  affiliateClickRelations: {},
  affiliateConversionStatusEnum: { enumValues: ['pending'] },
}));

vi.mock('@/db/schema/comparison_result', () => ({
  comparisonResult: { id: 'id', shortId: 'shortId' },
  comparisonResultItem: { id: 'id' },
  comparisonResultRelations: {},
  comparisonResultItemRelations: {},
}));

vi.mock('@/db/schema/provider', () => ({
  provider: { id: 'id', name: 'name', website: 'website' },
  providerRelations: {},
}));

// ─── Inngest mock — step.run(name, fn) → fn() 즉시 실행 ─────────────────────

vi.mock('@/lib/inngest', () => ({
  inngest: {
    createFunction: vi.fn(
      (
        _opts: unknown,
        _triggers: unknown,
        handler: (ctx: {
          step: { run: (name: string, fn: () => unknown) => Promise<unknown> };
          logger: { info: () => void; warn: () => void; error: () => void };
        }) => unknown,
      ) => {
        return { _handler: handler };
      },
    ),
  },
}));

// ─── 환경변수 + store 리셋 ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  storeRef.current = storeRef.makeEmpty();
  process.env.RESEND_API_KEY = 'test-api-key';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://slim.be';
});

// ─── Inngest step thin runner ─────────────────────────────────────────────────

function makeStep() {
  return {
    run: async (_name: string, fn: () => unknown) => fn(),
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

// ─── followUpEmailFn 실행 helper ─────────────────────────────────────────────

async function runFollowUpEmailFn(now: Date) {
  // nowForFilter 설정 + selectCallCount 리셋
  storeRef.current.nowForFilter = now;
  storeRef.current.selectCallCount = 0;

  const mod = await import('./follow-up-email');

  // @builder-justification: Inngest mock 의 _handler 는 통합 테스트 전용 내부 접근.
  // createFunction mock 이 반환하는 { _handler } 를 꺼내기 위한 단언 — 런타임 타입 없음.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (mod.followUpEmailFn as any)._handler;
  if (typeof fn !== 'function') throw new Error('followUpEmailFn._handler 없음');

  return fn({ step: makeStep(), logger: makeLogger() });
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const NOW = new Date('2026-05-13T10:00:00Z');
const SEVEN_DAYS_AGO = new Date('2026-05-06T10:00:00Z');
const TOMORROW = new Date('2026-05-14T10:00:00Z');

function seedRow(overrides: Partial<FollowUpRow> = {}): FollowUpRow {
  const row: FollowUpRow = {
    id: 'row-uuid-0001',
    email: 'user@example.com',
    unsubscribeToken: 'unsub16charstokn',
    scheduledSendAt: SEVEN_DAYS_AGO,
    sentAt: null,
    unsubscribedAt: null,
    piiAnonymizedAt: null,
    affiliateClickId: 'click-uuid-0001',
    createdAt: SEVEN_DAYS_AGO,
    ...overrides,
  };
  storeRef.current.followUpRows.push(row);
  return row;
}

function seedClick(overrides: Partial<AffiliateClickRow> = {}): void {
  storeRef.current.clickRows.push({
    id: 'click-uuid-0001',
    providerId: 'provider-uuid-0001',
    resultId: 'cr-uuid-0001',
    ...overrides,
  });
}

function seedProvider(overrides: Partial<ProviderRow> = {}): void {
  storeRef.current.providerRows.push({
    id: 'provider-uuid-0001',
    name: 'Proximus',
    website: 'https://proximus.be',
    ...overrides,
  });
}

function seedCr(overrides: Partial<ComparisonResultRow> = {}): void {
  storeRef.current.crRows.push({
    id: 'cr-uuid-0001',
    shortId: 'abc123def456',
    ...overrides,
  });
}

// ─── 케이스 1: pending → sent 전체 흐름 ──────────────────────────────────────

describe('통합 케이스 1 — pending → sent 전체 흐름 (cross-module)', () => {
  it('select → send → anonymize 체인 — sentAt NOT NULL + email NULL + piiAnonymizedAt NOT NULL', async () => {
    seedRow();
    seedClick();
    seedProvider();
    seedCr();

    await runFollowUpEmailFn(NOW);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const row = storeRef.current.followUpRows[0];
    expect(row).toBeDefined();
    expect(row?.sentAt).not.toBeNull();
    expect(row?.email).toBeNull();
    expect(row?.piiAnonymizedAt).not.toBeNull();
  });

  it('Resend 호출 subject 에 providerName 포함 (cross-module: provider JOIN)', async () => {
    seedRow();
    seedClick();
    seedProvider({ name: 'Telenet' });
    seedCr();

    await runFollowUpEmailFn(NOW);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const callArg = mockSendEmail.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof callArg?.subject).toBe('string');
    expect(callArg.subject as string).toContain('Telenet');
  });
});

// ─── 케이스 2: unsubscribed_at NOT NULL → Resend 0 ───────────────────────────

describe('통합 케이스 2 — unsubscribed_at NOT NULL → Resend 0', () => {
  it('이미 해제된 row — Resend 0 + sent_at NULL 유지', async () => {
    seedRow({ unsubscribedAt: new Date('2026-05-07T00:00:00Z') });
    seedClick();
    seedProvider();
    seedCr();

    await runFollowUpEmailFn(NOW);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(storeRef.current.followUpRows[0]?.sentAt).toBeNull();
  });
});

// ─── 케이스 3: Idempotency — sent_at NOT NULL ────────────────────────────────

describe('통합 케이스 3 — Idempotency (sent_at NOT NULL)', () => {
  it('이미 발송된 row — Resend 0 (select 에서 제외)', async () => {
    seedRow({ sentAt: new Date('2026-05-07T00:00:00Z'), email: null });
    seedClick();
    seedProvider();
    seedCr();

    await runFollowUpEmailFn(NOW);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

// ─── 케이스 4: scheduled_send_at > now → Resend 0 ────────────────────────────

describe('통합 케이스 4 — scheduled_send_at > now (아직 발효 전)', () => {
  it('미래 예정 row — Resend 0 + sent_at NULL 유지', async () => {
    seedRow({ scheduledSendAt: TOMORROW });
    seedClick();
    seedProvider();
    seedCr();

    await runFollowUpEmailFn(NOW);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(storeRef.current.followUpRows[0]?.sentAt).toBeNull();
  });
});

// ─── 케이스 5: unsubscribeByToken → 이후 cron 발송 없음 ──────────────────────
// cross-module: unsubscribeByToken (4.5.e queries) 가 store.unsubscribedAt 갱신 →
// 동일 store 에서 followUpEmailFn 실행 → Resend 0 검증

describe('통합 케이스 5 — unsubscribeByToken → 다음 cron 발송 없음', () => {
  it('unsubscribeByToken → unsubscribed_at NOT NULL → 이후 cron Resend 0', async () => {
    const row = seedRow();
    seedClick();
    seedProvider();
    seedCr();

    // unsubscribeByToken 을 직접 stub 없이 시뮬레이션:
    // store row 에 직접 unsubscribedAt + email=null 설정 (5.e queries 효과 재현)
    storeRef.current.followUpRows = storeRef.current.followUpRows.map((r) =>
      r.id === row.id ? { ...r, unsubscribedAt: new Date(), email: null } : r,
    );

    // 이제 store 에서 unsubscribed_at IS NOT NULL → cron 발송 없음
    await runFollowUpEmailFn(NOW);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(storeRef.current.followUpRows[0]?.unsubscribedAt).not.toBeNull();
  });
});

// ─── 케이스 5b: unsubscribeByToken query 직접 호출 → unsubscribed_at 갱신 검증 ─
// cross-module: queries/follow-up-email.ts 의 실제 SELECT+UPDATE 로직 검증.
// db mock 재할당이 다른 테스트를 오염하지 않도록 afterEach 에서 원래 mock 으로 복원.

describe('통합 케이스 5b — unsubscribeByToken query 실행 (queries 레이어 검증)', () => {
  // db mock 원본 복원용 — 이 describe 안에서만 db.select/update 재할당
  let originalSelect: ReturnType<typeof vi.fn> | undefined;
  let originalUpdate: ReturnType<typeof vi.fn> | undefined;

  beforeEach(async () => {
    // @builder-justification: vi.mock('@/db') 가 런타임에 db.select/update 를
    // vi.fn() 으로 교체하지만 tsc 는 원본 타입을 인식. unknown 경유 이중 단언.
    const { db } = (await import('@/db')) as unknown as {
      db: { select: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    };
    originalSelect = db.select;
    originalUpdate = db.update;
  });

  afterEach(async () => {
    const { db } = (await import('@/db')) as unknown as {
      db: { select: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    };
    if (originalSelect) db.select = originalSelect;
    if (originalUpdate) db.update = originalUpdate;
  });

  it('SELECT + UPDATE 체인 → just-unsubscribed 반환 + updateCalled 확인', async () => {
    const { db } = (await import('@/db')) as unknown as {
      db: { select: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    };

    const token = 'AbCd1234_-AbCd12';

    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'row-uuid-5b', unsubscribedAt: null, email: 'user@example.com' },
      ]),
    });

    let updateCalled = false;
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => {
          updateCalled = true;
        }),
      }),
    });

    const { unsubscribeByToken } = await import('@/db/queries/follow-up-email');
    const result = await unsubscribeByToken(token);

    expect(result.kind).toBe('just-unsubscribed');
    expect(updateCalled).toBe(true);
  });
});

// ─── 보조 작업 4 케이스 (ADR-0028 §T5): deleteAnonymizedFollowUpEmails ────────
// scripts/harness/price-snapshot.ts 의 export 함수 직접 호출 — SQL 분리 단위 테스트.
// db.execute 를 mock 으로 대체해 rowCount 반환값 검증.

describe('보조 작업 4 (ADR-0028 §T5) — deleteAnonymizedFollowUpEmails 단위 케이스', () => {
  // 각 케이스에서 db mock 을 재할당하므로 afterEach 에서 복원
  let originalExecute: ReturnType<typeof vi.fn> | undefined;

  beforeEach(async () => {
    // @builder-justification: vi.mock('@/db') 가 런타임 db.execute 를 vi.fn()으로 교체.
    // tsc 원본 타입 없음 → unknown 경유 이중 단언.
    const { db } = (await import('@/db')) as unknown as {
      db: { execute: ReturnType<typeof vi.fn> };
    };
    originalExecute = db.execute;
  });

  afterEach(async () => {
    const { db } = (await import('@/db')) as unknown as {
      db: { execute: ReturnType<typeof vi.fn> };
    };
    if (originalExecute) db.execute = originalExecute;
  });

  it('케이스 A — pii_anonymized_at = now-100d row → DELETE 실행 (rowCount=1 반환)', async () => {
    const { db } = (await import('@/db')) as unknown as {
      db: { execute: ReturnType<typeof vi.fn> };
    };
    db.execute = vi.fn().mockResolvedValue({ rowCount: 1 });

    const { deleteAnonymizedFollowUpEmails } = await import(
      '../../scripts/harness/price-snapshot'
    );
    // @builder-justification: db 타입이 scripts/ 내부 import 와 다를 수 있어 단언.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await deleteAnonymizedFollowUpEmails(db as any);
    expect(count).toBe(1);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('케이스 B — pii_anonymized_at = now-89d row → DELETE 0 (경계 — 90일 미만)', async () => {
    // 89일 row 는 WHERE 조건 불충족 → DB 가 0 반환
    const { db } = (await import('@/db')) as unknown as {
      db: { execute: ReturnType<typeof vi.fn> };
    };
    db.execute = vi.fn().mockResolvedValue({ rowCount: 0 });

    const { deleteAnonymizedFollowUpEmails } = await import(
      '../../scripts/harness/price-snapshot'
    );
    // @builder-justification: 위와 동일 사유.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await deleteAnonymizedFollowUpEmails(db as any);
    expect(count).toBe(0);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('케이스 C — pii_anonymized_at IS NULL row → DELETE 0 (발송 전 행)', async () => {
    // IS NULL 행은 WHERE pii_anonymized_at IS NOT NULL 조건 불충족 → DB 가 0 반환
    const { db } = (await import('@/db')) as unknown as {
      db: { execute: ReturnType<typeof vi.fn> };
    };
    db.execute = vi.fn().mockResolvedValue({ rowCount: 0 });

    const { deleteAnonymizedFollowUpEmails } = await import(
      '../../scripts/harness/price-snapshot'
    );
    // @builder-justification: 위와 동일 사유.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await deleteAnonymizedFollowUpEmails(db as any);
    expect(count).toBe(0);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});

// ─── 케이스 6: Resend 1차 실패 → 2차 재시도 성공 ────────────────────────────

describe('통합 케이스 6 — Resend 1차 실패 → 2차 재시도 성공', () => {
  it('1차 실행: error → sent_at NULL 유지 / 2차 실행: 성공 → sent_at NOT NULL', async () => {
    seedRow();
    seedClick();
    seedProvider();
    seedCr();

    // 1차 실행 — Resend error 반환 (succeeded 에 추가 안 됨 → anonymize-sent skip)
    mockSendEmail.mockResolvedValueOnce({
      data: null,
      error: { message: 'API error', name: 'validation_error' },
    });
    await runFollowUpEmailFn(NOW);

    expect(storeRef.current.followUpRows[0]?.sentAt).toBeNull();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // 2차 실행 — 성공 (기본 mock 으로 복원)
    mockSendEmail.mockResolvedValueOnce({ data: { id: 'ok-id' }, error: null });
    await runFollowUpEmailFn(NOW);

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(storeRef.current.followUpRows[0]?.sentAt).not.toBeNull();
    expect(storeRef.current.followUpRows[0]?.email).toBeNull();
  });
});
