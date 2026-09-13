/**
 * Cross-repo data access into Sweet-Butters/meme_project.
 *
 * meme_project is private, so we hit the GitHub Contents API with a
 * fine-grained PAT (env: GH_TOKEN). Everything here runs server-side —
 * never import this module from a client component.
 *
 * Cache strategy: server-fetch with Next.js revalidate. The underlying
 * data updates daily, so a 1-hour revalidate window keeps the UI fresh
 * without burning the 5000-req/hr GitHub quota.
 */

const REPO_OWNER = "Sweet-Butters";
const REPO_NAME = "meme_project";
const REVALIDATE_SECONDS = 3600;

type GhItem = { name: string; path: string; type: "file" | "dir"; sha: string };

class MissingTokenError extends Error {
  constructor() {
    super(
      "GH_TOKEN env var is missing. Create a fine-grained PAT scoped to " +
        "Sweet-Butters/meme_project with `Contents: Read`, then export it " +
        "as GH_TOKEN locally (.env.local) and in Vercel.",
    );
  }
}

function authHeaders(): HeadersInit {
  const token = process.env.GH_TOKEN;
  if (!token) throw new MissingTokenError();
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Per-call cache: a number = revalidate seconds; false = no-store (always
 * fresh, bypassing Vercel's cross-deployment Data Cache). */
type CachePolicy = number | false;

function fetchInit(extraHeaders: HeadersInit, cache: CachePolicy): RequestInit {
  return cache === false
    ? { headers: extraHeaders, cache: "no-store" }
    : { headers: extraHeaders, next: { revalidate: cache } };
}

async function ghGet<T>(
  path: string,
  cache: CachePolicy = REVALIDATE_SECONDS,
): Promise<T> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${path}`;
  const res = await fetch(url, fetchInit(authHeaders(), cache));
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * List filenames under `state/<source>/`, sorted ascending.
 *
 * The Contents API caps responses at 1000 entries per page — which is
 * plenty for our daily-snapshot directories. Pagination can be added if
 * any source grows past that.
 */
export async function listSnapshotFilenames(
  source: string,
  cache: CachePolicy = REVALIDATE_SECONDS,
): Promise<string[]> {
  const items = await ghGet<GhItem[]>(
    `contents/state/${source}?ref=main`,
    cache,
  );
  return items
    .filter((it) => it.type === "file" && it.name.endsWith(".json"))
    .map((it) => it.name)
    .sort();
}

/**
 * Fetch a JSON snapshot file by source + filename in a single API call.
 *
 * The naive approach (contents API → download_url → second fetch) breaks
 * for private repos: the download_url is a raw.githubusercontent.com link
 * with an embedded `?token=` that expires in ~5 minutes. Our 1-hour cache
 * window happily caches the stale URL and then 404s when called.
 *
 * Setting `Accept: application/vnd.github.raw+json` makes the contents
 * endpoint return the raw bytes directly — one cacheable request, no
 * token-expiry foot-gun.
 */
export async function fetchSnapshot<T = unknown>(
  source: string,
  filename: string,
  cache: CachePolicy = REVALIDATE_SECONDS,
): Promise<T> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/state/${source}/${filename}?ref=main`;
  const res = await fetch(
    url,
    fetchInit(
      { ...authHeaders(), Accept: "application/vnd.github.raw+json" },
      cache,
    ),
  );
  if (!res.ok) {
    throw new Error(
      `Failed to download ${source}/${filename}: ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

// --- domain types -------------------------------------------------------

export type SynthKeyword = {
  keyword: string;
  sources: string[];
  raw: Record<string, number>;
  trend_score: number;
};

export type SynthSnapshot = {
  _meta: { source: string; fetched_at: string; backfilled?: boolean };
  sources_used: string[];
  weights: Record<string, number>;
  total_keywords: number;
  keywords: SynthKeyword[];
};

/**
 * Latest synth_hot_keywords snapshot. Listed names are sorted ascending,
 * so the last one (filename starts with ISO timestamp) is the newest.
 */
export async function getLatestSynth(): Promise<SynthSnapshot> {
  const names = await listSnapshotFilenames("synth_hot_keywords");
  if (names.length === 0) {
    throw new Error("no synth snapshots in meme_project");
  }
  const newest = names[names.length - 1]!;
  return fetchSnapshot<SynthSnapshot>("synth_hot_keywords", newest);
}

/**
 * For a specific keyword: build a daily time series of trend_score (or
 * a chosen raw source value) over [from, to]. Mirrors the
 * `analytics.timeline.keyword_intensity` policy: latest snapshot per day,
 * zero-fill missing days.
 */
export type IntensityPoint = { date: string; value: number };

export async function getKeywordIntensity(
  keyword: string,
  from: Date,
  to: Date,
  source?: string,
): Promise<IntensityPoint[]> {
  const names = await listSnapshotFilenames("synth_hot_keywords");
  // Names look like "2026-05-22T23-59-59+00-00.json". The leading 10 chars
  // are the date — that's enough for our per-day bucketing.
  const byDay = new Map<string, SynthSnapshot>();
  // Limit how much we fetch — at most one snapshot per day in range.
  const dayWindow = new Set<string>();
  for (
    let d = new Date(from);
    d.getTime() <= to.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    dayWindow.add(d.toISOString().slice(0, 10));
  }

  // Walk filenames in reverse so we encounter the latest snap of each day first.
  for (const name of [...names].reverse()) {
    const day = name.slice(0, 10);
    if (!dayWindow.has(day) || byDay.has(day)) continue;
    const snap = await fetchSnapshot<SynthSnapshot>("synth_hot_keywords", name);
    byDay.set(day, snap);
  }

  const days = Array.from(dayWindow).sort();
  return days.map((day) => {
    const snap = byDay.get(day);
    if (!snap) return { date: day, value: 0 };
    const row = snap.keywords.find((k) => k.keyword === keyword);
    if (!row) return { date: day, value: 0 };
    const v = source ? row.raw[source] ?? 0 : row.trend_score;
    return { date: day, value: Number(v) };
  });
}

/**
 * Multi-source intensity for one keyword in one pass. Reads every snapshot
 * in the window once instead of N times (one per source) — keeps GitHub
 * traffic linear in window length, not in source count.
 */
export type MultiSourceIntensity = {
  days: string[];
  series: Record<string, number[]>; // "trend_score" + each raw source
};

export async function getKeywordMultiIntensity(
  keyword: string,
  from: Date,
  to: Date,
): Promise<MultiSourceIntensity> {
  const names = await listSnapshotFilenames("synth_hot_keywords");
  const dayWindow = new Set<string>();
  for (
    let d = new Date(from);
    d.getTime() <= to.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    dayWindow.add(d.toISOString().slice(0, 10));
  }

  const byDay = new Map<string, SynthSnapshot>();
  for (const name of [...names].reverse()) {
    const day = name.slice(0, 10);
    if (!dayWindow.has(day) || byDay.has(day)) continue;
    const snap = await fetchSnapshot<SynthSnapshot>(
      "synth_hot_keywords",
      name,
    );
    byDay.set(day, snap);
  }

  const days = Array.from(dayWindow).sort();
  const series: Record<string, number[]> = { trend_score: [] };
  for (const day of days) {
    const snap = byDay.get(day);
    const row = snap?.keywords.find((k) => k.keyword === keyword);
    series.trend_score!.push(row?.trend_score ?? 0);
    if (row) {
      for (const [src, val] of Object.entries(row.raw)) {
        if (!series[src]) series[src] = new Array(series.trend_score!.length - 1).fill(0);
        series[src]!.push(Number(val));
      }
    }
    // Pad sources that didn't appear today.
    const target = series.trend_score!.length;
    for (const src of Object.keys(series)) {
      while (series[src]!.length < target) series[src]!.push(0);
    }
  }
  return { days, series };
}

/**
 * Union of every keyword that appears in the latest synth snapshot.
 * Used by the client-side search autocomplete.
 */
export async function getAllKeywords(): Promise<string[]> {
  const snap = await getLatestSynth();
  return snap.keywords.map((k) => k.keyword).sort();
}

// --- trend brief ---------------------------------------------------------

/** Snapshot written by agents/trend_brief in meme_project after each digest. */
export type BriefSnapshot = {
  _meta: { source: string; fetched_at: string };
  as_of: string | null;
  source: "llm" | "stat_fallback (llm unavailable)" | "stat_fallback (forced)" | string;
  history_days_available: number;
  label_counts: Record<string, number>;
  body: string; // markdown
  _written_to?: string;
};

export async function getLatestBrief(): Promise<BriefSnapshot | null> {
  const names = await listSnapshotFilenames("trend_brief");
  if (names.length === 0) return null;
  const newest = names[names.length - 1]!;
  return fetchSnapshot<BriefSnapshot>("trend_brief", newest);
}

export async function listBriefFilenames(): Promise<string[]> {
  try {
    return await listSnapshotFilenames("trend_brief");
  } catch {
    return [];
  }
}

export async function getBriefByFilename(filename: string): Promise<BriefSnapshot> {
  return fetchSnapshot<BriefSnapshot>("trend_brief", filename);
}

/**
 * Scan every committed brief, extract the keywords mentioned in each
 * (best-effort regex over the markdown body), then count the LONGEST
 * trailing run of consecutive daily appearances for each keyword.
 *
 * Returns: { keyword → { consecutiveDays, lastSeen } }
 *
 * "Consecutive" means appears in each daily brief ending with the most
 * recent one — gaps reset the counter. Good enough for "이 키워드는
 * N일 연속 등장 중" labelling.
 */
export type ConsecutiveAppearance = {
  consecutiveDays: number;
  lastSeen: string; // YYYY-MM-DD
};

const _KEYWORD_RE = /\*\*([^*\n]{1,40})\*\*/g;

function _extractKeywords(body: string): Set<string> {
  const out = new Set<string>();
  for (const m of body.matchAll(_KEYWORD_RE)) {
    const kw = m[1]?.trim();
    if (!kw) continue;
    // Strip parenthetical scaffolding the LLM sometimes adds.
    const clean = kw.split(/\s*\(/)[0]!.trim();
    if (clean.length > 0 && clean.length < 40) out.add(clean);
  }
  return out;
}

export async function getKeywordConsecutiveAppearances(): Promise<
  Record<string, ConsecutiveAppearance>
> {
  const names = await listSnapshotFilenames("trend_brief");
  if (names.length === 0) return {};

  // Group by UTC date (in case multiple dispatches in one day) — keep latest.
  const byDay = new Map<string, string>();
  for (const name of names) {
    const day = name.slice(0, 10);
    byDay.set(day, name); // ascending order → later overwrites
  }
  const days = Array.from(byDay.keys()).sort();

  // Load each daily brief in parallel; small fan-out, well within quota.
  const briefs = await Promise.all(
    days.map((d) => fetchSnapshot<BriefSnapshot>("trend_brief", byDay.get(d)!)),
  );
  const keywordsPerDay = briefs.map((b) => _extractKeywords(b.body ?? ""));

  // For each keyword in the LATEST day, count back through preceding days.
  const latest = keywordsPerDay[keywordsPerDay.length - 1];
  if (!latest) return {};
  const out: Record<string, ConsecutiveAppearance> = {};
  const latestDay = days[days.length - 1]!;
  for (const kw of latest) {
    let run = 1;
    for (let i = keywordsPerDay.length - 2; i >= 0; i--) {
      if (keywordsPerDay[i]!.has(kw)) run++;
      else break;
    }
    out[kw] = { consecutiveDays: run, lastSeen: latestDay };
  }
  return out;
}

// --- momentum (z-score breakout signal) ----------------------------------

/**
 * One keyword's momentum, written by `synth.momentum` in meme_project.
 *
 * This is the SAME signal the daily digest / trend brief is built from:
 * a z-score of today's synth score against the trailing baseline window,
 * plus a human label. The home page ranks by this instead of the raw
 * `synth_hot_keywords.trend_score` — the latter is a cross-source composite
 * dominated by hardcoded seed keywords and a flat (zero-discrimination)
 * DataLab signal, so it does not reflect what is actually breaking out.
 */
export type MomentumKeyword = {
  keyword: string;
  label: string; // "🔥 Breakout" | "📈 Rising" | "💤 Steady" | "🆕 New" | "📉 Cooling"
  z_score: number;
  velocity: number;
  acceleration: number;
  score_today: number;
  mean_7d: number;
  std_7d: number;
  history_days: number;
  sources: string[];
};

export type MomentumSnapshot = {
  _meta: { source: string; fetched_at: string };
  as_of: string | null;
  history_days_available: number;
  baseline_window: number;
  thresholds: Record<string, number>;
  label_counts: Record<string, number>;
  keywords: MomentumKeyword[];
};

/**
 * A momentum label counts as "hot" (actually moving) when it's a Breakout,
 * Rising, or New term. Steady / Declining keywords are persistent or fading,
 * not trending — so a "what's hot now" / "breakout" view excludes them. This
 * is what keeps fixed seeds like ChatGPT / 딥러닝 out of the top tier: when
 * they're merely present (💤 Steady) they don't qualify, but a genuine spike
 * (🔥/📈) still surfaces them.
 */
export function isMomentumHot(label: string): boolean {
  return /Breakout|Rising|New/.test(label);
}

/**
 * Top-N "hot" keywords: hot labels only, ranked by z-score (then today's
 * score as a tie-break). Shared by the home overview and the recommendation
 * engine so both agree on what the top tier is.
 */
export function topHotMomentum(
  snap: MomentumSnapshot,
  n: number,
): MomentumKeyword[] {
  return snap.keywords
    .filter((k) => isMomentumHot(k.label))
    .slice()
    .sort((a, b) => b.z_score - a.z_score || b.score_today - a.score_today)
    .slice(0, n);
}

/**
 * Latest momentum snapshot, or null when the `synth.momentum` step has not
 * committed anything yet (e.g. fresh repo). Caller decides the fallback.
 */
export async function getLatestMomentum(): Promise<MomentumSnapshot | null> {
  let names: string[];
  try {
    names = await listSnapshotFilenames("momentum");
  } catch {
    // state/momentum/ doesn't exist yet (404) — treat as "no data".
    return null;
  }
  if (names.length === 0) return null;
  const newest = names[names.length - 1]!;
  return fetchSnapshot<MomentumSnapshot>("momentum", newest);
}

// --- per-platform tierlists ----------------------------------------------

/**
 * One platform's independent top-N, written by `synth.tierlists`. Separate
 * from the cross-source composite: each platform ranks its own latest crawl
 * so you can compare what's hot on Google vs YouTube vs TikTok vs Naver.
 */
export type TierlistEntry = {
  rank: number;
  keyword: string;
  score: number;
  score_pct: number; // within-list, top = 100
};

export type TierlistSnapshot = {
  _meta: { source: string; fetched_at: string };
  platform: string;
  source: string;
  top_n: number;
  total_candidates: number;
  keywords: TierlistEntry[];
};

/** Display order + the state source each platform's signal comes from. */
export const TIERLIST_PLATFORMS = [
  { id: "google", label: "Google Trends", icon: "🔎", source: "pytrends_sector" },
  { id: "youtube", label: "YouTube", icon: "▶️", source: "youtube_trending" },
  { id: "tiktok", label: "TikTok", icon: "🎵", source: "tiktok_creative" },
  { id: "naver", label: "Naver", icon: "🟢", source: "naver_datalab" },
] as const;

export type TierlistPlatform = (typeof TIERLIST_PLATFORMS)[number]["id"];

/** Latest tierlist for one platform, or null when none committed yet. */
export async function getLatestTierlist(
  platform: string,
): Promise<TierlistSnapshot | null> {
  let names: string[];
  try {
    names = await listSnapshotFilenames(`tierlist_${platform}`);
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  const newest = names[names.length - 1]!;
  return fetchSnapshot<TierlistSnapshot>(`tierlist_${platform}`, newest);
}

// --- YouTube per-category trending ---------------------------------------

export type YtVideo = {
  video_id: string | null;
  title: string | null;
  channel_title: string | null;
  view_count: number | null;
  duration_seconds?: number | null;
};

/** One form (short or long) of a category — they run on different algorithms. */
export type YtForm = {
  video_count: number;
  top_videos: YtVideo[];
  top_tags: { tag: string; videos: number; view_sum: number }[];
  top_title_keywords: { keyword: string; videos: number }[];
  error?: string;
};

export type YtCategory = {
  label: string;
  mechanism: string;
  query: string[] | null;
  short: YtForm;
  long: YtForm;
};

export type YoutubeCategoriesSnapshot = {
  _meta: { source: string; fetched_at: string };
  region_code: string;
  window_days: number;
  published_after: string;
  forms: string[];
  categories: Record<string, YtCategory>;
  errors: string[];
};

/** Latest per-category YouTube snapshot (written by crawlers.youtube_categories). */
export async function getLatestYoutubeCategories(): Promise<YoutubeCategoriesSnapshot | null> {
  // no-store: this dataset's shape evolved, and Vercel's Data Cache persists
  // across deployments — caching here served a stale flat-shaped snapshot to
  // the new code. Always read fresh (small payload, low traffic).
  let names: string[];
  try {
    names = await listSnapshotFilenames("youtube_categories", false);
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  const newest = names[names.length - 1]!;
  return fetchSnapshot<YoutubeCategoriesSnapshot>(
    "youtube_categories",
    newest,
    false,
  );
}

// --- demographics --------------------------------------------------------

export type DemoSeriesPoint = { period: string; ratio: number };

/** Per-keyword demographic time series. Each value is the raw DataLab
 * ratio (max in the series = 100), so we have to normalize across the
 * dimension to compute a percentage breakdown. */
export type KeywordDemographics = {
  baseline: DemoSeriesPoint[];
  gender: { m: DemoSeriesPoint[]; f: DemoSeriesPoint[] };
  ages: Record<string, DemoSeriesPoint[]>;
  device: { pc: DemoSeriesPoint[]; mo: DemoSeriesPoint[] };
};

export type DemographicsSnapshot = {
  start_date: string;
  end_date: string;
  time_unit: string;
  age_buckets: Record<string, string[]>;
  keywords: Record<string, KeywordDemographics>;
};

/** Read the latest naver_datalab_demo snapshot. Returns null when the
 * crawler hasn't run yet — caller decides how to render. */
export async function getLatestDemographicsSnapshot(): Promise<DemographicsSnapshot | null> {
  const names = await listSnapshotFilenames("naver_datalab_demo");
  if (names.length === 0) return null;
  const newest = names[names.length - 1]!;
  return fetchSnapshot<DemographicsSnapshot>("naver_datalab_demo", newest);
}

/** Mean ratio across all data points in a series. Empty → 0. */
function meanRatio(points: DemoSeriesPoint[]): number {
  if (points.length === 0) return 0;
  let s = 0;
  for (const p of points) s += p.ratio;
  return s / points.length;
}

/** Convert per-bucket mean ratios into a percentage distribution that
 * sums to 100 (or [] if the bucket map is empty / all-zero). */
function toPercent(buckets: Record<string, number>): Array<{ label: string; pct: number; raw: number }> {
  const entries = Object.entries(buckets);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total === 0) return entries.map(([label, raw]) => ({ label, pct: 0, raw }));
  return entries.map(([label, raw]) => ({
    label,
    pct: (raw / total) * 100,
    raw,
  }));
}

/** Stable label order for age buckets (matches the Python crawler). */
export const AGE_BUCKETS_ORDER = ["teens", "20s", "30s", "40s", "50s", "60+"];

/**
 * Marketing-facing breakdowns for one keyword:
 *   - gender  → male / female %
 *   - ages    → teens / 20s / .. / 60+ %
 *   - device  → pc / mobile %
 * `null` when the demo crawler hasn't run yet or the keyword isn't in
 * the snapshot's tracked set.
 */
export type Breakdown = Array<{ label: string; pct: number; raw: number }>;

export type KeywordBreakdowns = {
  startDate: string;
  endDate: string;
  gender: Breakdown;
  ages: Breakdown;
  device: Breakdown;
};

export async function getKeywordBreakdowns(
  keyword: string,
): Promise<KeywordBreakdowns | null> {
  const snap = await getLatestDemographicsSnapshot();
  if (!snap) return null;
  const k = snap.keywords[keyword];
  if (!k) return null;

  const gender = toPercent({
    male: meanRatio(k.gender?.m ?? []),
    female: meanRatio(k.gender?.f ?? []),
  });
  const agesRaw: Record<string, number> = {};
  for (const label of AGE_BUCKETS_ORDER) {
    agesRaw[label] = meanRatio(k.ages?.[label] ?? []);
  }
  const ages = toPercent(agesRaw);
  const device = toPercent({
    pc: meanRatio(k.device?.pc ?? []),
    mobile: meanRatio(k.device?.mo ?? []),
  });

  return {
    startDate: snap.start_date,
    endDate: snap.end_date,
    gender,
    ages,
    device,
  };
}

// --- demographic time-series (week-over-week deltas) ----------------------

/** A single dimension's distribution at a given period — used to detect
 * shifts ("30s 비중 급증") rather than just point-in-time levels. */
export type DemoWindow = {
  windowStart: string;
  windowEnd: string;
  gender: Breakdown;
  ages: Breakdown;
  device: Breakdown;
};

function _windowMean(
  points: DemoSeriesPoint[],
  start: string,
  end: string,
): number {
  let s = 0;
  let n = 0;
  for (const p of points) {
    if (p.period >= start && p.period <= end) {
      s += p.ratio;
      n++;
    }
  }
  return n === 0 ? 0 : s / n;
}

function _buildWindowFromKey(
  k: KeywordDemographics,
  start: string,
  end: string,
): DemoWindow {
  const gender = toPercent({
    male: _windowMean(k.gender?.m ?? [], start, end),
    female: _windowMean(k.gender?.f ?? [], start, end),
  });
  const agesRaw: Record<string, number> = {};
  for (const label of AGE_BUCKETS_ORDER) {
    agesRaw[label] = _windowMean(k.ages?.[label] ?? [], start, end);
  }
  const ages = toPercent(agesRaw);
  const device = toPercent({
    pc: _windowMean(k.device?.pc ?? [], start, end),
    mobile: _windowMean(k.device?.mo ?? [], start, end),
  });
  return { windowStart: start, windowEnd: end, gender, ages, device };
}

/** Split the demographic snapshot's date range into N equal-length
 * windows (newest → oldest, default 4 ≈ weekly windows over ~30 days).
 * Returns null when there's no demographic data for the keyword. */
export async function getKeywordDemoTimeline(
  keyword: string,
  windowCount = 4,
): Promise<DemoWindow[] | null> {
  const snap = await getLatestDemographicsSnapshot();
  if (!snap) return null;
  const k = snap.keywords[keyword];
  if (!k) return null;

  // Use the actual baseline series' span — it's the most reliable.
  // Fallback to snap.start_date/end_date if baseline is empty.
  const periods = (k.baseline ?? []).map((p) => p.period).sort();
  const start =
    periods.length > 0 ? periods[0]! : snap.start_date;
  const end =
    periods.length > 0 ? periods[periods.length - 1]! : snap.end_date;

  // Equal-length windows. Each window covers (end - start) / windowCount days.
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) {
    return [_buildWindowFromKey(k, start, end)];
  }
  const stepMs = (endMs - startMs) / windowCount;

  const windows: DemoWindow[] = [];
  for (let i = 0; i < windowCount; i++) {
    const wStartMs = startMs + i * stepMs;
    const wEndMs = i === windowCount - 1 ? endMs : startMs + (i + 1) * stepMs;
    const wStart = new Date(wStartMs).toISOString().slice(0, 10);
    const wEnd = new Date(wEndMs).toISOString().slice(0, 10);
    windows.push(_buildWindowFromKey(k, wStart, wEnd));
  }
  // Return newest-first so the UI naturally renders "this week → last week → ..."
  windows.reverse();
  return windows;
}

// --- Pearson + cross-correlation (TS port of analytics.leadlag) -----------

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function pearson(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

/**
 * For lag k ∈ [-maxLag, +maxLag], correlate x(t) with y(t+k).
 * Positive lag where ρ peaks → x is earlier → x leads y by that many steps.
 */
export function crossCorrelate(
  x: number[],
  y: number[],
  maxLag: number,
): Record<number, number | null> {
  const n = Math.min(x.length, y.length);
  if (n === 0) return {};
  const capped = Math.min(maxLag, n - 1);
  const out: Record<number, number | null> = {};
  for (let k = -capped; k <= capped; k++) {
    let xs: number[];
    let ys: number[];
    if (k >= 0) {
      xs = x.slice(0, n - k);
      ys = y.slice(k, n);
    } else {
      xs = x.slice(-k, n);
      ys = y.slice(0, n + k);
    }
    out[k] = pearson(xs, ys);
  }
  return out;
}

const MIN_OVERLAP = 7;
const WEAK_THRESHOLD = 0.4;
const STRONG_THRESHOLD = 0.6;

export type PairLeadLag = {
  sourceA: string;
  sourceB: string;
  bestLag: number;
  bestRho: number;
  strength: "weak" | "moderate" | "strong";
  overlapDays: number;
  insufficient: false;
} | {
  sourceA: string;
  sourceB: string;
  insufficient: true;
  overlapDays: number;
};

function findLeadFromSeries(
  sourceA: string,
  sourceB: string,
  xa: number[],
  xb: number[],
  maxLag: number,
): PairLeadLag {
  // Zero-fill (days before either source has data) artificially boosts
  // lag-0 correlation: "both zero" reads as "perfectly correlated". Trim
  // the leading + trailing run of "both-zero" days before computing CCF so
  // the analysis sees only the period of mutual data availability.
  const n = Math.min(xa.length, xb.length);
  let start = 0;
  while (start < n && xa[start]! === 0 && xb[start]! === 0) start++;
  let end = n;
  while (end > start && xa[end - 1]! === 0 && xb[end - 1]! === 0) end--;
  const tx = xa.slice(start, end);
  const ty = xb.slice(start, end);

  let overlap = 0;
  for (let i = 0; i < tx.length; i++) {
    if (tx[i]! > 0 && ty[i]! > 0) overlap++;
  }
  if (overlap < MIN_OVERLAP) {
    return { sourceA, sourceB, insufficient: true, overlapDays: overlap };
  }
  const ccf = crossCorrelate(tx, ty, maxLag);
  let bestLag = 0;
  let bestRho = 0;
  for (const [k, r] of Object.entries(ccf)) {
    if (r === null) continue;
    if (Math.abs(r) > Math.abs(bestRho)) {
      bestRho = r;
      bestLag = Number(k);
    }
  }
  const strength =
    Math.abs(bestRho) >= STRONG_THRESHOLD ? "strong" :
    Math.abs(bestRho) >= WEAK_THRESHOLD   ? "moderate" : "weak";
  return {
    sourceA, sourceB,
    bestLag, bestRho,
    strength,
    overlapDays: overlap,
    insufficient: false,
  };
}

export type LeadLagMatrix = {
  keyword: string;
  sources: string[];
  cells: Record<string, PairLeadLag>; // key = `${a}|${b}`
};

/**
 * Build a pairwise lead/lag matrix for one keyword over a date window.
 * Only the upper triangle is computed; the lower triangle is mirrored
 * (anti-symmetric on bestLag).
 */
export async function getLeadLagMatrix(
  keyword: string,
  from: Date,
  to: Date,
  maxLag = 14,
): Promise<LeadLagMatrix> {
  const multi = await getKeywordMultiIntensity(keyword, from, to);
  const sources = Object.keys(multi.series).filter((s) => s !== "trend_score");

  const cells: Record<string, PairLeadLag> = {};
  for (let i = 0; i < sources.length; i++) {
    for (let j = 0; j < sources.length; j++) {
      const a = sources[i]!;
      const b = sources[j]!;
      if (i === j) continue;
      if (i < j) {
        cells[`${a}|${b}`] = findLeadFromSeries(
          a, b,
          multi.series[a]!,
          multi.series[b]!,
          maxLag,
        );
      } else {
        // Mirror.
        const mirror = cells[`${b}|${a}`]!;
        if (mirror.insufficient) {
          cells[`${a}|${b}`] = { ...mirror, sourceA: a, sourceB: b };
        } else {
          cells[`${a}|${b}`] = {
            ...mirror,
            sourceA: a, sourceB: b,
            bestLag: -mirror.bestLag,
          };
        }
      }
    }
  }
  return { keyword, sources, cells };
}
