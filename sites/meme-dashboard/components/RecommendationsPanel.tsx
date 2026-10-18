/**
 * Renders the recommendation rows as a vertical stack of cards.
 *
 * Each card shows: rank + keyword (link), headline (one line), bullet
 * actions, and a confidence indicator. Higher confidence → solid border;
 * lower → dotted border, "watch only" style hint.
 */
import Link from "next/link";
import type { Recommendation } from "@/lib/recommend";

function confidenceBand(c: number): { label: string; ring: string } {
  if (c >= 0.7) return { label: "STRONG", ring: "border-blue-500 dark:border-blue-400" };
  if (c >= 0.4) return { label: "MODERATE", ring: "border-zinc-300 dark:border-zinc-700" };
  return { label: "WATCH", ring: "border-dashed border-zinc-300 dark:border-zinc-700" };
}

export function RecommendationsPanel({
  items,
}: {
  items: Recommendation[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No top keywords in the latest snapshot.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((r) => {
        const cb = confidenceBand(r.confidence);
        return (
          <div
            key={r.keyword}
            className={`rounded-lg border ${cb.ring} p-4`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <Link
                  href={`/k/${encodeURIComponent(r.keyword)}`}
                  className="font-semibold text-base hover:underline"
                >
                  #{r.rank} · {r.keyword}
                </Link>
                <span className="ml-2 text-xs text-zinc-500 tabular-nums">
                  trend {r.trendScore.toFixed(0)}
                </span>
              </div>
              <span className="text-[10px] font-medium text-zinc-500">
                {cb.label} · {(r.confidence * 100).toFixed(0)}%
                {r.source === "llm" && " · ✨"}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {r.headline}
            </p>
            <ul className="mt-2 space-y-1 text-sm list-disc list-outside ml-5">
              {r.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
