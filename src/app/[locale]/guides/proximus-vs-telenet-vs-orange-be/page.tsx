/**
 * /guides/proximus-vs-telenet-vs-orange-be — TSX 정적 가이드 페이지
 * (ADR-0051 §Amendment 1 정합).
 *
 * 왜 TSX 정적 라우트인가?
 *   MDX + [slug] dynamic route 조합이 Vercel prod 404 회귀 (PR #70/#72/#73
 *   2회 hotfix 실패) → 옵션 2 (TSX 정적 라우트) 이전.
 *   Next.js 정적 라우트 = 검증된 패턴 + LCP 이상적 + 런타임 fs 접근 0.
 *
 * 본문 = 운영자 직접 작성 트랙 (2-4시간, head term 콘텐츠).
 * 현재 = 스켈레톤 (섹션 헤딩 + placeholder). ADR-0029 §T2 정직성 정합.
 *
 * 다크패턴 회피 잠금 (ADR-0050 §D6 동형): 1위 임의 하이라이트 0 /
 * "추천" 라벨 0 / 색상 다중화 0 — 본 페이지는 단일 가이드 본문, 해당 없음.
 */

import type { Metadata } from 'next';
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
 *
 * 왜 즉시실행함수인가?
 *   `noUncheckedIndexedAccess` 하에서 `Array.find` 결과는 `T | undefined`.
 *   모듈 스코프 `if (!x) throw` 의 narrowing 은 함수 스코프를 넘어 전파되지
 *   않으므로, 즉시실행함수로 감싸 반환 타입을 non-null `GuideIndexEntry` 로
 *   확정한다 (빌드 타임 자가검증 — GUIDE_INDEX 누락 시 즉시 실패, 조용한
 *   404 방지).
 */
const GUIDE_META = (() => {
  const entry = GUIDE_INDEX.find((g) => g.slug === SLUG);
  if (!entry) {
    // Build-time self-check only (never user-facing) — kept in English so
    // harness:i18n's Korean-literal scan (src/app/[locale]/**) stays clean.
    throw new Error(
      `[guides/${SLUG}] missing entry in GUIDE_INDEX — check src/lib/guides-index.ts.`,
    );
  }
  return entry;
})();

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

      <article className="prose prose-neutral max-w-none">
        <p>
          Belgium&apos;s residential telecom market is dominated by three
          operators: <strong>Proximus</strong>, <strong>Telenet</strong>, and{' '}
          <strong>Orange Belgium</strong>. Together they cover more than 97% of
          households (Mordor Intelligence Q1 2025). Choosing between them is
          rarely a &ldquo;best overall&rdquo; question &mdash; it depends on
          where you live, what you already own, and whether you need mobile,
          fixed internet, TV, or all three. This guide compares them honestly,
          without paid rankings, so you can pick the operator that fits your
          household.
        </p>

        <h2>1. Price comparison &mdash; mobile, internet, bundles</h2>
        <p>
          Belgian telecom prices sit in narrow bands across the three
          operators. The typical entry-tier ranges (at time of writing) look
          like this:
        </p>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Proximus</th>
              <th>Telenet</th>
              <th>Orange Belgium</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mobile (entry)</td>
              <td>~€15+/mo</td>
              <td>~€15+/mo</td>
              <td>~€15+/mo</td>
            </tr>
            <tr>
              <td>Internet, fibre entry</td>
              <td>~€38+/mo</td>
              <td>~€40+/mo</td>
              <td>~€38+/mo</td>
            </tr>
            <tr>
              <td>Internet, gigabit tier</td>
              <td>~€60&ndash;€70/mo</td>
              <td>~€60&ndash;€70/mo</td>
              <td>~€57+/mo (Giga)</td>
            </tr>
            <tr>
              <td>Bundle (mobile + internet)</td>
              <td>&minus;€10 to &minus;€20 vs parts</td>
              <td>&minus;€10 to &minus;€20 vs parts</td>
              <td>&minus;€10 to &minus;€20 vs parts</td>
            </tr>
          </tbody>
        </table>
        <p>
          Because prices move &mdash; sometimes weekly &mdash; a static
          table like this is out of date within a month. We keep the live
          data on{' '}
          <Link href="/compare/mobile" className="text-primary hover:underline">
            /compare/mobile
          </Link>
          ,{' '}
          <Link
            href="/compare/internet_fixed"
            className="text-primary hover:underline"
          >
            /compare/internet_fixed
          </Link>
          , and the three bundle categories. Every price there carries its
          source URL and the timestamp of the last fetch, so you can check
          the official operator page yourself.
        </p>

        <h2>2. Contract terms &mdash; 12 months, 24 months, or no contract</h2>
        <p>
          The three operators offer a similar menu with different defaults:
        </p>
        <table>
          <thead>
            <tr>
              <th>Contract length</th>
              <th>Proximus</th>
              <th>Telenet</th>
              <th>Orange Belgium</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>24-month (with modem/install discount)</td>
              <td>Common default for bundles</td>
              <td>Common default for bundles</td>
              <td>Available, less pushed</td>
            </tr>
            <tr>
              <td>12-month</td>
              <td>Available</td>
              <td>Available</td>
              <td>Available</td>
            </tr>
            <tr>
              <td>No contract</td>
              <td>Higher monthly price</td>
              <td>Higher monthly price</td>
              <td>Increasingly the default</td>
            </tr>
          </tbody>
        </table>
        <p>
          The right pick depends on your risk tolerance. Staying two years
          in the same home &rArr; a 24-month contract usually wins on total
          cost. Renting, moving often, or testing an operator &rArr; a
          no-contract or 12-month plan protects you from early-termination
          fees. Belgian consumer law caps those fees after month 6, but the
          practical maths still favours matching contract length to your
          actual plans.
        </p>

        <h2>3. Data freshness &amp; how we compare</h2>
        <p>
          Slim compares the three operators using their public pricing
          pages. Every 24 hours the fetcher visits each site, parses the
          current tariffs, and stores them with the source URL and a UTC
          timestamp. Nothing hand-edited, nothing inferred.
        </p>
        <table>
          <thead>
            <tr>
              <th>Aspect</th>
              <th>Proximus</th>
              <th>Telenet</th>
              <th>Orange Belgium</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Data method</td>
              <td>HTML scraping</td>
              <td>Official API</td>
              <td>HTML scraping (fixed internet only)</td>
            </tr>
            <tr>
              <td>Update frequency</td>
              <td>Every 24h</td>
              <td>Every 24h</td>
              <td>Every 24h</td>
            </tr>
            <tr>
              <td>Mobile covered on Slim</td>
              <td>Yes</td>
              <td>Yes</td>
              <td>Not yet (JS-rendered page)</td>
            </tr>
            <tr>
              <td>Region</td>
              <td>Belgium-wide</td>
              <td>Flanders + Brussels only</td>
              <td>Belgium-wide (Voo absorbed 2025)</td>
            </tr>
          </tbody>
        </table>
        <p>
          Mobile Vikings, Scarlet, hey!, and other smaller Belgian operators
          are not yet compared &mdash; see the full exclusion list on{' '}
          <Link
            href="/data-sources"
            className="text-primary hover:underline"
          >
            /data-sources
          </Link>
          . If an operator is missing, we say so.
        </p>

        <h2>4. Which operator fits your household?</h2>
        <p>
          Rather than crown a single winner, here is a practical decision
          matrix based on the household you actually have:
        </p>
        <table>
          <thead>
            <tr>
              <th>Household situation</th>
              <th>Best fit</th>
              <th>Where to compare</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Single, urban, mobile-first</td>
              <td>Any of 3 entry mobile plans (compare data allowance, not headline price)</td>
              <td>
                <Link
                  href="/compare/mobile"
                  className="text-primary hover:underline"
                >
                  /compare/mobile
                </Link>
              </td>
            </tr>
            <tr>
              <td>Couple, one home, no TV</td>
              <td>Mobile + internet duo (skip TV channel packs)</td>
              <td>
                <Link
                  href="/compare/bundle_mobile_internet"
                  className="text-primary hover:underline"
                >
                  /compare/bundle_mobile_internet
                </Link>
              </td>
            </tr>
            <tr>
              <td>Family with kids, TV matters</td>
              <td>Triple play (mobile + internet + TV) &mdash; check channel packs you already own</td>
              <td>
                <Link
                  href="/compare/bundle_mobile_internet_tv"
                  className="text-primary hover:underline"
                >
                  /compare/bundle_mobile_internet_tv
                </Link>
              </td>
            </tr>
            <tr>
              <td>Renter or planning to move</td>
              <td>No-contract or 12-month over 24-month lock-ins, even if a few euros higher</td>
              <td>Any operator</td>
            </tr>
            <tr>
              <td>Living in Wallonia</td>
              <td>Proximus vs Orange Belgium (Telenet Flanders+Brussels only)</td>
              <td>Auto-filtered by postcode on Slim</td>
            </tr>
          </tbody>
        </table>
        <p>
          Whatever your situation, the honest answer is: check the live
          comparison, not this guide, on the day you sign up. Prices,
          promotions, and contract terms change often. Slim exists to make
          that check take five minutes.
        </p>

        <h2>5. Personal note from the operator</h2>
        <p>
          I run Slim myself, and I switched from Orange Belgium (mobile +
          internet, around €62/month) to Proximus (two mobile lines +
          500&nbsp;Mbps fibre, around €90/month) earlier this year. Adding
          the second mobile line explains part of the price increase, but
          not all of it &mdash; the fibre component alone got noticeably
          more expensive.
        </p>
        <p>
          Two things surprised me, and both are worth checking for yourself
          before you switch:
        </p>
        <ul>
          <li>
            <strong>&ldquo;500&nbsp;Mbps fibre&rdquo; is a wired number, not
            a Wi-Fi one.</strong> In my apartment I rarely see more than
            around 10&nbsp;Mbps on Wi-Fi from the router that ships in the
            standard package. That is likely a Wi-Fi 5 / 2.4&nbsp;GHz vs
            5&nbsp;GHz / router-placement problem, not a fibre problem
            &mdash; but the marketing headline never mentions it. If you
            rely on Wi-Fi for everything (as most households do), a lower
            fibre tier plus a better router may serve you the same or
            better than the fastest tier with the stock modem.
          </li>
          <li>
            <strong>5G coverage felt more stable on Orange for me.</strong>{' '}
            Proximus has the largest overall infrastructure in Belgium, but
            in the places I actually use my phone (home, commute, work) I
            hit dropouts more often than I did on Orange. Coverage is very
            location-specific, so your experience may be different &mdash;
            but if 5G reliability matters to you, worth testing an Orange
            SIM in your usual spots before committing to a 24-month
            Proximus bundle.
          </li>
        </ul>
        <p>
          This is one household&apos;s experience, not a verdict. Belgian
          consumer surveys (Test-Aankoop, Trustpilot BE) show mixed
          Proximus satisfaction scores despite the operator&apos;s market
          leadership, so the pattern is not unique to me &mdash; but the
          only data that matters for your decision is your own postcode,
          your own usage, and a Wi-Fi speed test you run yourself. Slim
          will not tell you which operator is best; it will tell you what
          each one costs and points you at what to test.
        </p>

        <p className="text-sm text-fg/60">
          <em>
            Slim is an independent comparison tool. We are not paid by
            Proximus, Telenet, or Orange Belgium to influence rankings. Read
            our{' '}
            <Link
              href="/legal/affiliate-disclosure"
              className="text-primary hover:underline"
            >
              affiliate disclosure
            </Link>
            .
          </em>
        </p>
      </article>
    </main>
  );
}
