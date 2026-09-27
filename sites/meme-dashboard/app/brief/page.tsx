/**
 * LLM-generated trend brief — latest snapshot rendered as markdown.
 *
 * The brief is composed by agents/trend_brief in meme_project after each
 * digest run; it's the same Korean-marketing-analyst write-up that goes
 * to Telegram, just rendered as an actual web page with proper headings.
 *
 * `?at=<filename>` selects a historical brief (taking from the committed
 * state/trend_brief/ archive); default is the latest.
 */
import Link from "next/link";

import { Markdown } from "@/components/Markdown";
import {
  type ConsecutiveAppearance,
  getBriefByFilename,
  getKeywordConsecutiveAppearances,
  getLatestBrief,
  listBriefFilenames,
} from "@/lib/meme";

export const dynamic = "force-dynamic";

const ARCHIVE_LIMIT = 20;

export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string }>;
}) {
  const { at } = await searchParams;

  const [filenames, currentBrief, consecutive] = await Promise.all([
    listBriefFilenames(),
    at ? getBriefByFilename(at) : getLatestBrief(),
    // Consecutive-day metrics are derived from the FULL archive, not
    // whatever `?at=` is currently displayed. They describe "today" only,
    // and we hide them when viewing a historical brief.
    at
      ? Promise.resolve({} as Record<string, ConsecutiveAppearance>)
      : getKeywordConsecutiveAppearances(),
  ]);
  const consecutiveRows: Array<[string, ConsecutiveAppearance]> = Object.entries(
    consecutive,
  )
    .filter(([, info]) => info.consecutiveDays >= 2)
    .sort((a, b) => b[1].consecutiveDays - a[1].consecutiveDays)
    .slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← back to overview
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            📊 Trend Brief
          </h1>
          {currentBrief && (
            <p className="mt-1 text-xs text-zinc-500">
              as_of {currentBrief.as_of ?? "—"} · source ={" "}
              <span className="font-mono">{currentBrief.source}</span> ·
              history days = {currentBrief.history_days_available}
            </p>
          )}
        </div>
      </header>

      {!currentBrief ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 text-sm text-zinc-500">
          No brief snapshots committed yet. The{" "}
          <code className="font-mono">digest</code> workflow has to run
          once with <code className="font-mono">contents: write</code>{" "}
          permission to populate{" "}
          <code className="font-mono">state/trend_brief/</code>. Trigger
          it from the meme_project Actions tab.
        </div>
      ) : (
        <article className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <Markdown source={currentBrief.body} />
        </article>
      )}

      {!at && consecutiveRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500">
            🔁 연속 등장 키워드
          </h2>
          <p className="text-xs text-zinc-500">
            오늘 brief에 나온 키워드 중, 최근 N일 동안 매일 등장한 것들.
            의미: 단발성 노이즈가 아니라 지속되는 트렌드.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {consecutiveRows.map(([kw, info]) => (
              <li key={kw}>
                <Link
                  href={`/k/${encodeURIComponent(kw)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 hover:opacity-80"
                >
                  <span className="font-medium">{kw}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {info.consecutiveDays}일 연속
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {filenames.length > 1 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500">Archive</h2>
          <ul className="space-y-1 text-sm">
            {filenames
              .slice()
              .reverse()
              .slice(0, ARCHIVE_LIMIT)
              .map((name) => {
                const day = name.slice(0, 10);
                const isCurrent =
                  (at && name === at) ||
                  (!at &&
                    filenames[filenames.length - 1] === name);
                return (
                  <li key={name}>
                    <Link
                      href={`/brief?at=${encodeURIComponent(name)}`}
                      className={`underline hover:opacity-80 ${
                        isCurrent ? "font-semibold" : "text-zinc-500"
                      }`}
                    >
                      {day}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      <footer className="text-xs text-zinc-500 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        Generated by{" "}
        <code className="font-mono">agents/trend_brief.py</code> in
        meme_project. LLM (Gemini) when available, deterministic
        stat-fallback otherwise.
      </footer>
    </main>
  );
}
