/**
 * Demographic timeline strip — newest-first list of windowed breakdowns.
 *
 * Renders three compact BarCharts side-by-side per window (one row per
 * window) so the user can scan vertically for "this dimension shifted".
 * Each window's range is shown above its row.
 *
 * Optionally computes the delta from the previous (older) window for the
 * top window's bars — gives the "급증" type signal without prose.
 */
import type { Breakdown } from "@/lib/meme";

type Window = {
  windowStart: string;
  windowEnd: string;
  gender: Breakdown;
  ages: Breakdown;
  device: Breakdown;
};

function topBucketShift(curr: Breakdown, prev: Breakdown | undefined): string | null {
  if (!prev) return null;
  let biggest: { label: string; delta: number } | null = null;
  for (const c of curr) {
    const p = prev.find((x) => x.label === c.label);
    if (!p) continue;
    const delta = c.pct - p.pct;
    if (!biggest || Math.abs(delta) > Math.abs(biggest.delta)) {
      biggest = { label: c.label, delta };
    }
  }
  if (!biggest || Math.abs(biggest.delta) < 3) return null;
  const sign = biggest.delta > 0 ? "↑" : "↓";
  return `${sign} ${biggest.label} ${biggest.delta > 0 ? "+" : ""}${biggest.delta.toFixed(0)}pt`;
}

function MiniBar({
  rows,
  colorClass,
}: {
  rows: Breakdown;
  colorClass: string;
}) {
  return (
    <div className="space-y-1 text-[10px]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-1">
          <span className="w-12 truncate text-zinc-500">{r.label}</span>
          <div className="flex-1 h-2 rounded-sm bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={colorClass}
              style={{
                width: `${Math.max(0, Math.min(100, r.pct))}%`,
                height: "100%",
                backgroundColor: "currentColor",
              }}
            />
          </div>
          <span className="w-7 text-right tabular-nums">
            {r.pct.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DemoTimeline({ windows }: { windows: Window[] }) {
  if (windows.length === 0) {
    return <p className="text-sm text-zinc-500">(no window data)</p>;
  }
  return (
    <div className="space-y-4">
      {windows.map((w, i) => {
        const prev = windows[i + 1];
        const genderShift = topBucketShift(w.gender, prev?.gender);
        const agesShift = topBucketShift(w.ages, prev?.ages);
        const deviceShift = topBucketShift(w.device, prev?.device);
        return (
          <div
            key={`${w.windowStart}-${w.windowEnd}-${i}`}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
          >
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-medium">
                {w.windowStart} → {w.windowEnd}
              </p>
              {i === 0 && prev && (
                <p className="text-[10px] text-zinc-500">
                  vs previous window
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-medium">gender</p>
                  {genderShift && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400">
                      {genderShift}
                    </span>
                  )}
                </div>
                <MiniBar
                  rows={w.gender}
                  colorClass="text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-medium">age</p>
                  {agesShift && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      {agesShift}
                    </span>
                  )}
                </div>
                <MiniBar
                  rows={w.ages}
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-medium">device</p>
                  {deviceShift && (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400">
                      {deviceShift}
                    </span>
                  )}
                </div>
                <MiniBar
                  rows={w.device}
                  colorClass="text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
