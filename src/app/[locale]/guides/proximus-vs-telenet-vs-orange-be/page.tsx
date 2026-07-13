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

      <article className="max-w-none">
        <p className={P_CLASS}>
          Belgium&apos;s residential telecom market is dominated by three
          operators: <strong className="font-semibold text-fg">Proximus</strong>,{' '}
          <strong className="font-semibold text-fg">Telenet</strong>, and{' '}
          <strong className="font-semibold text-fg">Orange Belgium</strong>.
          Together they cover more than 97% of households (Mordor Intelligence
          Q1 2025). Choosing between them is rarely a &ldquo;best
          overall&rdquo; question &mdash; it depends on where you live, what
          you already own, and whether you need mobile, fixed internet, TV,
          or all three. This guide compares them honestly, without paid
          rankings, so you can pick the operator that fits your household.
        </p>

        <h2 className={H2_CLASS}>1. Price comparison &mdash; mobile and internet</h2>
        <p className={P_CLASS}>
          Prices below are the entry, mid, and top tiers advertised on each
          operator&apos;s official page in August 2026. Almost all headline
          prices are <strong className="font-semibold text-fg">promotional</strong> and
          revert to a higher &ldquo;standard&rdquo; price after 6 or 12
          months &mdash; both numbers are shown where they matter.
        </p>
        <div className={TABLE_WRAP}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Tier</th>
                <th className={TH_CLASS}>Proximus</th>
                <th className={TH_CLASS}>Telenet</th>
                <th className={TH_CLASS}>Orange Belgium</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={TD_CLASS}>Mobile, entry (5&ndash;15&nbsp;GB)</td>
                <td className={TD_CLASS}>Essential 5&nbsp;GB &mdash; €14.99 promo (6&nbsp;mo) &rarr; €16.99</td>
                <td className={TD_CLASS}>Basic 15&nbsp;GB &mdash; €11 promo (6&nbsp;mo) &rarr; €16</td>
                <td className={TD_CLASS}>Small 12&nbsp;GB &mdash; €15 (no promo)</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Mobile, mid (70&nbsp;GB)</td>
                <td className={TD_CLASS}>Smart 70&nbsp;GB &mdash; €18.99 promo (6&nbsp;mo) &rarr; €24.99</td>
                <td className={TD_CLASS}>&mdash; not sold at this tier</td>
                <td className={TD_CLASS}>Medium 70&nbsp;GB &mdash; €18 promo (6&nbsp;mo) &rarr; €23</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Mobile, large (140&nbsp;GB)</td>
                <td className={TD_CLASS}>Maxi 140&nbsp;GB &mdash; €21.99 promo (6&nbsp;mo) &rarr; €29.99</td>
                <td className={TD_CLASS}>&mdash; not sold at this tier</td>
                <td className={TD_CLASS}>Large 140&nbsp;GB &mdash; €20 promo (12&nbsp;mo) &rarr; €29</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Mobile, unlimited data</td>
                <td className={TD_CLASS}>Unlimited &mdash; €34.99 promo (6&nbsp;mo) &rarr; €49.99</td>
                <td className={TD_CLASS}>Unlimited &mdash; €14 promo (6&nbsp;mo) &rarr; €27.50</td>
                <td className={TD_CLASS}>Unlimited &mdash; €31 promo (12&nbsp;mo) &rarr; €40</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Internet, entry (100&ndash;200&nbsp;Mbps)</td>
                <td className={TD_CLASS}>Internet Light 100&nbsp;Mbps &mdash; €39.99 (no promo)</td>
                <td className={TD_CLASS}>Basic 200&nbsp;Mbps &mdash; €35 promo (6&nbsp;mo)</td>
                <td className={TD_CLASS}>Start 150&ndash;200&nbsp;Mbps &mdash; €53 promo (12&nbsp;mo)</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Internet, mid (400&ndash;500&nbsp;Mbps)</td>
                <td className={TD_CLASS}>Mega Fiber 500&nbsp;Mbps &mdash; €57.99 promo &rarr; €77.99</td>
                <td className={TD_CLASS}>Standard 500&nbsp;Mbps &mdash; €35 promo &rarr; €65</td>
                <td className={TD_CLASS}>Zen 400&ndash;500&nbsp;Mbps &mdash; €62 promo (12&nbsp;mo)</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Internet, gigabit</td>
                <td className={TD_CLASS}>Giga Fiber 2&nbsp;Gbps &mdash; €57.99 promo &rarr; €77.99</td>
                <td className={TD_CLASS}>Turbo 2.5&nbsp;Gbps &mdash; €55 promo &rarr; €85</td>
                <td className={TD_CLASS}>Giga 1&nbsp;Gbps &mdash; €72 promo (12&nbsp;mo)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={P_CLASS}>
          A few patterns to notice at a glance. On{' '}
          <strong className="font-semibold text-fg">mobile</strong>,
          Telenet is aggressive at the entry tier (15&nbsp;GB for €11
          during promo, roughly triple the data of Proximus Essential at
          a similar price) but does not sell mid or large tiers &mdash;
          if you want 70&nbsp;GB or 140&nbsp;GB, you either downgrade
          to Basic or jump to Unlimited. Proximus and Orange Belgium
          both offer a full four-tier ladder; Orange consistently
          undercuts Proximus by €1&ndash;€4/month at the mid, large,
          and unlimited tiers &mdash; but its Unlimited promo runs
          12&nbsp;months instead of 6, so the effective 2-year cost is
          closer than the headline suggests.
        </p>
        <p className={P_CLASS}>
          On <strong className="font-semibold text-fg">internet</strong>,
          Proximus and Telenet publish the sharpest headline promos on
          gigabit tiers but let the price jump €20&ndash;€30/month at
          the end of the promo window. Orange Belgium&apos;s gigabit
          sits lower than the post-promo prices of the other two, but
          higher than their in-promo prices.
        </p>
        <p className={P_CLASS}>
          Because these numbers move &mdash; sometimes weekly &mdash; a
          static table like this is out of date within a month. Live data
          lives on{' '}
          <Link href="/compare/mobile" className={LINK_CLASS}>
            /compare/mobile
          </Link>
          {' '}and{' '}
          <Link href="/compare/internet_fixed" className={LINK_CLASS}>
            /compare/internet_fixed
          </Link>
          , with each price stamped by the source URL and the time of the
          last fetch so you can check the operator page yourself.
        </p>

        <h2 className={H2_CLASS}>2. Contract terms and promo windows</h2>
        <p className={P_CLASS}>
          A surprise for many first-time switchers: on their consumer sites,
          Proximus, Telenet, and Orange Belgium all advertise their internet
          and mobile plans as{' '}
          <strong className="font-semibold text-fg">non-binding</strong>{' '}
          &mdash; you can cancel at any time. The catch is the{' '}
          <strong className="font-semibold text-fg">promotional discount window</strong>:
          the low headline price only holds for the first 6 or 12 months,
          after which the monthly bill jumps back to the &ldquo;standard&rdquo;
          tariff. That is the number that matters for the second half of
          your stay.
        </p>
        <div className={TABLE_WRAP}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Aspect</th>
                <th className={TH_CLASS}>Proximus</th>
                <th className={TH_CLASS}>Telenet</th>
                <th className={TH_CLASS}>Orange Belgium</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={TD_CLASS}>Cancel anytime?</td>
                <td className={TD_CLASS}>Yes (site: &ldquo;change or cancel free, whenever&rdquo;)</td>
                <td className={TD_CLASS}>Yes (non-binding)</td>
                <td className={TD_CLASS}>Yes (non-binding)</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Typical mobile promo window</td>
                <td className={TD_CLASS}>6 months</td>
                <td className={TD_CLASS}>6 months</td>
                <td className={TD_CLASS}>6&ndash;12 months</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Typical internet promo window</td>
                <td className={TD_CLASS}>12 months (except no-promo Light)</td>
                <td className={TD_CLASS}>6 months</td>
                <td className={TD_CLASS}>12 months</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Post-promo price step</td>
                <td className={TD_CLASS}>+€10 to +€20/mo</td>
                <td className={TD_CLASS}>+€30/mo on gigabit</td>
                <td className={TD_CLASS}>Not clearly stated on the plan page</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Installation fee</td>
                <td className={TD_CLASS}>Varies; sometimes waived in bundle promos</td>
                <td className={TD_CLASS}>Currently free on internet plans</td>
                <td className={TD_CLASS}>€39</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={P_CLASS}>
          Belgian consumer law lets you cancel at any time, so the real
          maths is not &ldquo;lock-in vs freedom&rdquo; but &ldquo;in-promo
          price vs the 2nd-year price&rdquo;. If you plan to keep the same
          plan for two years or more, compare the post-promo columns above,
          not the headline promo.
        </p>

        <h2 className={H2_CLASS}>3. What Slim actually covers (and doesn&apos;t)</h2>
        <p className={P_CLASS}>
          Slim compares the three operators by parsing their public pricing
          pages every 24 hours and storing each price with its source URL
          and a UTC timestamp. Nothing hand-edited, nothing inferred. Here
          is what that coverage looks like today &mdash; including the
          gaps, so you know when to double-check on the operator&apos;s own
          site.
        </p>
        <div className={TABLE_WRAP}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Aspect</th>
                <th className={TH_CLASS}>Proximus</th>
                <th className={TH_CLASS}>Telenet</th>
                <th className={TH_CLASS}>Orange Belgium</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={TD_CLASS}>Data method</td>
                <td className={TD_CLASS}>HTML scraping</td>
                <td className={TD_CLASS}>HTML scraping</td>
                <td className={TD_CLASS}>HTML scraping</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Update frequency</td>
                <td className={TD_CLASS}>Every 24h</td>
                <td className={TD_CLASS}>Every 24h</td>
                <td className={TD_CLASS}>Every 24h</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Mobile covered on Slim</td>
                <td className={TD_CLASS}>Yes</td>
                <td className={TD_CLASS}>Yes (Basic + Unlimited only)</td>
                <td className={TD_CLASS}>Coming next round &mdash; static HTML re-confirmed 2026-07</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Internet covered on Slim</td>
                <td className={TD_CLASS}>Yes (Light / Go / Mega / Giga)</td>
                <td className={TD_CLASS}>Not yet (manual fallback)</td>
                <td className={TD_CLASS}>Yes (Start / Zen / Giga)</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>&ldquo;Fibre&rdquo; branding on operator site</td>
                <td className={TD_CLASS}>Explicit (Mega Fiber, Giga Fiber)</td>
                <td className={TD_CLASS}>Not used on plan names</td>
                <td className={TD_CLASS}>Not used on plan names</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Region</td>
                <td className={TD_CLASS}>Belgium-wide</td>
                <td className={TD_CLASS}>Flanders + Brussels only</td>
                <td className={TD_CLASS}>Belgium-wide (Voo cable network absorbed, 2025)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={P_CLASS}>
          Two things worth understanding here. First, only Proximus brands
          its plans as &ldquo;Fiber&rdquo; on the consumer site &mdash;
          Telenet and Orange Belgium sell the same speed tiers under
          neutral names, and the underlying network is fibre in some
          addresses and cable in others (Orange in particular now delivers
          via the ex-Voo cable network in many locations). Second, Slim
          does not yet cover Telenet&apos;s home internet plans, and
          Orange Belgium&apos;s mobile plans are next in line &mdash;
          the operator&apos;s mobile page was JavaScript-rendered when
          Slim first surveyed it, but a 2026-07 re-check found it now
          serves the four tiers (Small / Medium / Large / Unlimited) as
          static HTML, so the fetcher can be extended. Where Slim
          can&apos;t compare today, the results page says so.
        </p>
        <p className={P_CLASS}>
          Mobile Vikings, Scarlet, hey!, and other smaller Belgian
          operators are not yet compared either &mdash; see the full
          exclusion list on{' '}
          <Link href="/data-sources" className={LINK_CLASS}>
            /data-sources
          </Link>
          . If an operator is missing, Slim says so; it does not silently
          drop them.
        </p>

        <h2 className={H2_CLASS}>4. Which operator fits your household?</h2>
        <p className={P_CLASS}>
          Rather than crown a single winner, here is a practical decision
          matrix based on the household you actually have:
        </p>
        <div className={TABLE_WRAP}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <th className={TH_CLASS}>Household situation</th>
                <th className={TH_CLASS}>Best fit</th>
                <th className={TH_CLASS}>Where to compare</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={TD_CLASS}>Single, urban, mobile-first</td>
                <td className={TD_CLASS}>Any of 3 entry mobile plans (compare data allowance, not headline price)</td>
                <td className={TD_CLASS}>
                  <Link href="/compare/mobile" className={LINK_CLASS}>
                    /compare/mobile
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Couple, one home, no TV</td>
                <td className={TD_CLASS}>Mobile + internet duo (skip TV channel packs)</td>
                <td className={TD_CLASS}>
                  <Link href="/compare/bundle_mobile_internet" className={LINK_CLASS}>
                    /compare/bundle_mobile_internet
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Family with kids, TV matters</td>
                <td className={TD_CLASS}>Triple play (mobile + internet + TV) &mdash; check channel packs you already own</td>
                <td className={TD_CLASS}>
                  <Link href="/compare/bundle_mobile_internet_tv" className={LINK_CLASS}>
                    /compare/bundle_mobile_internet_tv
                  </Link>
                </td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Renter or planning to move</td>
                <td className={TD_CLASS}>No-contract or 12-month over 24-month lock-ins, even if a few euros higher</td>
                <td className={TD_CLASS}>Any operator</td>
              </tr>
              <tr>
                <td className={TD_CLASS}>Living in Wallonia</td>
                <td className={TD_CLASS}>Proximus vs Orange Belgium (Telenet Flanders+Brussels only)</td>
                <td className={TD_CLASS}>Auto-filtered by postcode on Slim</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={P_CLASS}>
          Whatever your situation, the honest answer is: check the live
          comparison, not this guide, on the day you sign up. Prices,
          promotions, and contract terms change often. Slim exists to make
          that check take five minutes.
        </p>

        <h2 className={H2_CLASS}>5. Personal note from the operator</h2>
        <p className={P_CLASS}>
          I run Slim myself, and I switched from Orange Belgium (mobile +
          internet, around €62/month) to Proximus (two mobile lines +
          500&nbsp;Mbps fibre, around €90/month) earlier this year. Adding
          the second mobile line explains part of the price increase, but
          not all of it &mdash; the fibre component alone got noticeably
          more expensive.
        </p>
        <p className={P_CLASS}>
          Two things surprised me, and both are worth checking for yourself
          before you switch:
        </p>
        <ul className={UL_CLASS}>
          <li className={LI_CLASS}>
            <strong className="font-semibold text-fg">
              &ldquo;500&nbsp;Mbps fibre&rdquo; is a wired number, not a Wi-Fi
              one.
            </strong>{' '}
            In my apartment I rarely see more than around 10&nbsp;Mbps on
            Wi-Fi from the router that ships in the standard package. That
            is likely a Wi-Fi 5 / 2.4&nbsp;GHz vs 5&nbsp;GHz /
            router-placement problem, not a fibre problem &mdash; but the
            marketing headline never mentions it. If you rely on Wi-Fi for
            everything (as most households do), a lower fibre tier plus a
            better router may serve you the same or better than the fastest
            tier with the stock modem.
          </li>
          <li className={LI_CLASS}>
            <strong className="font-semibold text-fg">
              5G coverage felt more stable on Orange for me.
            </strong>{' '}
            Proximus has the largest overall infrastructure in Belgium, but
            in the places I actually use my phone (home, commute, work) I
            hit dropouts more often than I did on Orange. Coverage is very
            location-specific, so your experience may be different &mdash;
            but if 5G reliability matters to you, worth testing an Orange
            SIM in your usual spots before committing to a 24-month
            Proximus bundle.
          </li>
        </ul>
        <p className={P_CLASS}>
          This is one household&apos;s experience, not a verdict. Belgian
          consumer surveys (Test-Aankoop, Trustpilot BE) show mixed
          Proximus satisfaction scores despite the operator&apos;s market
          leadership, so the pattern is not unique to me &mdash; but the
          only data that matters for your decision is your own postcode,
          your own usage, and a Wi-Fi speed test you run yourself. Slim
          will not tell you which operator is best; it will tell you what
          each one costs and points you at what to test.
        </p>

        <p className="mt-8 text-sm text-fg/60">
          <em>
            Slim is an independent comparison tool. We are not paid by
            Proximus, Telenet, or Orange Belgium to influence rankings. Read
            our{' '}
            <Link href="/legal/affiliate-disclosure" className={LINK_CLASS}>
              affiliate disclosure
            </Link>
            .
          </em>
        </p>
      </article>
    </main>
  );
}
