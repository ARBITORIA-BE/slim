/**
 * /legal/affiliate-disclosure — 어필리에이트 수수료 공개 (PLAN 4.3.d).
 *
 * 왜 이 페이지가 필요한가?
 *   헌법 §3 P3: "모든 제휴 수수료는 비교 결과 페이지 하단에 단가까지 공개."
 *   ADR-0026 §T4 + §검토 5 (UCPD + BE CDE VI.99): 수수료 공개 + 정렬 기준 명시 의무.
 *   ADR-0027 §T1~T5: affiliateRates 가 단일 출처 — 이 페이지가 그대로 렌더.
 *   헌법 §8 #4 광고-비교 분리: "비교 순위는 절약액 알고리즘 단일" 명시.
 *
 * 이 페이지는 4.3.c AffiliateDisclosureLine 의 "/legal/affiliate-disclosure" 링크의 도착지다.
 * (코드 cross-ref — 사용자에게 노출 X)
 *
 * RSC — affiliateRates 정적 import, 동적 데이터 없음. revalidate 불필요.
 */

import type { Metadata } from 'next';

import { affiliateRates } from '@/data/affiliate-rates';
import { formatEuroCents } from '@/lib/format-eur';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: '제휴 수수료 공개',
  description:
    'Slim의 제휴(어필리에이트) 수수료 구조와 비교 결과 순위 알고리즘 독립성을 투명하게 공개합니다.',
  alternates: {
    canonical: '/legal/affiliate-disclosure',
  },
};

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

/**
 * providerId 를 사람이 읽기 좋은 표시명으로 변환 (정책 C 채택).
 *
 * 왜 정책 C인가:
 *   (a) 매핑 테이블: 별도 유지보수 부담. (b) providerName 필드 추가: ADR-0027 §T2 수정 필요.
 *   (c) 문자열 케이스 변환: 단순하고, placeholder 라는 점이 표시명에 노출되어 정직성 일관.
 *   실 UUID가 들어왔을 때의 표시명 매핑은 4.3.b 후속 PR (실 providerId 등록 시점)에서 해결.
 *
 * 예: "placeholder-proximus-be" → "Placeholder Proximus Be"
 */
function formatProviderId(providerId: string): string {
  return providerId
    .split('-')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

/**
 * effectiveTo 날짜 표시 (없으면 "—").
 * ISO 8601 date 문자열을 그대로 표시 — 별도 파싱 없음.
 */
function formatEffectiveTo(effectiveTo: string | undefined): string {
  return effectiveTo ?? '—';
}

/**
 * 모든 entry 의 source 가 'placeholder' 로 시작하는지 확인.
 * placeholder-only 상태면 알림 배너를 표시한다.
 */
function isPlaceholderOnly(rates: typeof affiliateRates): boolean {
  if (rates.length === 0) return false;
  return rates.every((r) => r.source.startsWith('placeholder'));
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export default function AffiliatePage() {
  const rates = affiliateRates;
  const showPlaceholderBanner = isPlaceholderOnly(rates);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          제휴 수수료 공개
        </h1>
        <p className="text-sm text-fg-soft">
          헌법 §3 P3: &quot;투명성은 운영자의 짐. 데이터로 보여준다.&quot;
        </p>
      </header>

      <section className="flex flex-col gap-8 text-sm leading-relaxed text-fg-soft">

        {/* ── 1. 상업적 관계 명시 (UCPD) ──────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">상업적 관계 명시</h2>
          <p className="mb-2">
            Slim은 어필리에이트 수수료를 받는 비교 서비스입니다. 사용자가 결과 페이지에서
            &apos;변경하기&apos;를 누르고 동의한 후 공급사 사이트에서 계약을 체결하는 경우,
            일부 공급사로부터 Slim이 수수료를 받습니다.
          </p>
          <p>
            이 수수료는 사용자의 요금에 영향을 주지 않습니다. 수수료를 받더라도
            비교 결과 순위는 어필리에이트 여부와 무관하게 알고리즘이 결정합니다.
            거부해도 비교 결과는 그대로 유지됩니다.
          </p>
        </div>

        {/* ── 2. 순위 알고리즘 독립성 (BE CDE VI.99 + 헌법 §8 #4) ──────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">
            비교 순위 알고리즘 독립성
          </h2>
          <p className="mb-2">
            비교 결과 순위는 <strong className="text-fg">절약액 내림차순</strong> 단일 기준입니다.
            어필리에이트 여부 / 수수료 수령 여부는 순위에 영향을 주지 않습니다.
          </p>
          <p className="mb-2">
            이 분리는 코드 차원에서 강제됩니다 —{' '}
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              src/engine/compare.ts
            </code>
            가{' '}
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              affiliate_status
            </code>{' '}
            /{' '}
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              affiliate_click
            </code>{' '}
            모듈을 import 하지 않음을 단위 테스트 (
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              src/engine/compare.isolation.test.ts
            </code>
            ) 가 6 토큰 × 정적 grep + enum 6값 × behavioral 두 방식으로 검증합니다.
          </p>
          <p>
            Slim은 광고 영역과 비교 영역을 혼합하지 않습니다 (헌법 §8 #4).
            비교 결과는 100% 알고리즘 결과입니다.
          </p>
        </div>

        {/* ── 3. 인터스티셜 카피 cross-ref (4.1.d 일관성) ──────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">동의 인터스티셜과의 정합</h2>
          <p>
            이 페이지의 원칙은 &apos;변경하기&apos; 버튼 클릭 시 표시되는 동의 인터스티셜(
            <code className="rounded bg-bg-warm/80 px-1 py-0.5 font-mono text-xs">
              /go/...
            </code>
            )의 카피와 정합합니다. 두 곳 모두 같은 원칙(전송 데이터 없음, 거부해도
            순위/결과 변동 없음, 비교 알고리즘 독립성)을 따릅니다.
          </p>
        </div>

        {/* ── 4. GDPR / 보존 cross-ref ──────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">GDPR 및 데이터 보존</h2>
          <p>
            어필리에이트 클릭 기록의 GDPR 합법근거(Art. 6(1)(a) 동의)와 보존 정책
            (90일 SET NULL → 익명 회계 원장 분리 보존)은 개인정보처리방침의 어필리에이트
            섹션에 정합합니다.
          </p>
        </div>

        {/* ── 5. 수수료 단가 표 (ADR-0027 §T1 — 데이터 소스에서 렌더) ──── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">공급사별 수수료 단가</h2>

          {/* placeholder-only 알림 배너 — 실 entry 추가 시 자동 사라짐 */}
          {showPlaceholderBanner && (
            <div
              role="note"
              aria-label="개발용 placeholder 단가 안내"
              className="mb-4 rounded-2xl border border-fg/10 bg-bg-warm/60 p-4 text-sm"
            >
              현재 표시된 단가는{' '}
              <em>개발용 placeholder</em>입니다 — 베타 직전 실 계약 단가로
              교체됩니다 (ADR-0027 §T1 운영자 PR 1건).
            </div>
          )}

          {rates.length === 0 ? (
            /* 빈 배열: 활성 계약 없음 */
            <p>현재 활성 어필리에이트 계약이 없습니다.</p>
          ) : (
            /* 표: commissionType === 'CPA' 만 (ADR-0027 §T2 CPA literal 강제) */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-fg/10">
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      공급사
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      유형
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      단가
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      통화
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      출처
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      확인 일자
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-fg">
                      발효 일자
                    </th>
                    <th scope="col" className="py-2 text-left font-semibold text-fg">
                      만료 일자
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rates
                    .filter((r) => r.commissionType === 'CPA')
                    .map((rate) => (
                      <tr
                        key={rate.providerId}
                        className="border-b border-fg/5 last:border-0"
                      >
                        <td className="py-2 pr-3">{formatProviderId(rate.providerId)}</td>
                        <td className="py-2 pr-3">{rate.commissionType}</td>
                        <td className="py-2 pr-3">{formatEuroCents(rate.amountCents)}</td>
                        <td className="py-2 pr-3">{rate.currency}</td>
                        <td className="py-2 pr-3 max-w-[12rem] truncate" title={rate.source}>
                          {rate.source}
                        </td>
                        <td className="py-2 pr-3">{rate.fetchedAt}</td>
                        <td className="py-2 pr-3">{rate.effectiveFrom}</td>
                        <td className="py-2">{formatEffectiveTo(rate.effectiveTo)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 6. 문의 ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 font-semibold text-fg">문의</h2>
          <p>
            어필리에이트 정책 관련 문의:{' '}
            <a
              href="mailto:kim.wonmin91@gmail.com"
              className="underline underline-offset-4 hover:text-fg"
            >
              kim.wonmin91@gmail.com
            </a>
          </p>
        </div>
      </section>

      {/* ── footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-10 border-t border-fg/10 pt-4 text-xs text-fg-soft">
        <Link
          href="/data-sources"
          className="underline-offset-4 hover:underline"
        >
          ← 데이터 출처로 돌아가기
        </Link>
      </footer>
    </main>
  );
}
