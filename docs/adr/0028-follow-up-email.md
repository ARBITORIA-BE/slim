# ADR-0028: Follow-up email — infrastructure (Resend) + data model + consent flow + GDPR retention

## Status

**Accepted** (2026-05-13 — 운영자 직접 결정 / architect 권고).

---

## Context

- **PLAN §4.5** — "후속 메일 시스템 (페이즈 4 속도 검증용)". 비교 후 7일 뒤 "변경하셨다면 알려주세요" 메일 1회 발송.
- **무엇이 우리를 이 결정 앞에 세웠는가:**
  1. **베타 100명 sample 데이터 수집** — 실제 switching service의 성공률 self-report를 솔로 운영 예산(€300/월)으로 대체.
  2. **PII 격리** — ADR-0026 §T1 "IP/fingerprint/session 컬럼 0" 잠금이 `affiliate_click`에 있으므로, 이메일(PII)은 별도 테이블 + 발송 직후 즉시 익명화로 분리.
  3. **GDPR 보존 분리** — 어트리뷰션 메타(언제 클릭했나)는 분석/정산(7~10년) vs 이메일(PII)은 90일 후 삭제. 한 테이블에서 혼재 불가.
  4. **Resend EU region** — Art. 44 international transfer 회피 (GDPR compliance).
  5. **Inngest cron 패턴** — ADR-0008 `step.run()` 분할과 동일 철학. step 격리 + idempotency.

---

## Decision

T1~T7 7개 결정.

### T1 — 이메일 인프라 = Resend (EU region)

선택 근거:
- **비용**: 100 emails/day 무료 → 베타 100명 × 1회/7일 = ~14 emails/day. 충분.
- **GDPR 정합**: EU region 가능 (data residency GDPR Art. 44 호환).
- **SDK**: `resend` — Next.js 네이티브.
- **단순성**: 솔로 운영 + €300 cap (ADR-0004 §결정 2) 일관. IAM / reputation 관리 오버헤드 X.
- **환경변수**: `RESEND_API_KEY` (운영자 가입 후 발급 — Claude/builder가 가입 X).

**격상 트리거 (ADR amendment)**:
- 월 ≥ 3,000 이메일 도달 시 → Postmark / AWS SES 재평가.
- 현 추정(베타 단계): 월 ~400 emails (100명 × 1회/7일 + 재발송 여유).

#### T1.a — `RESEND_API_KEY` 환경 분리 정책

**배경**: [ADR-0022 §D3](0022-database-environment-separation.md) 에서 정한 DB endpoint 환경 분리 패턴(production/preview/development 3 브랜치, 각각 다른 endpoint, 환경별 SoT)을 Resend API key 에도 일관적으로 적용. 운영자가 2026-05-13 Resend dashboard에서 prod/dev 두 개 키 발급 완료.

| 환경 | 키 출처 | 비고 |
|---|---|---|
| production | Vercel production env (`RESEND_API_KEY`) | prod 키 — 운영자가 Resend dashboard 에서 발급 + Vercel UI 에서 등록. **영속 저장 0** (ADR-0022 §D2 정신 일관). |
| preview | Vercel preview env (`RESEND_API_KEY`) | dev 키 *재사용* 또는 별도 preview 키 — 운영자 판단. 권장: dev 키 재사용 (베타 단계, preview = 비-프로덕션). |
| development (`.env.local`) | `RESEND_API_KEY=<dev key>` | 운영자가 로컬 `.env.local` 에 직접 등록. **Claude/builder 절대 수정 X** — `.env.local` 보안 권한 차단. |

**원칙**: 모든 환경에서 `process.env.RESEND_API_KEY` 만 읽음 — 코드는 키 *값* 을 보지 않으므로 환경 분리는 운영 책임.

#### T1.b — 운영자 Vercel env 등록 가이드

**Vercel project settings에서 5분 진행:**

1. **Production env 등록**
   - "Environment Variables" → "Create (또는 edit `RESEND_API_KEY`)
   - Name: `RESEND_API_KEY`
   - Value: <Resend dashboard prod 키>
   - Environments: **Production 만 체크** (Preview/Development 체크 해제)
   - Save

2. **(선택) Preview env 등록**
   - 동일 절차, Value: <dev 키 또는 별도 preview 키>
   - Environments: **Preview 만 체크**
   - 권장: dev 키 재사용 (비용/단순성)

3. **Development env 제외**
   - `.env.local` 이 SoT → Vercel에 등록하지 말 것

#### T1.c — 로컬 `.env.local` 등록 가이드

**운영자 1분 작업:**

1. 로컬 프로젝트 디렉토리: `.env.local` 에 1줄 추가
   ```
   RESEND_API_KEY=<dev key>
   ```

2. `.env.local.example` 갱신 (운영자가 직접 — Claude 권한 차단)
   ```
   # Resend transactional email (ADR-0028 §T1.a)
   # 환경 분리: prod 키 = Vercel production only / dev 키 = 본 파일 / preview = dev 재사용 or Vercel preview env
   # 발급: https://resend.com/api-keys
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. `.env.local` 은 이미 `.gitignore` 에 등재됨 (확인: `grep .env.local .gitignore`)

**보안 체크:**
- prod 키는 Resend dashboard 외부(Vercel 외부) 절대 저장 X → git commit 0 확인
- 유출 시: Resend dashboard revoke → 신규 발급 → Vercel env + `.env.local` 둘 다 갱신

### T2 — 데이터 모델 = 별도 `follow_up_email` 테이블

**테이블 구조** (10 컬럼):

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK | 기본 키 |
| `affiliate_click_id` | uuid | FK NOT NULL, ON DELETE CASCADE | 1:1 링크 (`affiliate_click` 테이블) |
| `email` | text | NULL → 발송 후 NULL 화 | 사용자 이메일 (PII) |
| `consent_given_at` | timestamptz | NOT NULL | 동의 시각 (인터스티셜에서) |
| `scheduled_send_at` | timestamptz | NOT NULL | 예정 발송 시각 (created_at + 7d) |
| `sent_at` | timestamptz | NULL | 실제 발송 시각 (Inngest 갱신) |
| `unsubscribed_at` | timestamptz | NULL | unsubscribe 시각 |
| `unsubscribe_token` | text | UNIQUE NOT NULL | nanoid(16) — 1-click 인증 |
| `pii_anonymized_at` | timestamptz | NULL | email NULL 화 시각 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | 행 생성 시각 |

**인덱스** (2개):
- `(scheduled_send_at, sent_at)` — Inngest hot path (WHERE 절 최적화)
- `(unsubscribe_token)` — 1-click 매칭 속도

**설계 원칙**:
- **FK 정책**: `ON DELETE CASCADE` (affiliate_click 삭제 시 후속 메일도 삭제). 클릭이 없으면 후속 메일도 의미 없음.
- **이메일 NULL 화**: `sent_at` 갱신 + 같은 트랜잭션에서 `email := NULL` + `pii_anonymized_at := now()`. 양방향 일관성 보장.
- **unsubscribe_token**: nanoid(16) (ADR-0007 §T7 패턴 일관) — URL-safe, 고유, URL 길이 최소화.

### T3 — 수집 시점 = 4.1.d 인터스티셜 옵션 확장

**흐름**:
1. 사용자가 비교 결과 페이지에서 "변경하기" CTA 클릭.
2. **동의 인터스티셜** 표시 (기존 4.1.c — 어트리뷰션 동의).
   - 새 필드 추가: **이메일 input** + **체크박스** ("후속 메일 받기 (선택)")
   - **pre-checked = false** 강제 (헌법 §8 #3 / CMA dark pattern 회피).
3. 사용자 선택:
   - 체크 O → `follow_up_email` row INSERT (email + consent_given_at).
   - 체크 X → row 미생성 (NOT NULL consent_given_at 강제).

**Granular consent** (GDPR Art. 7(2)):
- 어트리뷰션 동의와 *별개 체크박스* — 한쪽 거부 가능.
- 어트리뷰션 거부 시 → 인터스티셜 도달 불가 (FK 종속).

### T4 — GDPR 합법근거 & 동의 흐름

**합법근거**: **Art. 6(1)(a) Consent** (명시적 동의)
- 수집 + 발송 모두 동의 기반 (별개 동의 X, 한 체크박스 안 목적 명시).

**Art. 13 정보 제공** (인터스티셜 카피):
```
"Slim이 7일 후 1회 이메일로 후속합니다:
'변경하셨다면 알려주세요' 메일 (약 2분 소요)

이메일은 발송 직후 익명화됩니다 (PII 최소화).
모든 메일에 1-click unsubscribe 링크 포함."
```

**Art. 7(3) 동의 철회** (unsubscribe):
- 모든 후속 메일 본문에 1-click unsubscribe 링크 NOT-optional.
- `/unsubscribe/[token]` GET 라우트 → `unsubscribed_at` + `email := NULL` 즉시 실행.

**Granular consent 구분** (Art. 7(2)):
- "어트리뷰션 동의" vs "후속 메일 동의" 체크박스 분리.
- 어트리뷰션은 동의했지만 메일은 거부 가능.

### T5 — 보존 정책 (GDPR Art. 5(1)(e) Storage Limitation)

**PII 보존**:
- **발송 직후 익명화**: Inngest function이 Resend 호출 성공 후 **같은 트랜잭션 안에서** `email := NULL` + `pii_anonymized_at := now()`.
- **메타 컬럼** (sent_at, scheduled_send_at, consent_given_at): 분석/감시 목적 분리 보존 (PII 부재) → 90일 후 행 삭제 또는 영구 익명 통계.
- **unsubscribe 후**: 즉시 `email := NULL` + `unsubscribed_at` 스탬프.

**보존 일정** (cron):
- **Day 90**: `pii_anonymized_at` ≤ (now - 90d) → 행 삭제 또는 메타만 보존.
- **Day 0 (발송 직후)**: `email := NULL` (즉시, idempotency 보장).

**정산 메타** (부모 `affiliate_click`와 다름):
- `affiliate_click`의 보존(7~10년 회계)과 무관.
- FK `ON DELETE CASCADE` → affiliate_click 삭제 시 follow_up_email도 자동 삭제.

### T6 — 7일 트리거 = Inngest function `followUpEmail`

**함수 정의**:
- 트리거: cron (또는 step.sleep 패턴, ADR-0008 일관).
- 시점: UTC 매일 09:00 (DST 회피, TZ=UTC).
- jitter: '5m' (thundering herd 분산).

**로직** (의사 코드):
```ts
export const followUpEmail = inngest.createFunction(
  { id: 'follow-up-email' },
  { cron: 'TZ=UTC 0 9 * * *', jitter: '5m' },
  async ({ step }) => {
    // 1. SELECT 발송 대상
    const rows = await step.run('fetch-pending', async () => {
      return db.query.followUpEmail.findMany({
        where: and(
          lte(followUpEmailTable.scheduledSendAt, now),
          isNull(followUpEmailTable.sentAt),
          isNull(followUpEmailTable.unsubscribedAt),
        ),
        limit: 100, // Inngest concurrency 안전
      });
    });

    // 2. 각 행별 발송 (격리)
    for (const row of rows) {
      await step.run(`send-email-${row.id}`, async () => {
        try {
          const result = await resend.emails.send({
            from: 'slim@resend.dev',
            to: row.email,
            subject: '[Slim] 변경하셨다면 알려주세요',
            html: emailTemplate(row),
          });
          
          // 3. 발송 성공 → 익명화
          await db
            .update(followUpEmailTable)
            .set({
              sentAt: now,
              email: null, // PII 삭제
              piiAnonymizedAt: now,
            })
            .where(eq(followUpEmailTable.id, row.id));
        } catch (err) {
          // 실패 → sentAt 미갱신 (다음 cron 재시도)
          console.error(`Email send failed: ${row.id}`, err);
        }
      });
    }
  },
);
```

**Idempotency**:
- WHERE `sentAt IS NULL` 필터 + transaction 안 갱신.
- 중복 발송 0건 보장.

### T7 — 다크패턴 0 + 4.1.d 일관성

**강제 사항** (page.dark-pattern.test.ts 회귀):
- ✅ pre-checked 0 (체크박스 기본 미체크)
- ✅ 동의/거부 동등 가시성 (Visual Interference 0)
- ✅ Confirmshaming 0 ("그냥 받지 않을게요" 같은 부정적 표현 X)
- ✅ Fake Urgency 0 ("5분 안에 클릭하세요" 류 X)
- ✅ 메일 본문: 이미지 추적 beacon 0, 재구독 유도 0

**메일 본문 톤**: 중립적, 선택적
```
안녕하세요 [사용자],

비교하신 후 변경하셨다면, 1분만 시간을 내어 알려주세요.

[결과 페이지 링크]

이것이 도움이 되었기를 바랍니다.
Slim

---
[1-click unsubscribe 링크]
```

---

## Alternatives considered

### (a) AWS SES (EU region)
- **장점**: 저렴 ($0.10/1k), fully managed.
- **거부 근거**: IAM 설정 + reputation/bounce handling 복잡도. 솔로 운영 부담 중형.

### (b) Postmark
- **장점**: Transactional 100/month 무료, 높은 deliverability 평판.
- **거부 근거**: 한계 빠듯. 베타 100명 × 1회/7일 = ~400/월 초과 → 유료 전환 임박.

### (c) 자체 SMTP (Hetzner SMTP 등)
- **장점**: 저비용.
- **거부 근거**: 솔로 reputation/DKIM/SPF/DMARC 관리 불가. Deliverability 위험.

### (d) `affiliate_click` 컬럼 확장
- **거부 근거**: ADR-0026 §T1 "IP/fingerprint/session 컬럼 0" 잠금 위반. PII 부재 정신 훼손 + 보존 기간 분리 불가.

### (e) `comparison_request` 확장
- **거부 근거**: `comparison_request`는 이미 익명화 (ADR-0007 §T4) → 이메일 추가 시 충돌. 별도 테이블이 설계 깔끔.

### (f) Art. 6(1)(f) Legitimate Interest (동의 미요구)
- **거부 근거**: EDPB Guidelines 05/2020 "동의 권장" + 강력하지 않은 근거. 안전한 (a) 채택.

---

## Consequences

### 얻는 것
- ✅ 베타 100명 sample의 변경 성공률 self-report → 솔로 switching service 대체.
- ✅ PII 격리 모델 → ADR-0026 & ADR-0007 정합성 강화.
- ✅ Resend EU region → GDPR Art. 44 international transfer 회피.
- ✅ Inngest cron 패턴 재사용 → step 격리 + idempotency 일관.

### 잃는 것 / 부채
- ⚠️ **Resend 격상 트리거**: 월 ≥ 3,000 이메일 시 Postmark / SES 재평가 (ADR amendment).
- ⚠️ **외부 변호사 감사**: 7항목 (legal 4.5.f 진행 중) + *추가 가능* (후속 메일 동의/보존 관련).
- ⚠️ **Resend API 가용성**: 장애 시 Inngest retry 정책 활용 (24h max).

---

## Verification

**기록 (2026-05-13, PLAN 4.5 시행중)**:

- ✅ **4.5.a: ADR-0028 설계 잠금** — T1~T7 결정 + Alternatives (a)~(f) 거부 근거 명시 + cross-ref 2건 추가 (ADR-0026 §T1 + ADR-0008 §cron). 커밋 `f562de3`.
- ✅ **4.5.b: 데이터 모델 (T2) 구현** — `src/db/schema/follow_up_email.ts` 신설 (10 필드, 2 인덱스, FK CASCADE). `drizzle/0006_graceful_proteus.sql` 마이그레이션. `pnpm db:push` 성공 + `pnpm verify:db` allowlist 확인 (schema 변경 무고장, 환경 분리 영향 0). 부재 컬럼 5건(IP/UA/fingerprint/session/referrer — ADR-0026 §T1 잠금 보존). 추적 beacon 0. typecheck/lint/test 401 passed. 커밋 `172743e`.
- ✅ **4.5.c: 동의 UI 확장 (T3/T4/T7) + 수집 흐름** — `src/app/go/[shortId]/[itemId]/page.tsx` 후속 메일 섹션 신설 (email input + 체크박스 `defaultChecked={false}` + Art. 13 카피 3줄 + 종속 안내 1줄). `src/app/go/[shortId]/[itemId]/confirm/route.ts` form 파싱 + 조건부 `insertFollowUpEmail` 호출. `src/db/queries/follow-up-email.ts` 신설 — unsubscribe_token=nanoid(16) 생성, scheduled_send_at=created_at+7d 계산. neon-http 트랜잭션 미지원 → 순차 실행, FK CASCADE 정합. `page.dark-pattern.test.ts` 26→31 (G 섹션 5건: pre-checked 양방향 잠금 + Art. 13 카피 + Confirmshaming). `confirm/route.test.ts` 8→13 (5건: email+followUp 조합 + silent skip + nanoid(16) 형식). typecheck/lint/test 411 passed (401+10) / harness:plan 51 정합 / harness:data 통과. 커밋 `c8fa163`.
- ✅ **4.5.d: Inngest function + 단위 테스트 (T6 전체 + T7 다크패턴 최종)** — `src/inngest/follow-up-email.ts` 신설 (cron 매시간 + 4 step: fetch-pending/send-each/anonymize-sent/log-summary). atomic UPDATE 우회(neon-http 트랜잭션 미지원) — sent_at + email NULL + pii_anonymized_at 동기 갱신. Resend mock (`vi.mock('resend')`) — 운영자 API 키 미등록이어도 unit test 통과. 본문 다크패턴 0 (image beacon/UTM/fake urgency 모두 0). `.env.example` + `.env.local.example`에 RESEND_API_KEY + RESEND_FROM_EMAIL placeholder. `resend@^6.12.3` 의존성. `src/inngest/follow-up-email.test.ts` 신설 (14 케이스: idempotency 2회 발송 1회만 / anonymization email NULL 화 동기 / 실패 경로). typecheck/lint/test 425 passed (411+14) / harness:plan 51 정합 / harness:data 통과. 커밋 `9c44c4a`. (2026-05-13 정정: SDK 패키지명 `resend` — 오기 `@resend/node` 정정).
- ✅ **4.5.e: `/unsubscribe/[token]` RSC + 단위 테스트 (T4 + T7 최종)** — `src/app/unsubscribe/[token]/page.tsx` RSC 신설 (75줄, Discriminated union). GET 요청 → nanoid(16) token 형식 검증 `/^[A-Za-z0-9_-]{16}$/` + atomic UPDATE (unsubscribed_at=now() + email=NULL + pii_anonymized_at=COALESCE(기존, now())). 응답: 간결 confirmation 페이지 (not-found/already-unsubscribed/just-unsubscribed 분기). idempotency: 재클릭도 동일 메시지 (상태 차이 노출 X — CMA dark pattern 회피). 다크패턴 0 (재구독 CTA/Confirmshaming/마케팅톤 모두 0). 4.5.d Inngest 메일 본문의 1-click 언서브스크라이브 URL 도착지 (path validation 일치). `.test.tsx` 20 케이스 (token 형식 검증 / not-found / already-unsubscribed / just-unsubscribed / idempotency). 헌법 §8 #1 자가 (headers/cookies 0건, PII 외부 전송 0). typecheck/lint/test 445 passed (425+20) / harness:plan 51 정합 / harness:data 통과. 커밋 `1e4d5a1`. **T4 (Art. 7(3) 1-click unsubscribe) + T7 (다크패턴 0 confirmation page) 충족**.
- ⏳ **4.5.f: legal 1차 GDPR Art. 6/7/13 + 다크패턴 통과** (`docs/legal/gdpr-register.md` 신규 항목).
- ⏳ **4.5.g: E2E** (인터스티셜 → 동의 → INSERT → mock 7일 후 발송 → unsubscribe → unsubscribed_at 기록).

---

## References

- **ADR-0026** §T1 — PII 부재 컬럼 잠금 (본 ADR이 별도 테이블로 정신 보존 / "후속 메일 PII 격리" cross-ref 추가)
- **ADR-0008** §T7 — Inngest cron + step.run() 분할 패턴 (본 ADR이 followUpEmail Inngest function으로 같은 패턴 따름 — cron 트리거 + step.run 격리 + idempotency)
- **ADR-0007** §T4 — PII 익명화 패턴 (본 ADR이 발송 직후 익명화로 일관)
- **ADR-0004** — €300 cap (본 ADR이 Resend 무료 한도 선택으로 정합)
- **헌법** P1 (정보 우선) / P3 (투명성) / §8 #1 (사용자 데이터 외부 전송 0 — Resend는 발송 전용, 추적 0)
- **GDPR Art. 5(1)(e)** Storage Limitation / **Art. 6(1)(a)** Consent / **Art. 7(2)(3)** Withdrawal & Granularity / **Art. 13** Information to be provided / **EDPB Guidelines 05/2020** Legitimate Interest Assessment / **CMA Guidance** Dark Patterns
