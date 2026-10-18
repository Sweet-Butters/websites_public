/**
 * YouTube per-category trends, split SHORT-FORM vs LONG-FORM — they run on
 * different algorithms, so each niche shows both pools separately, with the
 * tags / title keywords to model your own videos on.
 *
 * Data: state/youtube_categories/ (crawlers.youtube_categories) via GitHub API.
 * Shows what the algorithm rewards right now — not the algorithm itself.
 */
import Link from "next/link";

import { getLatestYoutubeCategories, type YtCategory, type YtForm } from "@/lib/meme";
import { formatEN } from "@/lib/format";

export const dynamic = "force-dynamic";

const ORDER = ["ai", "news", "finance", "gaming", "entertainment", "education"];

const FORM_META: Record<string, { label: string; icon: string }> = {
  short: { label: "숏폼 (Shorts)", icon: "🩳" },
  long: { label: "롱폼", icon: "🎬" },
};

function watchUrl(id: string | null): string {
  return id ? `https://www.youtube.com/watch?v=${id}` : "#";
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function FormBlock({ form, data }: { form: string; data: YtForm }) {
  const meta = FORM_META[form] ?? { label: form, icon: "" };
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">
          {meta.icon} {meta.label}
        </h3>
        <span className="text-xs text-zinc-500">{data.video_count} videos</span>
      </div>

      {data.video_count === 0 ? (
        <p className="text-xs text-zinc-500">
          No data this run{data.error?.includes("429") ? " (quota — retries next run)" : ""}.
        </p>
      ) : (
        <>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 mb-1.5">
              🏷️ 태그 (그대로 쓸 SEO 키워드)
            </p>
            <ul className="flex flex-wrap gap-1">
              {data.top_tags.slice(0, 12).map((t) => (
                <li
                  key={t.tag}
                  className="rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[11px]"
                >
                  #{t.tag}
                </li>
              ))}
              {data.top_tags.length === 0 && (
                <li className="text-[11px] text-zinc-400">no tags</li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-medium text-zinc-500 mb-1.5">
              💬 제목 키워드
            </p>
            <ul className="flex flex-wrap gap-1">
              {data.top_title_keywords.slice(0, 10).map((k) => (
                <li
                  key={k.keyword}
                  className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px]"
                >
                  {k.keyword}
                </li>
              ))}
            </ul>
          </div>

          <ol className="space-y-1 pt-1">
            {data.top_videos.slice(0, 5).map((v, i) => (
              <li key={v.video_id ?? i} className="flex items-baseline gap-1.5 text-xs">
                <span className="w-3 shrink-0 text-zinc-400 tabular-nums">{i + 1}</span>
                <a
                  href={watchUrl(v.video_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate hover:underline"
                  title={v.title ?? ""}
                >
                  {v.title}
                </a>
                <span className="shrink-0 text-zinc-400 tabular-nums">
                  {fmtDuration(v.duration_seconds)} · {formatEN(v.view_count ?? 0)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

const EMPTY_FORM: YtForm = {
  video_count: 0,
  top_videos: [],
  top_tags: [],
  top_title_keywords: [],
};

function CategorySection({ cat }: { cat: YtCategory }) {
  // Defensive: tolerate an older flat-shaped snapshot (no short/long) so a
  // stale cache during a shape change can't 500 the page.
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">▶️ {cat.label}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormBlock form="short" data={cat.short ?? EMPTY_FORM} />
        <FormBlock form="long" data={cat.long ?? EMPTY_FORM} />
      </div>
    </section>
  );
}

export default async function YoutubePage() {
  const snap = await getLatestYoutubeCategories();

  const ordered: YtCategory[] = snap
    ? [
        ...ORDER.filter((k) => snap.categories[k]).map((k) => snap.categories[k]!),
        ...Object.entries(snap.categories)
          .filter(([k]) => !ORDER.includes(k))
          .map(([, c]) => c),
      ]
    : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <header>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← back to overview
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          ▶️ YouTube by category
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Short-form (Shorts) and long-form split out per niche — they ride
          different algorithms. Tags + title keywords = what to model your own
          videos on.
          {snap && (
            <span className="text-zinc-400">
              {" "}
              (last {snap.window_days}d · {snap._meta.fetched_at.slice(0, 10)})
            </span>
          )}
        </p>
      </header>

      {!snap ? (
        <p className="text-sm text-zinc-500">
          No YouTube category snapshot yet — run{" "}
          <code className="font-mono">crawlers.youtube_categories</code> in
          meme_project (daily crawl_sectors workflow).
        </p>
      ) : (
        <div className="space-y-8">
          {ordered.map((c) => (
            <CategorySection key={c.label} cat={c} />
          ))}
        </div>
      )}

      <footer className="text-xs text-zinc-500 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        Tags are each video&apos;s own SEO keywords. Shows what the algorithm is
        rewarding right now — not the algorithm itself.
      </footer>
    </main>
  );
}
