# ADR-0039: production 마이그레이션 적용 절차 — `db:push` 인라인 + verify-db 확장 + 배포 후 체크리스트

## 상태
Accepted (2026-06-05). 제안 (2026-06-02, architect — 프로덕션 마이그레이션 갭 실측) → 운영자 인라인 `db:push` 적용 (2026-06-03, ADR-0022 §D4 정합) → DoD 5/5 통과 (2026-06-05, Pieter MCP 실측 + 운영자 Neon 검증).

### Verification (2026-06-05 종결 트레일)

PLAN D.9 DoD 5/5 전부 통과:

- **#1 ✅** `pnpm exec tsx scripts/verify-db.ts` (2026-06-03, 운영자 인라인) — 8 테이블 all-green: `affiliate_click ✓ comparison_request ✓ comparison_result ✓ comparison_result_item ✓ follow_up_email ✓ provider ✓ tariff ✓ tariff_snapshot ✓`, 시드 provider 2/2 (proximus-be / telenet-be).
- **#2 ✅** `slim.lu/en/admin` 월별 전환율 카드 정상 렌더 (2026-06-03 Claude_in_Chrome 인증 실측 20:36:17Z) — 이전 `relation "affiliate_click" does not exist` 에러 해소.
- **#3 ✅** Inngest follow-up-email 24h 실측 (2026-06-05 ~08:30Z, Pieter MCP `app.inngest.com/env/production/functions/slim-follow-up-email/runs`) — **24/24 Completed**, Failure rate **0%**, Output `{failed:0, selected:0, sent:0}` (DB 쿼리 정상 / 보낼 대상 0건 = 외부 트래픽 부재). daily-fetch-all 동시 검증 1/1 Completed 49s (cron `0 6 * * *` UTC).
- **#4 ✅** Pieter MCP 자가 5단계 비교 (`fr-BE/compare/mobile`, postal=1000, Tout seul, current-provider skip, sans facture) → `/r/2vvYzg0EcRu8` 결론 카드 "Modifier" CTA → `/go/2vvYzg0EcRu8/955f3949-4058-4706-8927-d1fc79622d35` interstitial → "동의하고 이동" → `confirm/route.ts:100` `insertAffiliateClick` → proximus.be 리다이렉트. 운영자 Neon Console 검증:
  ```
  affiliate_click 1행: id=1e5f621b-616f-483f-95b7-8c7c7c1ae6d1
  ref_param='slim-r-2vvYzg0EcRu8'
  conversion_status='pending'
  consent_given_at=2026-06-05 08:29:15.644+00
  created_at=    2026-06-05 08:29:15.879+00  (Δ 235ms = 동의→INSERT)
  result_item_id=955f3949-... (인터스티셜 URL itemId 완전 일치)
  ```
  IP / user_agent / referrer / session_id 컬럼 부재 = ADR-0026 §T1 헌법 §8 #1 스키마 잠금 정합.
- **#5 ✅** `scripts/verify-db.ts` 기대 테이블 6→8 확장 (PR #14 = `11aa6bf` 기머지).

### 부수 발견 (별도 트랙 — D.9 종결 무관)

- **🔴 PLAN 4.5.j.3 우선순위 격상** — fr-BE `/go/<shortId>/<itemId>` interstitial 라이브가 한국어 본문 그대로 노출 ("이동 전 확인 사항" 등). `legal.*` 네임스페이스 fr/nl placeholder = 4.5.j.3 잔여. 4.6 organic SEO 진입 *전* 해소 권장.
- **🟡 PLAN 6.1 어드민 v1 백로그 +1** — affiliate_click count 카드 추가 (현 admin v0 = converted 카운트만, 클릭 발생 자체 노출 0 → D.9 같은 검증을 매번 Neon Console 의존).

## 맥락
2026-06-02 22:11Z 프로덕션 `slim.lu/admin` 실측에서 두 증상:
- 월별 전환율 카드: `relation "affiliate_click" does not exist`
- follow-up-email cron: `relation "follow_up_email" does not exist`, Inngest 24h Failure rate 100%

마이그레이션 매핑:
- `affiliate_click` = `drizzle/0005_pale_praxagora.sql`
- `follow_up_email` = `drizzle/0006_graceful_proteus.sql`
- `0007_loose_justin_hammer.sql` = `tariff_category` enum 재정의(landline 제거)

작동하는 표면(tariff/tariff_snapshot/comparison_*)은 0000~0004 적용을 증명한다.
→ **production Neon에 0005/0006/0007 미적용** (0000~0004만 적용).

근본 원인은 **production 마이그레이션 적용 자동화 부재**다:
- `ci.yml`: typecheck/test/harness:plan/harness:data 4단 — 마이그레이션 적용 단계 **없음**.
- `next.config.ts` buildCommand: `next build`만 — Vercel은 순수 빌드 머신(ADR-0002).
- [ADR-0022](0022-database-environment-separation.md) §D4: production 변경은 **인라인 `DATABASE_URL=...` 한 줄 명령으로만**(`db:push`). 즉 설계상 **운영자 수동 적용**이며, 0005/0006/0007 생성 후 production 인라인 적용이 **누락**되었다.
- 갭이 게이트를 빠져나간 이유: `scripts/verify-db.ts`(L121-128)가 기대 테이블을 **초기 6개**(provider/tariff/tariff_snapshot/comparison_*)로만 하드코딩 — `affiliate_click`/`follow_up_email`을 검증하지 않아 누락이 탐지되지 않았다.

연결 PLAN 항목: **D.9** (신규, Phase 0.5 운영 부채).

## 결정
1. **적용 도구 = `db:push`** (`drizzle-kit migrate`가 아니라). 근거: `db:push`는 라이브 스키마와 `src/db/schema`의 **diff만** 반영 → 이미 적용된 0000~0004는 건드리지 않고 부재 객체만 생성. 0005/0006 SQL은 전부 `CREATE TABLE IF NOT EXISTS` + `DO $$ ... duplicate_object ... $$`로 **멱등**이며 기존 데이터 테이블을 만지지 않는다(데이터 손실 0).
2. **0007 raw 미적용**. 0007은 `DROP TYPE tariff_category` + enum 재생성(L8-9)을 포함 — `drizzle-kit migrate`로 raw 실행 시 enum-의존 컬럼 때문에 실패/위험. production의 `tariff_category`가 이미 schema와 일치하면 `db:push` diff는 **0007에 해당하는 변경을 no-op**으로 건너뛴다. enum 차이가 있으면 운영자가 diff 출력을 **검토 후** 승인(인터랙티브 `db:push`).
3. **verify-db 확장** — `scripts/verify-db.ts` 기대 테이블에 `affiliate_click` + `follow_up_email` 추가(builder). 이 가드가 다음 누락을 게이트에서 잡는다.
4. **배포 후 체크리스트** — 자동 CI 마이그레이션은 도입하지 **않는다**(아래 §결과 트레이드오프). 대신 운영자 절차에 "스키마 변경 PR 머지 → production 인라인 `db:push` → `verify:db` → admin 카드 확인"을 명문화.

## 적용 절차 (운영자 트랙, production 시크릿 접근)
```powershell
# 1. dry-run으로 diff 먼저 확인 (적용 전 무엇이 바뀌는지)
$env:DATABASE_URL = "<Neon Console → production 브랜치 connection string>"
pnpm exec tsx scripts/verify-db.ts        # 현재 상태 (affiliate_click/follow_up 누락 확인)
pnpm db:push                              # 인터랙티브 diff 출력 — DROP/ALTER 경고가 보이면 중단·검토
                                          # 기대: affiliate_click + follow_up_email + 인덱스/enum 생성, 기존 테이블 변경 0
pnpm exec tsx scripts/verify-db.ts        # 적용 후 재검증
Remove-Item Env:\DATABASE_URL             # 즉시 정리 (ADR-0022 §D4)
```
**안전 원칙**: `db:push` diff 출력에 기존 테이블(provider/tariff/tariff_snapshot/comparison_*)의 `DROP COLUMN`/`ALTER COLUMN ... DATA TYPE`/`DROP TABLE`이 **하나라도** 보이면 즉시 중단하고 architect 재호출. 기대 diff는 **신규 객체 생성만**(affiliate_click/follow_up_email/관련 인덱스/affiliate_conversion_status enum, 그리고 0007 enum diff가 있으면 그것).

## 대안
- **대안 A — CI에 `drizzle-kit migrate` 자동화**: PR 머지 시 GitHub Actions가 production에 마이그레이션 적용.
  - 장점: 갭 구조적 봉합, 망각 불가.
  - 단점: ADR-0022 §D4(인라인 only) 위반 + production 자격증명을 CI 시크릿에 상주 + **2026-05-17 P0 전례**(자동배포 + fail-closed = prod 다운)와 동형 위험. `migrate` raw 실행은 0007 같은 DROP TYPE을 무조건 실행 → 솔로 운영에서 통제 불가. **거부**.
- **대안 B — `db:push` 인라인 수동 + verify-db 가드 (채택)**: 운영자가 명시적으로 적용, diff 육안 검토, verify-db가 누락 탐지.
  - 장점: ADR-0022 정합, 데이터 손실 0(diff 기반), 솔로 통제 가능.
  - 단점: 운영자 망각 가능 → verify-db 가드 + 체크리스트로 보완.

## 결과
- ✅ affiliate_click 생성 → 클릭/전환 추적 복원(수익 모델 핵심), admin 전환율 카드 정상.
- ✅ follow_up_email 생성 → cron Failure 100% → 0%.
- ✅ verify-db가 향후 스키마 추가 누락을 게이트에서 차단.
- ⚠️ production 마이그레이션은 여전히 **수동**(자동화 의도적 거부). 운영자 체크리스트 의존 — ADR-0022 §회귀 트리거 #6("월 수 회 이상 인라인 명령") 발화 시 대안 A/Neon Vercel Integration 재평가.
- ⚠️ legal 영향: affiliate_click 부재 = 클릭/전환 미기록 = 어필리에이트 **정산 정확성·디스클로저 근거 데이터 공백**(GDPR보다 비즈니스 정합 — 기록 자체가 없었으므로 PII 유출 위험은 0, 오히려 수익 데이터 손실).

## 검증 방법
1. `pnpm exec tsx scripts/verify-db.ts`(production) → affiliate_click + follow_up_email 포함 8 테이블 all-green.
2. `slim.lu/admin` 월별 전환율 카드 에러 사라짐(빈 데이터라도 0% 정상 렌더).
3. Inngest follow-up-email cron 24h Failure rate 100% → 0%.
4. 어필리에이트 클릭 1회 발생 후 production `affiliate_click` 행 기록 확인.
