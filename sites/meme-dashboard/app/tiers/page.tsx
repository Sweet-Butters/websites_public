/**
 * Per-platform tierlists — each platform's independent top-N, side by side.
 *
 * Unlike the home overview (one cross-source "breakout" list), this page keeps
 * Google / YouTube / TikTok / Naver SEPARATE so you can see what each platform
 * thinks is hot on its own. Data comes from state/tierlist_<platform>/ in
 * meme_project (written by synth.tierlists), read via the GitHub Contents API.
 */
import Link from "next/link";

import {
  getLatestTierlist,
  TIERLIST_PLATFORMS,
  type TierlistSnapshot,
} from "@/lib/meme";

export const dynamic = "force-dynamic";

/** Static Tailwind classes for each platform's score bar (no dynamic class). */
const BAR_CLASS: Record<string, string> = {
  google: "bg-blue-500 dark:bg-blue-400",
  youtube: "bg-red-500 dark:bg-red-400",
  tiktok: "bg-fuchsia-500 dark:bg-fuchsia-400",
  naver: "bg-emerald-500 dark:bg-emerald-400",
};

/** Why a platform might be empty — concrete, actionable hints. */
const EMPTY_HINT: Record<string, string> = {
  youtube:
    "No data yet — the YouTube crawler needs a valid YOUTUBE_API_KEY in meme_project.",
  tiktok:
    "Parked — TikTok moved Creative Center to “TikTok One” and put trending data behind login, so there's no public source to crawl. Tracking the other platforms instead.",
  google: "No data yet — the pytrends crawler hasn't produced a snapshot.",
  naver: "No data yet — the Naver DataLab crawler hasn't produced a snapshot.",
};

function PlatformCard({
  id,
  label,
  icon,
  snap,
}: {
  id: string;
  label: string;
  icon: string;
  snap: TierlistSnapshot | null;
}) {
  const bar = BAR_CLASS[id] ?? "bg-zinc-400";
  const rows = snap?.keywords ?? [];

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span>{icon}</span>
          {label}
        </h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {snap
            ? `${snap.total_candidates} candidates · ${snap._meta.fetched_at.slice(0, 16).replace("T", " ")}`
            : "—"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-xs text-zinc-500">
          {EMPTY_HINT[id] ?? "No data yet."}
        </p>
      ) : (
        <ol className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {rows.map((r) => (
            <li key={r.keyword} className="px-4 py-2">
              <div className="flex items-baseline gap-2">
                <span className="w-5 shrink-0 text-xs tabular-nums text-zinc-400">
                  {r.rank}
                </span>
                <Link
                  href={`/k/${encodeURIComponent(r.keyword)}`}
                  className="flex-1 truncate text-sm hover:underline"
                  title={r.keyword}
                >
                  {r.keyword}
                </Link>
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                  {r.score_pct.toFixed(0)}
                </span>
              </div>
              <div className="mt-1 h-1 w-full rounded bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-1 rounded ${bar}`}
                  style={{ width: `${Math.max(2, r.score_pct)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function TiersPage() {
  // One fetch per platform, in parallel.
  const snaps = await Promise.all(
    TIERLIST_PLATFORMS.map((p) => getLatestTierlist(p.id)),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <header>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← back to overview
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          📊 Platform tierlists
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Each platform&apos;s independent top-10 — not blended. Compare what&apos;s
          hot on Google vs YouTube vs TikTok vs Naver. Tracked over time in{" "}
          <code className="font-mono text-xs">state/tierlist_*</code>.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TIERLIST_PLATFORMS.map((p, i) => (
          <PlatformCard
            key={p.id}
            id={p.id}
            label={p.label}
            icon={p.icon}
            snap={snaps[i] ?? null}
          />
        ))}
      </div>

      <footer className="text-xs text-zinc-500 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        Built by <code className="font-mono">synth.tierlists</code> in
        meme_project · one snapshot per platform per crawl · revalidate 1h.
      </footer>
    </main>
  );
}
