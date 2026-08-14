/**
 * /guides/proximus-vs-telenet-vs-orange-be — TSX 정적 가이드 페이지
 * (ADR-0051 §Amendment 1 정합).
 *
 * 왜 TSX 정적 라우트인가?
 *   MDX + [slug] dynamic route 조합이 Vercel prod 404 회귀 (PR #70/#72/#73
 *   2회 hotfix 실패) → 옵션 2 (TSX 정적 라우트) 이전.
 *   Next.js 정적 라우트 = 검증된 패턴 + LCP 이상적 + 런타임 fs 접근 0.
 *
 * 왜 명시 Tailwind 클래스인가? (2026-08 fix)
 *   `prose prose-neutral` 은 `@tailwindcss/typography` plugin 미설치로 미작동.
 *   명시 클래스로 h2/p/table/ul 스타일 지정 → 표가 텍스트로 보이던 회귀 봉합.
 *
 * 다크패턴 회피 잠금 (ADR-0050 §D6 동형): 1위 임의 하이라이트 0 /
 * "추천" 라벨 0 / 색상 다중화 0 — 표 정렬은 factual only.
 *
 * i18n rewiring (PLAN 4.23.a — ADR-0051 §D2 + Amendment 1 §A1.B):
 *   본문 전체가 `guides.proximusVsTelenetVsOrangeBe.*` (en 정본, ko 예외 —
 *   messages/ko.json 은 `_comment` 로 스킵 명시) 를 `t()` / `t.rich()` 로
 *   소비한다. 표 셀은 행·셀 개별 key (`tables.{id}.row{N}.col{M}`).
 *   인라인 마크업(strong/em/Link)이 낀 문장은 `t.rich()` 로 태그를 그대로
 *   메시지 문자열 안에 남기고, 렌더러만 이 파일에서 정의한다
 *   (예: `<strong>...</strong>` → richStrong.strong).
 *   내부 라우트 링크(예: /compare/mobile)의 표시 텍스트는 경로 슬러그
 *   자체라 자연어가 아니므로 렌더러가 고정 텍스트로 렌더 — 번역 대상에서
 *   제외 (건드리면 라우트 표시가 오역될 위험, 재량 판단).
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';

import { buildAlternates } from '@/lib/alternates';
import { Link } from '@/i18n/navigation';
import { GUIDE_INDEX } from '@/lib/guides-index';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const SLUG = 'proximus-vs-telenet-vs-orange-be';

/**
 * GUIDE_INDEX 단일 출처에서 본 가이드 메타 조회 (sitemap.ts 와 중복 방지).
 */
const GUIDE_META = (() => {
  const entry = GUIDE_INDEX.find((g) => g.slug === SLUG);
  if (!entry) {
    throw new Error(
      `[guides/${SLUG}] missing entry in GUIDE_INDEX — check src/lib/guides-index.ts.`,
    );
  }
  return entry;
})();

// 명시 클래스 (prose plugin 미작동 회귀 봉합)
const P_CLASS = 'mb-4 text-base leading-7 text-fg/80';
const H2_CLASS = 'mt-10 mb-4 text-2xl font-bold text-fg';
const TABLE_WRAP = 'my-6 overflow-x-auto';
const TABLE_CLASS = 'w-full border-collapse text-sm';
const TH_CLASS = 'border-b-2 border-fg/25 bg-bg-warm/50 px-3 py-2 text-left font-semibold text-fg';
const TD_CLASS = 'border-b border-fg/10 px-3 py-2 align-top text-fg/80';
const UL_CLASS = 'mb-4 list-disc space-y-2 pl-6 text-fg/80';
const LI_CLASS = 'leading-7';
const LINK_CLASS = 'text-primary hover:underline';

// ─── t.rich 렌더러 (guides.proximusVsTelenetVsOrangeBe.* 인라인 마크업) ──────
// 왜 모듈 스코프인가: 여러 t.rich 호출에서 재사용 (strong 은 다수 문단에서 반복).

const richStrong = {
  strong: (chunks: ReactNode) => <strong className="font-semibold text-fg">{chunks}</strong>,
};

// section1.para4 — 링크 표시 텍스트 = 경로 슬러그 그대로 (번역 비대상, 위 헤더 코멘트 참조).
const richSection1Para4 = {
  link1: () => (
    <Link href="/compare/mobile" className={LINK_CLASS}>
      /compare/mobile
    </Link>
  ),
  link2: () => (
    <Link href="/compare/internet_fixed" className={LINK_CLASS}>
      /compare/internet_fixed
    </Link>
  ),
};

// section3.para3 — 링크 표시 텍스트 = 경로 슬러그 그대로.
const richSection3Para3 = {
  link1: () => (
    <Link href="/data-sources" className={LINK_CLASS}>
      /data-sources
    </Link>
  ),
};

// footer.disclaimer — em 래핑 + "affiliate disclosure" 는 자연어 링크 텍스트 → chunks 그대로 렌더.
const richFooterDisclaimer = {
  em: (chunks: ReactNode) => <em>{chunks}</em>,
  link1: (chunks: ReactNode) => (
    <Link href="/legal/affiliate-disclosure" className={LINK_CLASS}>
      {chunks}
    </Link>
  ),
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const alts = buildAlternates(locale, `/guides/${SLUG}`);
  return {
    title: GUIDE_META.title,
    description: GUIDE_META.description,
    alternates: alts,
  };
}

export default async function ProximusVsTelenetVsOrangeBePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guides' });
  const tg = await getTranslations({
    locale,
    namespace: 'guides.proximusVsTelenetVsOrangeBe',
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="mb-3 text-3xl font-bold leading-tight text-fg">
          {GUIDE_META.title}
        </h1>
        <p className="mb-4 text-base text-fg/70">{GUIDE_META.description}</p>
        <div className="flex gap-4 text-sm text-fg/50">
          <span>{t('publishedAt', { date: GUIDE_META.publishedAt })}</span>
          <span>{t('author', { name: GUIDE_META.author })}</span>
        </div>
      </header>

      <article className="max-w-none">
        <p className={P_CLASS}>{tg.rich('intro.para1', richStrong)}</p>

        <h2 className={H2_CLASS}>{tg('section1.heading')}</h2>
        <p className={P_CLASS}>{tg.rich('section1.para1', richStrong)}</p>
        <div className={TABLE_WRAP}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>{tg('tables.priceComparison.header.col1')}</th>
                <th className={TH_CLASS}>{tg('tables.priceComparison.header.col2')}</th>
                <th className={TH_CLASS}>{tg('tables.priceComparison.header.col3')}</th>
                <th className={TH_CLASS}>{tg('tables.priceComparison.header.col4')}</th>
              </tr>
            </thead>
            <tbody>
              {(['row1', 'row2', 'row3', 'row4', 'row5', 'row6', 'row7'] as const).map((row) => (
                <tr key={row}>
                  <td className={TD_CLASS}>{tg(`tables.priceComparison.${row}.col1`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.priceComparison.${row}.col2`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.priceComparison.${row}.col3`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.priceComparison.${row}.col4`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={P_CLASS}>{tg.rich('section1.para2', richStrong)}</p>
        <p className={P_CLASS}>{tg.rich('section1.para3', richStrong)}</p>
        <p className={P_CLASS}>{tg.rich('section1.para4', richSection1Para4)}</p>

        <h2 className={H2_CLASS}>{tg('section2.heading')}</h2>
        <p className={P_CLASS}>{tg.rich('section2.para1', richStrong)}</p>
        <div className={TABLE_WRAP}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>{tg('tables.contractTerms.header.col1')}</th>
                <th className={TH_CLASS}>{tg('tables.contractTerms.header.col2')}</th>
                <th className={TH_CLASS}>{tg('tables.contractTerms.header.col3')}</th>
                <th className={TH_CLASS}>{tg('tables.contractTerms.header.col4')}</th>
              </tr>
            </thead>
            <tbody>
              {(['row1', 'row2', 'row3', 'row4', 'row5'] as const).map((row) => (
                <tr key={row}>
                  <td className={TD_CLASS}>{tg(`tables.contractTerms.${row}.col1`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.contractTerms.${row}.col2`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.contractTerms.${row}.col3`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.contractTerms.${row}.col4`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={P_CLASS}>{tg.rich('section2.para2', richStrong)}</p>

        <h2 className={H2_CLASS}>{tg('section3.heading')}</h2>
        <p className={P_CLASS}>{tg.rich('section3.para1', richStrong)}</p>
        <div className={TABLE_WRAP}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>{tg('tables.coverage.header.col1')}</th>
                <th className={TH_CLASS}>{tg('tables.coverage.header.col2')}</th>
                <th className={TH_CLASS}>{tg('tables.coverage.header.col3')}</th>
                <th className={TH_CLASS}>{tg('tables.coverage.header.col4')}</th>
              </tr>
            </thead>
            <tbody>
              {(['row1', 'row2', 'row3', 'row4', 'row5', 'row6'] as const).map((row) => (
                <tr key={row}>
                  <td className={TD_CLASS}>{tg(`tables.coverage.${row}.col1`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.coverage.${row}.col2`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.coverage.${row}.col3`)}</td>
                  <td className={TD_CLASS}>{tg(`tables.coverage.${row}.col4`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={P_CLASS}>{tg.rich('section3.para2', richStrong)}</p>
        <p className={P_CLASS}>{tg.rich('section3.para3', richSection3Para3)}</p>

        <h2 className={H2_CLASS}>{tg('section4.heading')}</h2>
        <p className={P_CLASS}>{tg('section4.para1')}</p>
        <div className={TABLE_WRAP}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>{tg('tables.householdFit.header.col1')}</th>
                <th className={TH_CLASS}>{tg('tables.householdFit.header.col2')}</th>
                <th className={TH_CLASS}>{tg('tables.householdFit.header.col3')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={TD_CLASS}>{tg('tables.householdFit.row1.col1')}</td>
                <td className={TD_CLASS}>{tg('tables.householdFit.row1.col2')}</td>
                <td className={TD_CLASS}>
                  <Link href="/compare/mobile" className={LINK_CLASS}>
                    /compare/mobile
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>{tg('tables.householdFit.row2.col1')}</td>
                <td className={TD_CLASS}>{tg('tables.householdFit.row2.col2')}</td>
                <td className={TD_CLASS}>
                  <Link href="/compare/bundle_mobile_internet" className={LINK_CLASS}>
                    /compare/bundle_mobile_internet
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>{tg('tables.householdFit.row3.col1')}</td>
                <td className={TD_CLASS}>{tg('tables.householdFit.row3.col2')}</td>
                <td className={TD_CLASS}>
                  <Link href="/compare/bundle_mobile_internet_tv" className={LINK_CLASS}>
                    /compare/bundle_mobile_internet_tv
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>{tg('tables.householdFit.row4.col1')}</td>
                <td className={TD_CLASS}>{tg('tables.householdFit.row4.col2')}</td>
                <td className={TD_CLASS}>{tg('tables.householdFit.row4.col3')}</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>{tg('tables.householdFit.row5.col1')}</td>
                <td className={TD_CLASS}>{tg('tables.householdFit.row5.col2')}</td>
                <td className={TD_CLASS}>{tg('tables.householdFit.row5.col3')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={P_CLASS}>{tg('section4.para2')}</p>

        <h2 className={H2_CLASS}>{tg('section5.heading')}</h2>
        <p className={P_CLASS}>{tg('section5.para1')}</p>
        <p className={P_CLASS}>{tg('section5.para2')}</p>
        <ul className={UL_CLASS}>
          <li className={LI_CLASS}>{tg.rich('section5.li1', richStrong)}</li>
          <li className={LI_CLASS}>{tg.rich('section5.li2', richStrong)}</li>
        </ul>
        <p className={P_CLASS}>{tg('section5.para3')}</p>

        <p className="mt-8 text-sm text-fg/60">
          {tg.rich('footer.disclaimer', richFooterDisclaimer)}
        </p>
      </article>
    </main>
  );
}
