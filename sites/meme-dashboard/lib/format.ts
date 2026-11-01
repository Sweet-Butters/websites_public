/**
 * Compact-number formatting helpers.
 *
 * Designed for "raw" cross-source values where the scale ranges from
 * tens (DataLab ratio) to billions (TikTok hashtag views). Returns the
 * shortest readable form per Korean reading convention (만/억) plus an
 * English fallback (K/M/B) for sources without a clear local idiom.
 */

/** "12.3억", "3.5만", "9,512", "0.0" — Korean-style compact number. */
export function formatKR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(abs >= 1e9 ? 0 : 1)}억`;
  if (abs >= 1e4) return `${(n / 1e4).toFixed(abs >= 1e5 ? 0 : 1)}만`;
  if (abs >= 1) return n.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  return n.toFixed(2);
}

/** "1.2B" / "350M" / "75K" — common engineering compact. */
export function formatEN(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(abs < 1 ? 2 : 0);
}

/** Per-source semantics: is the raw value an absolute count or a 0-100 index? */
export const SOURCE_KIND: Record<string, "absolute_views" | "absolute_count" | "relative_index"> = {
  youtube_trending: "absolute_views",
  tiktok_creative: "absolute_views",
  naver_search_ad: "absolute_count",
  pytrends_sector: "relative_index",
  naver_datalab: "relative_index",
};

export function describeSource(src: string): string {
  const kind = SOURCE_KIND[src];
  if (kind === "absolute_views") return "조회수 합 (절대값)";
  if (kind === "absolute_count") return "월간 검색량 (절대값)";
  if (kind === "relative_index") return "관심 지수 (0-100 상대값)";
  return src;
}
