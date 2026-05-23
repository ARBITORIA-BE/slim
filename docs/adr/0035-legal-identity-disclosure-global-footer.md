# ADR-0035: 사업자 식별정보 공개 — 단일 출처 `LEGAL_ENTITY` + 전역 Footer

- **상태**: Proposed (2026-05-23, Pieter 세션 — 운영자 방향 승인: 전역 footer + 주소 포함. legal 에이전트 검수 + 등록 주소 수령 시 Accepted)
- **발행**: 2026-05-23
- **결정자**: 운영자(Kim Wonmin) 방향 승인 + Pieter 적용 (architect 설계)
- **PLAN**: §4.10 (a~f)

---

## 맥락

운영자가 벨기에 개인사업자 식별번호를 제공했다 (2026-05-23):

- 회사번호 (KBO/BCE enterprise number): `1037548919` (관례 표기 `1037.548.919`)
- TVA/VAT: `BE1037548919` (관례 표기 `BE 1037.548.919`)
- 법인명: 개인사업자 → 운영자 성명 (Kim Wonmin)
- 연락 이메일: kim.wonmin91@gmail.com

**법적 요구**: 벨기에 경제법전(Code de droit économique / Wetboek van economisch recht)

- **Art. III.74** — 기업(KBO/BCE)에 등록된 사업자는 기업번호를 명시해야 한다.
- **Book XII (Art. XII.6)** — 정보사회 서비스(상업 웹사이트) 제공자는 상호·지리적 주소·연락처(이메일)·기업번호·VAT 번호를 **쉽고 직접적이며 상시 접근 가능하게** 제공해야 한다.

현황 문제:

1. **식별정보 단일 출처 부재** — 회사번호/VAT를 담는 상수가 없다 (`src/lib/site.ts`엔 `SITE_ORIGIN`만).
2. **전역 footer 부재** — `affiliate-disclosure`, `data-sources` 페이지가 각자 인라인 `<footer>`만 가짐. "모든 페이지 상시 접근" 요건 미충족.
3. **공개 locale = nl/fr/en** (ADR-0033/0034) — 식별정보 *라벨*을 한국어로 하드코딩하면 공개 네덜란드어 사이트에 한국어가 노출된다.

헌법 P3(투명성은 운영자의 짐) 정합 — 사업자 정보를 데이터로 보여준다.

---

## 결정

### D1. 단일 출처 — `src/lib/legal.ts`

`LEGAL_ENTITY` 상수 1개가 모든 소비처(전역 footer, 법무 페이지, 향후 인보이스)의 단일 출처다. `SITE_ORIGIN` 단일화 패턴과 동형.

```ts
export const LEGAL_ENTITY: LegalEntity = {
  legalName: 'Kim Wonmin',
  enterpriseNumber: '1037548919',   // raw
  vatNumber: 'BE1037548919',        // raw
  address: null,                    // ⚠️ 미수령 — P1, 추측 금지
  contactEmail: 'kim.wonmin91@gmail.com',
};
```

- 값은 **raw**로 저장, 표기 헬퍼 `formatEnterpriseNumber`(→ `1037.548.919`)·`formatVatNumber`(→ `BE 1037.548.919`)가 관례 표기를 생성. 잘못된 형식은 가공하지 않고 raw 반환 (헌법 §8 #2).
- VAT = `BE` + 기업번호 일관성을 단위 테스트가 강제.

### D2. 전역 Footer — `src/components/SiteFooter.tsx` (RSC)

- `[locale]/layout.tsx`의 `{children}` 다음에 1회 렌더 → 전 페이지 하단 노출 (Art. XII.6 "상시 접근").
- RSC — 상호작용 0 → 클라이언트 JS 0 추가 (LCP/번들 예산 보호, 헌법 P2).
- 렌더 항목: 법인명 · 기업번호 · VAT · (주소) · 연락 이메일 + 법무/투명성 링크(`/legal/affiliate-disclosure`, `/data-sources`).
- `address: null`이면 **주소 줄 비노출** — placeholder/추측 주소를 표시하지 않는다 (P1).
- 기존 페이지별 인라인 `<footer>`(백링크)는 유지 — 중복이 아니라 페이지 내 네비.

### D3. i18n — `footer.*` 일반 트랙

- 식별정보 *값*은 locale 무관(LEGAL_ENTITY) → **라벨만** `footer.*` 네임스페이스 키화 (`messages/{ko,nl,fr,en}.json`).
- `getTranslations('footer')` (RSC) 소비. region delta(nl-BE 등)는 base 병합으로 상속 — base 4파일만 편집.
- footer 식별 라벨은 **비-legal UI 셸** → `footer.*` 일반 트랙. 약관/디스클로저 *본문*의 `legal.*` 검수 게이트(ADR-0033 §T4 / PLAN 4.5.j.3)와 경계 분리.

---

## 대안 (거부)

- **A. 식별번호를 페이지마다 하드코딩** — 오타·불일치 리스크, 단일 출처 위반.
- **B. 전역 footer 없이 법무 페이지에만 표기** — 메인/비교 페이지에서 식별정보 미노출 → Art. XII.6 "모든 페이지 접근" 부분 미충족.
- **C. footer 라벨 한국어 하드코딩** — 공개 nl/fr/en 사이트에 한국어 노출 (SEO·법적 부적절).
- **D. 추측/placeholder 주소 표시** — 허위 식별정보 게시 = 법적 리스크 + P1 위반. **명시 거부**.

---

## 결과

✅ 단일 출처로 식별정보 일관성 확보. ✅ 전 페이지 상시 노출 (Art. XII.6 핵심 충족). ✅ 다국어 라벨 정합 (공개 locale 일관).

⚠️ **등록 주소 미수령** → `address: null`. 주소 줄 비노출 = Art. XII.6 *부분* 충족. 운영자 주소 제공 시 `LEGAL_ENTITY.address` 1줄 변경으로 완전 충족.
⚠️ **legal 미검수** — 라벨 정확성·노출 충분성·등록기관 표기(RPM 불어/RPR 화란) 필요 여부는 architect 1차 판단(추정). legal 에이전트(PLAN 4.10.f) + 외부 변호사 감사(베타 직전/수익 후)가 최종.
⚠️ 외부 의존성·env 추가 0건 (자동배포 fail-closed 리스크 낮음).

---

## 검증 (PLAN 4.10.e)

1. `pnpm typecheck` / `pnpm lint` / `pnpm test:run` 0 (legal.ts + SiteFooter 단위 테스트 포함).
2. `pnpm harness:i18n` GREEN (SiteFooter는 `src/components` — 스캔 밖이나 정합).
3. `pnpm harness:plan` — 합계 89/58 정합 (4.10 +1).
4. Vercel 배포 URL에서 전 페이지 footer 렌더 + 식별번호 표기 확인 (로컬 build 깨짐 — WasmHash).
5. legal 에이전트 검수 (4.10.f).

---

## 출처

- Belgian Code of Economic Law, Book XII (정보사회 서비스 제공자 정보 의무) — Art. XII.6.
- Belgian Code of Economic Law, Book III — Art. III.74 (기업번호 명시).
- business.belgium.be — Company (enterprise) number.
- digitalwallonia.be — Informations obligatoires site e-commerce.

> ⚠️ WebSearch 1차 근거 — 조항 번호·표시 *방식*의 충분성은 해석 영역. legal 에이전트/외부 감사가 최종 확정.
