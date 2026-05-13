# GDPR 처리 활동 등록부 (Records of Processing Activities)

> GDPR Art. 30 — 컨트롤러의 처리 활동 기록 의무.
>
> **법적 지위:** 이 문서는 내부 1차 legal 에이전트 검토 의견이며 법률 자문이 아닙니다.
> 외부 변호사 검토(베타 직전/M16, ADR-0004 §결정 3)에서 확정됩니다.
>
> **최초 작성:** 2026-05-13 (PLAN 4.1.f legal 1차 검토)
> **최종 갱신:** 2026-05-13

---

## 컨트롤러 정보

| 항목 | 값 |
|---|---|
| 컨트롤러 명칭 | Slim (운영자: Kim Wonmin) |
| 사업자 번호 | [TVA 번호 대기 중 — 발급 후 기입] |
| 주소 | [운영자 등록 주소 — 기입 필요] |
| 연락처 | kim.wonmin91@gmail.com |
| 감독 기관 (BE) | Autorité de protection des données (APD) / Gegevensbeschermingsautoriteit (GBA) |
| 감독 기관 (NL) | Autoriteit Persoonsgegevens (AP) |
| 감독 기관 (LU) | Commission nationale pour la protection des données (CNPD) |
| DPO | 해당 없음 (GDPR Art. 37 — 소규모 솔로 사업자, 고위험 처리 없음) |

> 주의: Art. 30(5)에 따라 직원 250인 미만 사업자는 등록부 의무 면제 대상이나,
> "정기적·체계적으로 개인정보를 처리하거나 민감 정보를 처리하는 경우" 의무 부활.
> 비교 서비스 특성상 정기적 처리에 해당할 가능성이 있어 자발적 등록부 유지 권장.
> 외부 감사에서 확정 필요.

---

## 처리 활동 목록

---

### PA-01: 비교 요청 처리 (Comparison Request Processing)

**근거 ADR:** ADR-0007

| 항목 | 내용 |
|---|---|
| **처리 목적** | 사용자가 요청한 통신/에너지 등 요금제 비교 결과 계산 및 제공 |
| **합법 근거** | GDPR Art. 6(1)(b) — 비교 서비스 이용 계약 이행 (1차). Art. 6(1)(a) — 어필리에이트 리다이렉트 시 명시 동의 (보조, PA-03 참조) |
| **데이터 카테고리** | 우편번호(PC4), 가구 형태, 현재 공급사 ID, 카테고리별 사용량(데이터/분 등). PII 준식별자(quasi-identifier) 조합. IP/단말 정보 수집 없음 |
| **데이터 주체** | 비교 서비스 이용자 (게스트 — 계정 없음, 페이즈 1~5) |
| **수령자** | 없음. 외부 전송 없음 |
| **보존 기간** | 행 자체: 영구. PII 컬럼(우편번호 → PC2 일반화, 사용량 → NULL): 90일 후 cron 처리. `piiAnonymizedAt` 기록 |
| **보안 조치** | Neon Postgres (EU-Central-1, Frankfurt) 저장 암호화 at-rest + in-transit. IP 컬럼 없음. 환경별 DB 격리(ADR-0022) |
| **국외 이전** | 없음 (Neon EU 리전, Frankfurt, eu-central-1) |
| **비고** | 외부 감사 대기 항목: (1) Art. 6(1)(b) "비교 서비스 = 계약" 유효성 (EDPB Guidelines 2/2019), (2) `comparison_result` 자체의 Recital 26 익명 판정 (ADR-0007 §Legal review pending #1/#2) |

**TODO:** ADR-0007 §Legal review pending #1 (T3 합법근거) / #2 (T9 PII 판정) — 베타 직전 외부 감사 대상.

---

### PA-02: 비교 결과 영구 보존 (Comparison Result Permanent Storage)

**근거 ADR:** ADR-0007

| 항목 | 내용 |
|---|---|
| **처리 목적** | 영구 링크(`/r/[shortId]`) 제공 — 사용자가 언제든 비교 결과를 재열람 가능하게 보존 |
| **합법 근거** | GDPR Art. 6(1)(b) — 비교 서비스 이용 계약 이행 (영구 링크는 서비스의 핵심 약속). `lockedInputs`(PII 파생물): 동일 근거, 90일 후 NULL화로 최소화 |
| **데이터 카테고리** | 순위, 절약액(cents), tariff_snapshot_id, engineVersion. `lockedInputs`: 우편번호·가구형태·사용량(90일 후 NULL). IP 없음 |
| **데이터 주체** | 비교 서비스 이용자 |
| **수령자** | 없음 |
| **보존 기간** | `comparison_result` 행: 영구 (영구 링크 SLA). `lockedInputs`: 90일 후 NULL화. `comparison_result_item` 행: 영구(부모 CASCADE) |
| **보안 조치** | PA-01과 동일. `shortId` = nanoid(무작위, 추측 불가) |
| **국외 이전** | 없음 |
| **비고** | ADR-0007 §T9: `lockedInputs` 90일 후 NULL = GDPR 데이터 최소화 조치. 익명화 cron은 ADR-0008 §cron |

---

### PA-03: 어필리에이트 클릭 어트리뷰션 (Affiliate Click Attribution)

**근거 ADR:** ADR-0026 (2026-05-12 Accepted)
**Legal 1차 검토:** PLAN 4.1.f (2026-05-13)

| 항목 | 내용 |
|---|---|
| **처리 목적** | (A) 클릭 사실 기록: 사용자가 "변경하기" CTA를 통해 제휴 공급사 사이트로 이동한 사실을 어트리뷰션 목적으로 기록. (B) 정산 보존: 제휴 수수료 정산 원장 유지 (회계/세무 의무) |
| **합법 근거** | (A) 클릭 기록: Art. 6(1)(a) — 동의 인터스티셜에서 사용자 명시 동의 후 insert. `consent_given_at NOT NULL`이 스키마에서 강제. (B) 정산 필드 장기 보존: Art. 6(1)(c) — BE 회계 기록 보관 법적 의무 (invoices 10년, 일반 회계 장부 7년 — 출처: [Accountable.eu](https://www.accountable.eu/en-be/blog/legal-retention-period-invoices-belgium/), [Belgium.be](https://www.belgium.be/en/accounting_obligations)). 정확한 기간은 외부 감사 확정 필요 |
| **데이터 카테고리** | `click_token` (nanoid, 익명 식별자 — IP/세션/fingerprint 컬럼 없음), `provider_id`, `tariff_snapshot_id`, `consent_given_at`, `ref_param` (캠페인 식별자만, 사용자 식별 정보 없음), 정산 필드(`commission_amount_cents`, `commission_currency`, `commission_source`, `commission_fetched_at`, `conversion_status`, `converted_at`, `payout_batch_id`), `result_id`/`result_item_id` FK (90일 후 SET NULL), `pii_anonymized_at` |
| **데이터 주체** | 비교 이용자 (동의 후 클릭한 사람) |
| **수령자** | 없음. 제휴사로의 "전송" 없음 — 사용자가 브라우저를 통해 제휴사 사이트로 자가 이동(302 redirect). `?ref=<ref_param>`은 캠페인 식별자(Slim 내부용)만 포함, 사용자 PII 없음. GDPR상 데이터 전송(transfer) 아님 |
| **보존 기간** | `result_id`/`result_item_id` FK: 90일 후 SET NULL (ADR-0007 §T4 패턴 계승), `pii_anonymized_at` 기록. 정산 필드(`commission_*`, `payout_batch_id`, `conversion_status`, `converted_at`): Art. 6(1)(c) 회계 의무 — invoices 10년 / 일반 회계 7년 (BE 법 — 외부 감사 확정 필요). `click_token`: 익명 식별자 — 이론상 GDPR 적용 밖(Recital 26)이나 보수적으로 정산 종료 후 삭제 검토 권장 (외부 감사 대상). `consent_given_at`: Art. 7(1) 동의 증빙 — 처리 기간 내내 보존 필요 (즉, 정산 필드와 동일 기간) |
| **보안 조치** | PA-01과 동일 (Neon EU 리전). IP/fingerprint 컬럼 0(스키마 강제). 환경별 데이터 격리(ADR-0022) |
| **국외 이전** | 없음 (Neon Frankfurt EU-Central-1) |
| **비고** | Neon은 GDPR DPA 제공 (out처: [Neon DPA](https://neon.com/dpa), [Neon GDPR 블로그](https://neon.com/blog/gdpr-compliance-and-neon)). 외부 감사 대기 항목: (1) 동의 인터스티셜 유효성 (freely given·specific·informed·unambiguous), (2) BE 회계 보존 기간 정확한 구분 (invoices vs 장부 — 10년 vs 7년), (3) `click_token` 장기 보존 필요성 |

---

### PA-04: 보안 로그 (Security Logging)

| 항목 | 내용 |
|---|---|
| **처리 목적** | 보안 사고 탐지, 시스템 이상 모니터링 |
| **합법 근거** | Art. 6(1)(f) — 정당한 이익 (보안 운영) |
| **데이터 카테고리** | Sentry: 오류 스택트레이스, 익명화 IP (Sentry IP 익명화 설정 시). PostHog: 이벤트 (cookieless 모드, IP 익명화 모드 — 페이즈 6 운영 ADR 확정 필요) |
| **데이터 주체** | 서비스 이용자 |
| **수령자** | Sentry (오류 모니터링), PostHog (제품 분석) — 각각 DPA 체결 필요 |
| **보존 기간** | 각 도구 정책에 따름 (운영 ADR에서 확정 필요) |
| **국외 이전** | Sentry: 미국 법인. PostHog: EU 옵션 있음. 각 도구의 SCCs/adequacy 결정 확인 필요 |
| **비고** | TODO: 페이즈 6 운영 ADR에서 Sentry/PostHog DPA + 설정(IP 익명화/cookieless) 확정. 현재는 개략 등재 |

---

## 변경 이력

| 날짜 | 변경 내용 | 담당 |
|---|---|---|
| 2026-05-13 | 최초 신설 — PA-01(비교 요청), PA-02(비교 결과), PA-03(어트리뷰션 클릭), PA-04(보안 로그) 등재. PLAN 4.1.f legal 1차 검토 산출물 | legal 에이전트 (4.1.f) |
| 2026-05-13 | PA-03 — 4.1.d 구현 후속 검토 완료. 동의 인터스티셜 필수 5항목(EDPB Guidelines 05/2020) 및 VI.99 랭킹 공개 UI 구현 확인. ADR-0026 §검토 2/5/6 통과 판정. 외부 감사 대기 항목 7개 유지 | legal 에이전트 (4.1.d 후속) |
| 2026-05-13 | PA-03 — 4.3.d 디스클로저 페이지 본문 채움 검토 완료. `/legal/affiliate-disclosure` 가 UCPD 상업적 관계 명시 + VI.99 정렬 기준 공개 + Art. 6(1)(a)/6(1)(c) GDPR cross-ref + 다크패턴 0 충족. 처리 활동 자체(PA-03 내용) 변경 없음 — 디스클로저 노출 사이드 정합 확인만. ADR-0026 §검토 5 sub-blob 추가. 외부 감사 대기 항목 7개 유지 | legal 에이전트 (4.3.d 후속) |

---

## 외부 감사 대기 항목 (베타 직전/M16)

1. Art. 6(1)(b) "비교 서비스 = 계약" 유효성 검토 (ADR-0007 T3, EDPB Guidelines 2/2019)
2. `comparison_result` 자체의 Recital 26 익명 판정 (ADR-0007 T9)
3. BE 회계 보존 기간 정확한 구분: invoices(10년) vs 일반 회계 장부(7년) — PA-03 정산 필드 적용 기간 확정
4. 동의 인터스티셜 유효성 — freely given·specific·informed·unambiguous 4요소 (EDPB Guidelines 05/2020 on consent)
5. `click_token` 장기 보존 필요성 vs 정산 종료 후 삭제 가능 여부
6. Sentry/PostHog DPA + 국외 이전 적합성 결정 (SCCs)
7. Art. 37 DPO 의무 여부 재확인 (서비스 성장 시점 기준)
