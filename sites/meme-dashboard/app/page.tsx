/**
 * Meme-dashboard home — server-component view of the meme_project state.
 *
 * Two horizontal sections:
 *  1) "Breakout keywords"     — top-10 by momentum z-score (state/momentum),
 *                               the same signal the daily digest / trend brief
 *                               is built from. NOT synth_hot_keywords.trend_score,
 *                               which ranks hardcoded seeds via a flat DataLab
 *                               signal and so does not reflect what is rising.
 *  2) "AI keyword intensity"  — 30-day sparkline from synth raw pytrends signal
 *
 * Everything renders server-side; we use the GitHub Contents API via
 * lib/meme.ts. No client JS needed beyond Next's tiny framework runtime.
 */
import Link from "next/link";

import {
  getAllKeywords,
  getKeywordIntensity,
  getLatestMomentum,
  getLatestSynth,
  topHotMomentum,
  type MomentumKeyword,
  type SynthKeyword,
} from "@/lib/meme";
import { getTopRecommendations } from "@/lib/recommend";
import { Sparkline } from "@/components/Sparkline";
import { KeywordSearch } from "@/components/KeywordSearch";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";

// Render on every request — no build-time prerender (which would need
// GH_TOKEN). The fetch layer in lib/meme.ts still caches GitHub responses
// for 1 hour via `next.revalidate`, so we don't actually hit the API
// 5000×/hour.
export const dynamic = "force-dynamic";

const FEATURED_KEYWORD = "AI";
const INTENSITY_DAYS = 30;

/** Tailwind classes for a momentum label badge. Falls back to neutral. */
function momentumLabelClass(label: string): string {
  if (label.includes("Breakout"))
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (label.includes("Rising"))
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  if (label.includes("New"))
    return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (label.includes("Cooling"))
    return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
  // Steady / unknown
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

export default async function Home() {
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (INTENSITY_DAYS - 1));

  // Fetch in parallel — these are independent network calls.
  const [momentum, synth, intensity, allKeywords, recommendations] =
    await Promise.all([
      getLatestMomentum(),
      getLatestSynth(),
      getKeywordIntensity(FEATURED_KEYWORD, from, today, "pytrends_sector"),
      getAllKeywords(),
      getTopRecommendations(5),
    ]);

  // "Hot" keywords only — 🔥 Breakout / 📈 Rising / 🆕 New, ranked by z-score.
  // 💤 Steady & 📉 Declining are persistent or fading, not trending, so they're
  // excluded: a fixed seed like ChatGPT/딥러닝 just sitting there at Steady
  // shouldn't occupy the top tier even when its z-score outranks a fresh term.
  const topMomentum: MomentumKeyword[] = momentum
    ? topHotMomentum(momentum, 10)
    : [];
  // Synth fallback is only for the case where momentum data is entirely
  // missing — NOT when momentum exists but nothing is hot today.
  const fallbackKeywords: SynthKeyword[] = synth.keywords.slice(0, 10);
  const hasMomentum = momentum !== null;
  const intensityValues = intensity.map((p) => p.value);
  const intensityPeak = Math.max(...intensityValues, 0);
  const intensityMean =
    intensityValues.reduce((a, b) => a + b, 0) / (intensityValues.length || 1);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            🔥 meme_project dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {momentum ? (
              <>
                Breakout snapshot: {momentum.as_of ?? momentum._meta.fetched_at}{" "}
                · {momentum.keywords.length} keywords tracked ·{" "}
                {momentum.history_days_available}d history
              </>
            ) : (
              <>
                Latest snapshot: {synth._meta.fetched_at} ·{" "}
                {synth.total_keywords} keywords from{" "}
                {synth.sources_used.join(", ")}
              </>
            )}
          </p>
          <nav className="mt-2 text-sm flex flex-wrap gap-4">
            <Link href="/youtube" className="underline">
              ▶️ YouTube by category →
            </Link>
            <Link href="/tiers" className="underline">
              📊 Platform tierlists →
            </Link>
            <Link href="/compare" className="underline">
              Compare keywords →
            </Link>
            <Link href="/brief" className="underline">
              📈 Trend brief →
            </Link>
          </nav>
        </div>
        <KeywordSearch keywords={allKeywords} />
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">🎯 Today&apos;s action recommendations</h2>
        <p className="text-xs text-zinc-500">
          Ranked by momentum (breakout z-score) + source breadth + demographic
          dominance. Borders: solid = high confidence, dashed = watch only.
        </p>
        <RecommendationsPanel items={recommendations} />
      </section>

      <section>
        <h2 className="text-xl font-medium mb-1">
          🚀 Breakout keywords (momentum)
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Only keywords actually moving — 🔥 Breakout / 📈 Rising / 🆕 New —
          ranked by z-score vs. the trailing baseline (the same signal the
          daily{" "}
          <Link href="/brief" className="underline">
            trend brief
          </Link>{" "}
          uses). 💤 Steady and 📉 Declining terms are excluded, so persistent
          seeds like ChatGPT/딥러닝 only appear here when they genuinely spike,
          not just for being present.
        </p>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          {topMomentum.length > 0 ? (
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    #
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    keyword
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    label
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">
                    z-score
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    sources
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {topMomentum.map((kw: MomentumKeyword, i: number) => (
                  <tr
                    key={kw.keyword}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-2 text-zinc-500">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/k/${encodeURIComponent(kw.keyword)}`}
                        className="hover:underline"
                      >
                        {kw.keyword}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${momentumLabelClass(
                          kw.label,
                        )}`}
                      >
                        {kw.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {kw.z_score.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-zinc-500 text-xs">
                      {kw.sources.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : hasMomentum ? (
            // Momentum data exists, but nothing is Breakout/Rising/New today.
            // Show that explicitly — do NOT fall back to the synth composite,
            // which would just re-surface the steady seeds we filtered out.
            <p className="px-4 py-6 text-sm text-zinc-500">
              No breakouts, rising, or new keywords today — the tracked terms
              are all steady. Check the{" "}
              <Link href="/brief" className="underline">
                trend brief
              </Link>{" "}
              or search a specific keyword.
            </p>
          ) : (
            // No momentum snapshot committed yet — fall back to the synth
            // composite so the page still shows something, with a notice.
            <div>
              <p className="px-4 pt-3 text-xs text-amber-600 dark:text-amber-400">
                No momentum snapshot yet — showing the raw synth composite
                ranking as a fallback. Run <code className="font-mono">
                  synth.momentum
                </code>{" "}
                in meme_project to populate breakout data.
              </p>
              <table className="w-full text-sm min-w-[420px]">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-zinc-500">
                      #
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-500">
                      keyword
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-500">
                      trend
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-500">
                      sources
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {fallbackKeywords.map((kw: SynthKeyword, i: number) => (
                    <tr
                      key={kw.keyword}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <td className="px-4 py-2 text-zinc-500">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">
                        <Link
                          href={`/k/${encodeURIComponent(kw.keyword)}`}
                          className="hover:underline"
                        >
                          {kw.keyword}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {kw.trend_score.toFixed(1)}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 text-xs">
                        {kw.sources.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium mb-4">
          {FEATURED_KEYWORD} — Google Trends KR, last {INTENSITY_DAYS} days
        </h2>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="text-blue-600 dark:text-blue-400">
            <Sparkline values={intensityValues} height={80} strokeWidth={2} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-zinc-500">peak</dt>
              <dd className="tabular-nums font-medium">
                {intensityPeak.toFixed(0)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">mean</dt>
              <dd className="tabular-nums font-medium">
                {intensityMean.toFixed(0)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">days</dt>
              <dd className="tabular-nums font-medium">
                {intensityValues.length}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-zinc-500">
            Source: synth_hot_keywords.raw.pytrends_sector
          </p>
        </div>
      </section>

      <footer className="text-xs text-zinc-500 pt-8 border-t border-zinc-200 dark:border-zinc-800">
        Data pulled live from{" "}
        <a
          href="https://github.com/Sweet-Butters/meme_project"
          className="underline"
        >
          Sweet-Butters/meme_project
        </a>{" "}
        · revalidate window: 1 hour
      </footer>
    </main>
  );
}
