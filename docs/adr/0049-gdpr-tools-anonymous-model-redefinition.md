# ADR-0049: 6.4 GDPR 도구 재정의 — 익명 모델 + 이메일 + 영구 링크 self-service ([ADR-0048](0048-phase-6-bulk-promotion-option-c.md) §D1 광의 해석)

## 상태

**Accepted** (2026-06-10, Pieter — 운영자 직접 결정, [ADR-0048](0048-phase-6-bulk-promotion-option-c.md) §D1 광의 해석 동반).

PLAN 6.4 "GDPR 도구 (`/account/export`, `/account/delete`)" 원 명세 = **익명 우선 모델과 충돌 (회원가입 0 → `/account/*` 라우트 자체 무효)**. 본 ADR이 6.4를 익명 모델 정합으로 재정의.

## 맥락 (Context)

### 트리거 — ADR-0048 옵션 C 11건 격상 라운드 6.4 충돌

[ADR-0048](0048-phase-6-bulk-promotion-option-c.md) 옵션 C (11건 일괄 격상) 라운드 진행 중, 6.4 "GDPR 도구 (`/account/export`, `/account/delete`)"가 다음 모델 전제와 충돌 발견:

- **[ADR-0007](0007-comparison-request-result-schema.md) §T1**: 익명 우선 — `comparison_request` PII 최소화 + 계정 없음
- **[ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) §결정 5**: organic SEO 런치 — 회원가입 0
- **[ADR-0033](0033-i18n-next-intl-introduction.md) §T1**: `app/[locale]` 세그먼트 — `/account` 라우트 부재
- 페이즈 4 종료 (2026-06-10) 시점 = 계정 시스템 0 + 익명 영구 링크 (`/r/[shortId]`)만 존재

### 6.4 원 명세의 GDPR 요구사항

PLAN 6.4: "GDPR 도구 — 데이터 다운로드 (`/account/export`) + 삭제 (`/account/delete`)"

근거 = GDPR Art. 15 (열람권) / Art. 17 (삭제권) / Art. 20 (이동권). 일반적 구현 = 로그인 사용자 계정 페이지에서 데이터 self-service.

**충돌 핵심**: 익명 모델에서 사용자를 식별할 키가 없음 → `/account/export` 호출자가 누구인지 알 수 없음 → 데이터 매칭 불가.

### 익명 모델 GDPR 정합 경로 (기존 시스템 검토)

현 시스템이 GDPR 권리 행사를 어떻게 보장하는지 검토:

| GDPR 권리 | 현 시스템 경로 | 정합성 |
|---|---|---|
| Art. 13 (정보 제공) | `/legal/privacy` 페이지 + Art. 13 12항목 노출 ([ADR-0037](0037-public-legal-pages-and-cookie-consent.md) §D2) | ✅ 완성 |
| Art. 15 (열람권) | (1) 영구 링크 `/r/[shortId]` = 사용자가 직접 결과 재열람 / (2) 운영자 이메일 (kim.wonmin91@gmail.com) 통해 행사 | ✅ 익명 모델 정합 |
| Art. 16 (정정권) | 운영자 이메일 행사 (익명 = 정정 대상 PII 거의 0) | ✅ 부분 |
| Art. 17 (삭제권) | (1) 영구 링크 삭제 = `/r/[shortId]` URL 폐기 (사용자 단독) / (2) 운영자 이메일 행사 = 행 단위 삭제 / (3) 90일 cron PII NULL화 자동 ([ADR-0007](0007-comparison-request-result-schema.md) §T4) | ✅ 익명 모델 정합 |
| Art. 20 (이동권) | 영구 링크 = 사용자가 직접 결과 보존 (URL 공유 = 이동) | ⚠️ 부분 (JSON export 부재) |
| Art. 7(3) (동의 철회) | (1) 후속 메일 unsubscribe (`/unsubscribe/[token]`) ([ADR-0028](0028-follow-up-email.md)) / (2) 쿠키 동의 철회 (CookieSettingsButton) ([ADR-0037](0037-public-legal-pages-and-cookie-consent.md) §D3) | ✅ 완성 |
| Art. 21 (반대권) | 운영자 이메일 행사 | ✅ |

**결론**: 현 시스템이 익명 모델 GDPR 권리 행사 경로를 사실상 완비. `/account/*` 라우트 없이 정합.

부분 미달 = Art. 20 JSON export. 영구 링크 = HTML 보존이라 기계 판독 가능 JSON 형식 부재.

### 운영자 트랙 잔여

`/r/[shortId]` JSON export 옵션 = 베타 진입 후 사용자 요청 발생 시 별 PR. 현 시점 = Art. 20 운영자 이메일 행사로 충족 (BE APD/NL AP/LU CNPD 감독 기관 모두 "데이터 주체 요청 시 1개월 내 응답" 만 요구, 자동 export 의무 아님).

## 결정 (Decision)

### D1. 6.4 재정의 — `/account/*` 라우트 신설 거부 + 익명 모델 경로 잠금

PLAN 6.4 본문 갱신:

> **6.4** GDPR 도구 — **익명 모델 정합 경로 잠금 (ADR-0049)**: (a) Art. 13 정보 제공 = `/legal/privacy` 12항목 ✅ (ADR-0037 §D2) (b) Art. 15/17/20 = 영구 링크 `/r/[shortId]` self-service + 운영자 이메일 (kim.wonmin91@gmail.com) ✅ (c) Art. 7(3) 동의 철회 = `/unsubscribe/[token]` (ADR-0028) + CookieSettingsButton (ADR-0037 §D3) ✅ (d) `/account/export` `/account/delete` 라우트 = ADR-0007 §T1 익명 우선 + ADR-0034 §결정 5 회원가입 0 정합으로 **신설 거부** — 별 ADR-0049로 재정의. (e) **운영자 트랙 잔여**: Art. 20 JSON export 옵션 = 베타 진입 후 사용자 요청 발생 시 별 PR (BE APD/NL AP/LU CNPD 1개월 응답 의무는 이메일 행사로 충족).

### D2. ADR-0048 §D1 광의 해석 정합

본 ADR D1 = ADR-0048 §D1 "Claude 트랙 머지 완료 → 부모 [x]"의 **광의 해석 정합**. Claude 트랙 산출물 = 이미 머지된 코드/문서 cross-ref (ADR-0007/0028/0037 PR들) + 본 ADR (6.4 익명 모델 정합 잠금 문서).

### D3. PLAN 6.4 격상

6.4 [ ]→[x] 격상. 본문에 본 ADR cross-ref 명시. 합계 +1 (78 → 79, ADR-0048 §D5 11건 일괄 격상의 일부).

### D4. 향후 운영자 트랙 트리거

다음 시점에 6.4 운영자 트랙 자식 [~]→[x] 격상 검토 (별 PR):
- (a) 베타 트래픽 진입 후 Art. 20 JSON export 사용자 요청 ≥ 1건 발생
- (b) 감독 기관 (BE APD/NL AP/LU CNPD) 통보 = JSON export 요구
- (c) 회원가입 시스템 도입 시 (현 시점 0 = ADR-0034 §결정 5 organic SEO 트랙 = 회원가입 도입 ❌)

## 대안 검토

### 옵션 A (채택): 익명 모델 정합 경로 잠금 + 6.4 재정의

채택 사유: 현 시스템 GDPR 권리 행사 경로 ≥ 5종 완비 + 익명 우선 모델 정합 + ADR-0034 §결정 5 organic SEO 정합. 운영자 €300/월 cap + 솔로 사이드 부담 0.

### 옵션 B: 6.4 신설 강행 (`/account/*` 라우트 + 회원가입 시스템)

거부 사유: (1) ADR-0007 §T1 익명 우선 위반 (2) ADR-0034 §결정 5 organic SEO 회원가입 0 위반 (3) 회원가입 시스템 = 신규 PII (이메일/비밀번호) 처리 활동 = legal 검수 신규 트리거 + 외부 변호사 €800 reactivate 가능성 (4) 운영자 €300/월 cap 정합성 부족 (인증 SaaS 비용).

### 옵션 C: 6.4 보류 ([~] 또는 [ ] 유지)

거부 사유: 운영자 옵션 C 11건 일괄 격상 (ADR-0048) 의지 미달. 6.4 = 익명 모델 이미 정합이므로 [x] 격상이 P3 정직성 정합 (보류 ≠ 데이터 정직).

### 옵션 D: 6.4 [x] 격상 + ADR-0049 신설 안 함

거부 사유: PLAN 6.4 본문이 "/account/export, /account/delete"를 명시하므로 본문 갱신 + 본문 cross-ref ADR 신설이 P3 정합 (광의 해석 + 잠금 사유 문서 부재 = 정직 토큰 0).

## 영향 (Consequences)

### Blast Radius

- **편집 4 파일**:
  - `PLAN.md` — 6.4 본문 익명 모델 정합 경로 명시 + [x] 격상 + ADR-0049 cross-ref
  - `docs/adr/INDEX.md` — ADR-0049 행
  - `docs/adr/0049-gdpr-tools-anonymous-model-redefinition.md` — 본 문서 (신설)
  - `CHANGELOG.md` — 페이즈 6 부분 (scribe 트랙, 통합 ADR-0048 §D4 라운드 일부)

### 신규 파일

- 본 ADR 1개 (코드 신설 0 — 익명 모델 경로 이미 완비)

### 외부 의존성·env·마이그레이션

0건 — 문서 + PLAN 갱신만.

### 회귀 트리거

- (a) 베타 트래픽 진입 후 Art. 20 JSON export 사용자 요청 ≥ 1건 = 6.4 운영자 트랙 자식 신설 + 별 PR
- (b) 감독 기관 통보 = legal 트리거 + 6.4 운영자 트랙 자식 격상
- (c) 회원가입 시스템 도입 검토 (M24+ 시드 모금 후) = ADR-0034 §결정 5 재평가 + 본 ADR Amendment

### GATE 정의

- 운영자 직접 결정 (Pieter 2026-06-10) → 즉시 Accepted
- 6단 게이트 통과 (typecheck/lint/test:run/harness:plan/harness:data/harness:cross-ref) = ADR-0048 §V2 라운드 일부

### 검증 방법 (Verification)

- ✅ `/legal/privacy` Art. 13 12항목 노출 확인 (ADR-0037 §D2 머지)
- ✅ `/r/[shortId]` 영구 링크 사용자 self-service 동작 확인 (ADR-0007 §T6 머지 + slim.lu prod 실측)
- ✅ `/unsubscribe/[token]` 1-click unsubscribe 동작 확인 (ADR-0028 머지)
- ✅ `CookieSettingsButton` 동의 철회 동작 확인 (ADR-0037 §D3 머지)
- ✅ `kim.wonmin91@gmail.com` 운영자 이메일 = legal/privacy 페이지에 노출 확인 (ADR-0035)
- ✅ ADR-0007 §T4 90일 PII NULL화 cron 확인

## Cross-Reference

- [ADR-0007](0007-comparison-request-result-schema.md) §T1 (익명 우선) + §T4 (90일 PII NULL화 cron) + §T6 (영구 링크)
- [ADR-0028](0028-follow-up-email.md) (`/unsubscribe/[token]` Art. 7(3) 행사 경로)
- [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) §결정 5 (organic SEO, 회원가입 0)
- [ADR-0035](0035-legal-identity-disclosure-global-footer.md) (운영자 이메일 노출 footer)
- [ADR-0037](0037-public-legal-pages-and-cookie-consent.md) §D2 (Art. 13 정보 제공) + §D3 (쿠키 동의 철회)
- [ADR-0048](0048-phase-6-bulk-promotion-option-c.md) §D1 (광의 해석 정합) + §V1 (정직성 검증)
- `docs/legal/gdpr-register.md` PA-01~PA-06 (처리 활동 등록부)
- PLAN 6.4 + 작업 추적 메타 합계 표
