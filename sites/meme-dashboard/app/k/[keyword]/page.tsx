/**
 * Keyword drill-down — multi-source intensity + pairwise lead/lag.
 *
 * Server-rendered. Loads the requested keyword's full multi-source time
 * series in one pass, then computes lead/lag locally so the page is a
 * single fetch wave (parallel) rather than a chain.
 *
 * URL shape: /k/<encoded keyword>     e.g. /k/AI
 */
import Link from "next/link";

import { Sparkline } from "@/components/Sparkline";
import { LeadLagMatrixView } from "@/components/LeadLagMatrix";
import { KeywordSearch } from "@/components/KeywordSearch";
import { DateRangePicker } from "@/components/DateRangePicker";
import { BarChart } from "@/components/BarChart";
import { DemoTimeline } from "@/components/DemoTimeline";
import { AbsoluteValuesTable } from "@/components/AbsoluteValuesTable";
import {
  getAllKeywords,
  getKeywordBreakdowns,
  getKeywordDemoTimeline,
  getKeywordMultiIntensity,
  getLatestSynth,
  getLeadLagMatrix,
} from "@/lib/meme";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseRange(from: string | undefined, to: string | undefined): {
  fromDate: Date;
  toDate: Date;
  defaultFrom: string;
  defaultTo: string;
} {
  const today = new Date();
  const todayStr = fmt(today);
  if (from && to) {
    return {
      fromDate: new Date(from),
      toDate: new Date(to),
      defaultFrom: from,
      defaultTo: to,
    };
  }
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (DEFAULT_DAYS - 1));
  return {
    fromDate: start,
    toDate: today,
    defaultFrom: fmt(start),
    defaultTo: todayStr,
  };
}

const SOURCE_COLORS: Record<string, string> = {
  trend_score: "text-zinc-700 dark:text-zinc-200",
  pytrends_sector: "text-blue-600 dark:text-blue-400",
  naver_datalab: "text-emerald-600 dark:text-emerald-400",
  tiktok_creative: "text-rose-600 dark:text-rose-400",
  youtube_trending: "text-amber-600 dark:text-amber-400",
};

const SOURCE_LABELS: Record<string, string> = {
  trend_score: "trend score (unified)",
  pytrends_sector: "Google Trends KR",
  naver_datalab: "Naver DataLab",
  tiktok_creative: "TikTok hashtag views",
  youtube_trending: "YouTube trending",
};

function summarize(values: number[]) {
  const present = values.filter((v) => v > 0);
  if (present.length === 0) {
    return { mean: 0, peak: 0, presence: 0 };
  }
  return {
    mean: present.reduce((a, b) => a + b, 0) / present.length,
    peak: Math.max(...present),
    presence: present.length / values.length,
  };
}

export default async function KeywordPage({
  params,
  searchParams,
}: {
  params: Promise<{ keyword: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { keyword: rawParam } = await params;
  const keyword = decodeURIComponent(rawParam);
  const { from: fromParam, to: toParam } = await searchParams;

  const { fromDate, toDate, defaultFrom, defaultTo } = parseRange(
    fromParam,
    toParam,
  );

  const [keywords, intensity, leadlag, breakdowns, demoTimeline, synthLatest] =
    await Promise.all([
      getAllKeywords(),
      getKeywordMultiIntensity(keyword, fromDate, toDate),
      // lead/lag uses the same window now — the zero-trim inside the helper
      // protects against the "long window + sparse data" artefact.
      getLeadLagMatrix(keyword, fromDate, toDate),
      // Demographics snapshot is keyword-scoped and date-stamped at the
      // crawler level — not range-filtered here.
      getKeywordBreakdowns(keyword),
      // 4-window split of demographic data so users can spot week-over-week
      // shifts (e.g. "30대 비중 +12pt vs previous window").
      getKeywordDemoTimeline(keyword, 4),
      // Latest synth — used for the "absolute values" table so users can see
      // the real numbers behind the 0-100 trend_score.
      getLatestSynth(),
    ]);
  const synthRowForKeyword = synthLatest.keywords.find(
    (k) => k.keyword === keyword,
  );

  const rangeDays =
    Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

  // Hide the unified `trend_score` series — synth normalizes each day so
  // the top-ranked keyword reads as 100 across all dates, which makes the
  // sparkline a misleading flat line. The per-source raw values are what
  // actually carry the time variation users want to see.
  const seriesEntries = Object.entries(intensity.series).filter(
    ([src]) => src !== "trend_score",
  );

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
            {keyword}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {defaultFrom} → {defaultTo} ({rangeDays} days) · lead/lag
            uses the same window after trimming leading/trailing zeros
          </p>
        </div>
        <div className="flex flex-col gap-2 items-stretch sm:items-end">
          <KeywordSearch keywords={keywords} initial={keyword} />
          <DateRangePicker defaultFrom={defaultFrom} defaultTo={defaultTo} />
        </div>
      </div>

      {synthRowForKeyword && (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">
            절대값 (latest snapshot)
          </h2>
          <p className="text-xs text-zinc-500">
            sparkline은 0-100 정규화 값이라 절대 규모를 못 보여줍니다.
            아래 표는 가장 최근 snapshot에서 각 소스가 보고한{" "}
            <strong>실제 숫자</strong> — TikTok / YouTube는 진짜 조회수
            합, pytrends / DataLab는 0-100 지수.
          </p>
          <AbsoluteValuesTable
            raw={synthRowForKeyword.raw}
            trendScore={synthRowForKeyword.trend_score}
          />
        </section>
      )}

      <section className="space-y-6">
        <h2 className="text-xl font-medium">Intensity by source</h2>
        {seriesEntries.length === 0 && (
          <p className="text-sm text-zinc-500">
            No data for "{keyword}" in the window — make sure the keyword
            appears in the latest synth snapshot (try search).
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seriesEntries.map(([src, values]) => {
            const stats = summarize(values);
            const color = SOURCE_COLORS[src] ?? "text-zinc-600";
            const label = SOURCE_LABELS[src] ?? src;
            return (
              <div
                key={src}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-medium">{label}</h3>
                  <span className="text-xs text-zinc-500 font-mono">
                    {src}
                  </span>
                </div>
                <div className={color}>
                  <Sparkline
                    values={values}
                    dates={intensity.days}
                    height={56}
                  />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-zinc-500">peak</dt>
                    <dd className="tabular-nums font-medium">
                      {stats.peak.toFixed(0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">mean</dt>
                    <dd className="tabular-nums font-medium">
                      {stats.mean.toFixed(0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">presence</dt>
                    <dd className="tabular-nums font-medium">
                      {(stats.presence * 100).toFixed(0)}%
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Lead / Lag matrix</h2>
        <LeadLagMatrixView matrix={leadlag} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Demographic breakdown</h2>
        {breakdowns === null ? (
          <p className="text-sm text-zinc-500">
            No demographic snapshot yet. Run the{" "}
            <code className="font-mono">crawl_sectors</code> or{" "}
            <code className="font-mono">backfill</code> workflow with{" "}
            <code className="font-mono">include_demo=true</code> to populate.
          </p>
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              Naver search distribution for{" "}
              <span className="font-medium">{keyword}</span> over{" "}
              {breakdowns.startDate} → {breakdowns.endDate}. Normalized to
              100% across each dimension (raw DataLab ratios shown on hover).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
                <h3 className="text-sm font-medium">Gender</h3>
                <BarChart
                  rows={breakdowns.gender}
                  colorClass="text-blue-600 dark:text-blue-400"
                />
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
                <h3 className="text-sm font-medium">Age</h3>
                <BarChart
                  rows={breakdowns.ages}
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
                <h3 className="text-sm font-medium">Device</h3>
                <BarChart
                  rows={breakdowns.device}
                  colorClass="text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>
          </>
        )}
      </section>

      {demoTimeline && demoTimeline.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">
            Demographic shifts (week over week)
          </h2>
          <p className="text-xs text-zinc-500">
            Same dimensions split into {demoTimeline.length} time windows.
            Annotations highlight the biggest bucket movement vs the
            previous window (≥3 percentage points).
          </p>
          <DemoTimeline windows={demoTimeline} />
        </section>
      )}

      <section>
        <Link
          href={`/compare?kw=${encodeURIComponent(keyword)}&from=${defaultFrom}&to=${defaultTo}`}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          Compare with other keywords →
        </Link>
      </section>

      <footer className="text-xs text-zinc-500 pt-8 border-t border-zinc-200 dark:border-zinc-800">
        Method: Pearson cross-correlation on daily-aggregated raw signals.
        Lag value = best |ρ| over ±14 days.
      </footer>
    </main>
  );
}
