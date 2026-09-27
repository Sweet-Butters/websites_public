"use client";

/**
 * Multi-series line chart in pure SVG with hover crosshair tooltip.
 *
 * Up to ~6 series before legibility dies; the parent should cap the slice.
 * Each series is rendered as a colored polyline; the y-axis is shared
 * across all series (max of maxes). x-axis is unitless — index aligned.
 *
 * Hover behaviour:
 *  - Mouse move over the chart maps cursor X → nearest data index.
 *  - A thin vertical crosshair + colored dots at each series' value
 *    track the index.
 *  - A small floating panel (top-left, fixed in container) shows the
 *    date and per-series value at that index.
 *  - Leaving the chart drops the indicator and panel.
 */
import { useRef, useState } from "react";

type Series = {
  label: string;
  values: number[];
  /** Tailwind text color class for the stroke (uses currentColor). */
  colorClass: string;
};

type Props = {
  series: Series[];
  dates: string[]; // ISO YYYY-MM-DD per index
  height?: number;
  strokeWidth?: number;
};

// chartColorClass moved to lib/chart-colors.ts so server components can
// import it without crossing the client/server boundary.
export { chartColorClass } from "@/lib/chart-colors";

export function MultiLineChart({
  series,
  dates,
  height = 220,
  strokeWidth = 1.75,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (series.length === 0 || dates.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-zinc-500"
        style={{ height }}
      >
        (no data)
      </div>
    );
  }

  // Shared y-scale across all series for accurate visual comparison.
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) {
    for (const v of s.values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const span = hi - lo || 1;

  const W = 100;
  const padTop = strokeWidth;
  const padBottom = strokeWidth;
  const drawH = height - padTop - padBottom;
  const n = dates.length;
  const stepX = n > 1 ? W / (n - 1) : 0;

  const yFor = (v: number) =>
    padTop + drawH - ((v - lo) / span) * drawH;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const xFrac = (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, xFrac));
    const i = Math.round(clamped * (n - 1));
    if (i !== activeIndex) setActiveIndex(i);
  }

  function handleLeave() {
    setActiveIndex(null);
  }

  const activeDate = activeIndex !== null ? dates[activeIndex] : null;
  // In SVG coordinates: the active x position.
  const activeX = activeIndex !== null ? activeIndex * stepX : 0;

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative"
        style={{ height }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <svg
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height, display: "block" }}
        >
          {series.map((s) => {
            const d = s.values
              .map((v, i) => {
                const x = i * stepX;
                const y = yFor(v);
                return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
              })
              .join(" ");
            return (
              <path
                key={s.label}
                d={d}
                fill="none"
                className={s.colorClass}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {activeIndex !== null && (
            <g pointerEvents="none">
              <line
                x1={activeX}
                y1={0}
                x2={activeX}
                y2={height}
                stroke="currentColor"
                strokeWidth={0.5}
                strokeDasharray="2 2"
                className="text-zinc-400 dark:text-zinc-600"
                vectorEffect="non-scaling-stroke"
              />
              {series.map((s) => {
                const v = s.values[activeIndex];
                if (v === undefined) return null;
                return (
                  <circle
                    key={s.label}
                    cx={activeX}
                    cy={yFor(v)}
                    r={1.6}
                    className={s.colorClass}
                    fill="currentColor"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {activeIndex !== null && activeDate && (
          <div
            className="absolute top-2 left-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm px-3 py-2 text-xs pointer-events-none"
            style={{ minWidth: 140 }}
          >
            <div className="font-mono font-medium mb-1">{activeDate}</div>
            <ul className="space-y-0.5">
              {series.map((s) => {
                const v = s.values[activeIndex];
                return (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${s.colorClass}`}
                        style={{ backgroundColor: "currentColor" }}
                      />
                      <span className="truncate max-w-[100px]">{s.label}</span>
                    </span>
                    <span className="tabular-nums">
                      {v === undefined ? "—" : v.toFixed(1)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{dates[0]}</span>
        <span>
          y: {lo.toFixed(0)} – {hi.toFixed(0)}
        </span>
        <span>{dates[dates.length - 1]}</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className={`inline-block w-3 h-0.5 ${s.colorClass}`}
              style={{ backgroundColor: "currentColor" }}
            />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
