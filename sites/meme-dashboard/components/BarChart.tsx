/**
 * Horizontal percentage bar chart for demographic breakdowns.
 *
 * Each row gets a label, a colored bar, and a "NN%" number. Bars share
 * the same scale (0-100%) so categories are visually comparable across
 * dimensions (gender / ages / device).
 */
type Row = { label: string; pct: number; raw: number };

type Props = {
  rows: Row[];
  /** Tailwind text color class for the bars (uses currentColor). */
  colorClass?: string;
  /** When true, dim the raw value next to the bar for advanced readers. */
  showRaw?: boolean;
};

export function BarChart({
  rows,
  colorClass = "text-blue-600 dark:text-blue-400",
  showRaw = false,
}: Props) {
  if (rows.length === 0) {
    return <p className="text-xs text-zinc-500">(no data)</p>;
  }
  const total = rows.reduce((a, r) => a + r.pct, 0);
  // If everything zeros, just show empty rows.
  return (
    <div className="space-y-2 text-sm">
      {rows.map((r) => {
        const w = total === 0 ? 0 : Math.max(0, Math.min(100, r.pct));
        return (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-16 text-zinc-600 dark:text-zinc-400">
              {r.label}
            </span>
            <div className="flex-1 h-5 rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={colorClass}
                style={{
                  width: `${w}%`,
                  height: "100%",
                  backgroundColor: "currentColor",
                  transition: "width 200ms ease",
                }}
              />
            </div>
            <span className="w-14 text-right tabular-nums">
              {w.toFixed(0)}%
            </span>
            {showRaw && (
              <span className="w-12 text-right text-xs text-zinc-400">
                {r.raw.toFixed(0)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
