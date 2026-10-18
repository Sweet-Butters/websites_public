/**
 * Renders the raw per-source values for a keyword alongside what each
 * number actually MEANS (absolute view count vs 0-100 relative index).
 *
 * Goal: cure the "everything is 100" confusion users hit when reading
 * the trend_score column. trend_score is normalised per day; the raw
 * column tells you "AI got 1.2B real TikTok views this snapshot" or
 * "AI was a 76 on Naver's 0-100 search-interest scale today".
 */
import { describeSource, formatEN, formatKR, SOURCE_KIND } from "@/lib/format";

type Props = {
  raw: Record<string, number>;
  trendScore: number;
};

const SOURCE_LABEL: Record<string, string> = {
  youtube_trending: "YouTube trending",
  tiktok_creative: "TikTok hashtags",
  naver_search_ad: "Naver Search Ad",
  pytrends_sector: "Google Trends KR",
  naver_datalab: "Naver DataLab",
};

export function AbsoluteValuesTable({ raw, trendScore }: Props) {
  const rows = Object.entries(raw);
  if (rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        (no per-source raw values in latest snapshot)
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-zinc-500">
              source
            </th>
            <th className="px-3 py-2 text-left font-medium text-zinc-500">
              meaning
            </th>
            <th className="px-3 py-2 text-right font-medium text-zinc-500">
              value
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map(([src, val]) => {
            const kind = SOURCE_KIND[src] ?? "relative_index";
            const isAbs = kind.startsWith("absolute");
            return (
              <tr key={src}>
                <td className="px-3 py-2 font-medium">
                  {SOURCE_LABEL[src] ?? src}
                  <span className="ml-1 text-[10px] text-zinc-400 font-mono">
                    {src}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">
                  {describeSource(src)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {isAbs ? (
                    <span>
                      <span className="font-medium">{formatKR(val)}</span>
                      <span className="ml-2 text-xs text-zinc-400">
                        {formatEN(val)}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium">{val.toFixed(1)}</span>
                  )}
                </td>
              </tr>
            );
          })}
          <tr className="bg-zinc-50 dark:bg-zinc-900">
            <td className="px-3 py-2 font-medium">trend_score (synth)</td>
            <td className="px-3 py-2 text-xs text-zinc-500">
              cross-source 가중 정규화 (0-100, 같은 날 1위 = 100)
            </td>
            <td className="px-3 py-2 text-right tabular-nums font-medium">
              {trendScore.toFixed(1)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
