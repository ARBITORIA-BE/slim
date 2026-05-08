---
name: data-contract
description: 외부 데이터를 다루는 모든 코드가 source_url + fetched_at + confidence 필드를 강제하도록 보장한다. Fetcher 작성·DB 스키마 추가·UI 가격 표시 컴포넌트 작성 시 자동 트리거.
---

# Data Contract — 데이터 계약 스킬

P1(정보 우선)을 코드 레벨에서 강제한다. 

## 핵심 타입 (변경 금지)

```ts
// src/fetchers/types.ts
export interface FetchResult<T> {
  data: T;
  source_url: string;          // 반드시 https://
  fetched_at: string;          // ISO 8601 UTC
  confidence: 'high' | 'medium' | 'low';
  caveats?: string[];          // 사용자에게 노출할 주의사항
}

// src/db/schema/snapshot.ts
export const tariffSnapshot = pgTable('tariff_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  tariff_id: uuid('tariff_id').notNull().references(() => tariff.id),
  fetched_at: timestamp('fetched_at', { withTimezone: true }).notNull(),
  source_url: text('source_url').notNull(),
  raw_payload: jsonb('raw_payload').notNull(),
  confidence: text('confidence', { enum: ['high', 'medium', 'low'] }).notNull(),
});
```

## 룰

### Fetcher 작성 시
1. `Fetcher` 인터페이스 implement
2. 응답 받은 즉시 `fetched_at = new Date().toISOString()` 박제
3. `source_url`은 실제 호출한 URL (리다이렉트 후 최종 URL)
4. `confidence`:
   - 공식 API → `high`
   - 공식 페이지 스크래핑 → `medium`
   - 인덱스 페이지 / 추정값 → `low`

### UI 컴포넌트 작성 시
가격을 보여주는 모든 곳은 `<PriceWithSource>` 사용:

```tsx
<PriceWithSource
  amount={tariff.unit_price}
  currency="EUR"
  fetchedAt={snapshot.fetched_at}
  sourceUrl={snapshot.source_url}
  confidence={snapshot.confidence}
/>
```

## 위반 감지

`pnpm harness:data` 가 다음을 검증:
1. Fetcher 함수가 `FetchResult` 반환 타입 가짐
2. UI 가격 텍스트는 `<PriceWithSource>` 또는 `// __SAFE_PRICE_DISPLAY__` 코멘트
3. 스키마에서 `source_url`, `fetched_at`이 NOT NULL

## 예외 처리

데모용 / 마케팅 페이지의 가격은 `// __SAFE_PRICE_DISPLAY__` 코멘트 한 줄로 면제 가능.
하지만 코드 리뷰에서 사유 기재 의무.
