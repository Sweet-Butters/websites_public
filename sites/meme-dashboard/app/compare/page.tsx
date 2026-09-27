/**
 * Multi-keyword comparison page.
 *
 * URL: /compare?kw=AI,ChatGPT,딥러닝&source=pytrends_sector&from=...&to=...
 *
 * Renders up to 5 keywords as overlaid lines on a single chart so the user
 * can spot relative shape (does AI peak when ChatGPT dips? do all three
 * crash on weekends?). A side table summarizes mean / peak / presence per
 * keyword.
 */
import Link from "next/link";

import { MultiLineChart } from "@/components/MultiLineChart";
import { chartColorClass } from "@/lib/chart-colors";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CompareKeywordPicker } from "@/components/CompareKeywordPicker";
import { getKeywordIntensity, getAllKeywords } from "@/lib/meme";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;
const MAX_KEYWORDS = 5;
const DEFAULT_SOURCE = "pytrends_sector";

const SOURCE_LABELS: Record<string, string> = {
  trend_score: "trend score (unified)",
  pytrends_sector: "Google Trends KR",
  naver_datalab: "Naver DataLab",
  tiktok_creative: "TikTok hashtag views",
  youtube_trending: "YouTube trending",
};

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseRange(from?: string, to?: string) {
  const today = new Date();
  if (from && to) {
    return { fromDate: new Date(from), toDate: today };
  }
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (DEFAULT_DAYS - 1));
  return {
    fromDate: from ? new Date(from) : start,
    toDate: to ? new Date(to) : today,
  };
}

function parseKeywords(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);
}

function summarize(values: number[]) {
  const present = values.filter((v) => v > 0);
  if (present.length === 0) return { mean: 0, peak: 0, presence: 0 };
  return {
    mean: present.reduce((a, b) => a + b, 0) / present.length,
    peak: Math.max(...present),
    presence: present.length / values.length,
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ kw?: string; from?: string; to?: string; source?: string }>;
}) {
  const sp = await searchParams;
  const keywords = parseKeywords(sp.kw);
  const source = sp.source && sp.source.length > 0 ? sp.source : DEFAULT_SOURCE;
  const { fromDate, toDate } = parseRange(sp.from, sp.to);
  const fromStr = fmt(fromDate);
  const toStr = fmt(toDate);

  // Get keyword list for the search box on this page too.
  const allKeywordsPromise = getAllKeywords();

  // Fetch intensity for each requested keyword in parallel.
  const series = await Promise.all(
    keywords.map(async (kw) => {
      const points = await getKeywordIntensity(kw, fromDate, toDate, source);
      return {
        keyword: kw,
        values: points.map((p) => p.value),
        dates: points.map((p) => p.date),
      };
    }),
  );
  const allKeywords = await allKeywordsPromise;

  // All series share the same date axis (since getKeywordIntensity uses
  // the same window for every call).
  const dates = series[0]?.dates ?? [];
  const rangeDays = dates.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← back to overview
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Compare keywords
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {fromStr} → {toStr} ({rangeDays} days) · source ={" "}
            <span className="font-mono">
              {SOURCE_LABELS[source] ?? source}
            </span>
          </p>
        </div>
        <DateRangePicker defaultFrom={fromStr} defaultTo={toStr} />
      </div>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
        <h2 className="text-sm font-medium">Keywords to overlay</h2>
        <CompareKeywordPicker
          allKeywords={allKeywords}
          current={keywords}
          source={source}
          fromStr={fromStr}
          toStr={toStr}
        />
      </section>

      {series.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Pick up to {MAX_KEYWORDS} keywords above to overlay.
        </p>
      ) : (
        <>
          <section>
            <h2 className="text-xl font-medium mb-4">Overlay</h2>
            <MultiLineChart
              series={series.map((s, i) => ({
                label: s.keyword,
                values: s.values,
                colorClass: chartColorClass(i),
              }))}
              dates={dates}
              height={220}
            />
          </section>

          <section>
            <h2 className="text-xl font-medium mb-4">Side-by-side stats</h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-zinc-500">
                      keyword
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-500">
                      peak
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-500">
                      mean
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-500">
                      presence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {series.map((s, i) => {
                    const stats = summarize(s.values);
                    return (
                      <tr key={s.keyword}>
                        <td className="px-4 py-2 font-medium flex items-center gap-2">
                          <span
                            className={`inline-block w-3 h-0.5 ${chartColorClass(
                              i,
                            )}`}
                            style={{ backgroundColor: "currentColor" }}
                          />
                          <Link
                            href={`/k/${encodeURIComponent(s.keyword)}`}
                            className="hover:underline"
                          >
                            {s.keyword}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {stats.peak.toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {stats.mean.toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {(stats.presence * 100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <footer className="text-xs text-zinc-500 pt-8 border-t border-zinc-200 dark:border-zinc-800">
        Tip: source can also be{" "}
        <span className="font-mono">naver_datalab</span> via{" "}
        <span className="font-mono">?source=naver_datalab</span> in the URL.
      </footer>
    </main>
  );
}

