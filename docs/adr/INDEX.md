# ADR Index

이 문서는 Slim 프로젝트의 모든 Architectural Decision Records를 인덱싱합니다.
각 ADR은 설계 결정의 근거, 대안 검토, 장단점을 기록합니다.

---

## 현황

| ID | 제목 | 상태 | 발행 |
|---|---|---|---|
| [ADR-0001](0001-provider-schema.md) | `provider` 테이블 스키마 (공급사 마스터) | Accepted | 2026-05-09 |

---

## 설명

### [ADR-0001: `provider` 테이블 스키마](0001-provider-schema.md)

**상태**: Accepted (verifier 통과: typecheck/lint/test/migration-sql/harness:plan 모두 통과)

**요약**: PLAN 항목 1.1의 첫 테이블. 베네룩스 공급사 마스터 데이터. 세무 처리(BTW 21% vs 0% 리버스 차지)를 분기하는 6값 `affiliate_status` enum으로 설계. VIES VAT ID 검증 시각 추적 (`vat_id_verified_at`). 비교 제외 사유 공개 (`excluded_reason`) — P3 투명성 강제.

**영향**: 1.2 `tariff`, 1.3 `tariff_snapshot`, 4.1 `affiliate_click` 후속 테이블의 기초.
