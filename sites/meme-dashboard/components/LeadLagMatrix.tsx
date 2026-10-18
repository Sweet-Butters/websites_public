/**
 * Pairwise lead/lag grid rendered as a compact HTML table.
 *
 * Each cell shows "lag / ρ" (or "—" when insufficient data), background
 * tinted by sign of best ρ (positive = blue, negative = red). Diagonal
 * cells are intentionally blank.
 *
 * Designed for ~4-source matrices today; the layout responds to whatever
 * source set we get from getLeadLagMatrix.
 */
import type { LeadLagMatrix } from "@/lib/meme";

const SHORT_NAMES: Record<string, string> = {
  pytrends_sector: "pytrends",
  naver_datalab: "datalab",
  tiktok_creative: "tiktok",
  youtube_trending: "youtube",
};

function tintForRho(rho: number | undefined): string {
  if (rho === undefined) return "bg-zinc-50 dark:bg-zinc-900";
  const abs = Math.min(Math.abs(rho), 1);
  // Tailwind classes are static; pick from a fixed palette.
  if (rho > 0) {
    if (abs >= 0.6) return "bg-blue-200 dark:bg-blue-900/60";
    if (abs >= 0.4) return "bg-blue-100 dark:bg-blue-900/30";
    return "bg-blue-50 dark:bg-blue-950/30";
  }
  if (abs >= 0.6) return "bg-red-200 dark:bg-red-900/60";
  if (abs >= 0.4) return "bg-red-100 dark:bg-red-900/30";
  return "bg-red-50 dark:bg-red-950/30";
}

export function LeadLagMatrixView({ matrix }: { matrix: LeadLagMatrix }) {
  const { sources, cells } = matrix;
  const shortName = (s: string): string => SHORT_NAMES[s] ?? s;

  if (sources.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No source raw values in latest synth — nothing to compare.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Positive number = <strong>row source leads column source</strong> by
        N days. Cells need ≥7 overlapping non-zero days, otherwise "—".
      </p>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-2 py-2 text-left text-zinc-500"> </th>
              {sources.map((b) => (
                <th
                  key={b}
                  className="px-2 py-2 text-center font-medium text-zinc-500"
                >
                  {shortName(b)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((a) => (
              <tr key={a}>
                <td className="px-2 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  {shortName(a)}
                </td>
                {sources.map((b) => {
                  if (a === b) {
                    return (
                      <td
                        key={b}
                        className="px-2 py-2 text-center text-zinc-300 dark:text-zinc-700"
                      >
                        ·
                      </td>
                    );
                  }
                  const cell = cells[`${a}|${b}`];
                  if (!cell || cell.insufficient) {
                    return (
                      <td
                        key={b}
                        className="px-2 py-2 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900"
                      >
                        —
                      </td>
                    );
                  }
                  return (
                    <td
                      key={b}
                      className={`px-2 py-2 text-center tabular-nums ${tintForRho(
                        cell.bestRho,
                      )}`}
                      title={`${cell.strength}, n=${cell.overlapDays}`}
                    >
                      <div className="font-medium">
                        {cell.bestLag > 0 ? "+" : ""}
                        {cell.bestLag}d
                      </div>
                      <div className="text-zinc-500 text-[10px]">
                        ρ {cell.bestRho.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
