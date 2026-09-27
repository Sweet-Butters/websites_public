"use client";

/**
 * Minimal stdlib-style sparkline: pure SVG, no chart library.
 *
 * Renders an N-point series as a smooth polyline + filled area. Sized via
 * the parent — fills container width, height set on the prop.
 *
 * When `dates` is passed, the sparkline becomes interactive: hover shows
 * a vertical crosshair, a colored dot at the active value, and a small
 * tooltip with the date + value. Without `dates`, it's the static fast
 * path (used in tight contexts like table cells where hover would feel
 * cluttered).
 */
import { useRef, useState } from "react";

type Props = {
  values: number[];
  height?: number;
  strokeWidth?: number;
  className?: string;
  /** Optional ISO date per index; enables hover tooltip when provided. */
  dates?: string[];
  /** Decimal places shown in the tooltip. Default 1. */
  valueDigits?: number;
};

export function Sparkline({
  values,
  height = 32,
  strokeWidth = 1.5,
  className,
  dates,
  valueDigits = 1,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (values.length === 0) {
    return <div className={className} style={{ height }} />;
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1; // avoid div-by-zero on constant series
  const w = 100;
  const n = values.length;
  const stepX = n > 1 ? w / (n - 1) : 0;
  const yFor = (v: number) =>
    height - ((v - lo) / span) * (height - 2 * strokeWidth) - strokeWidth;

  const pathD = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(2)} ${yFor(v).toFixed(2)}`)
    .join(" ");
  const areaD = `${pathD} L ${w} ${height} L 0 ${height} Z`;

  const interactive = Array.isArray(dates) && dates.length === n;

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

  const svg = (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
    >
      <path d={areaD} fill="currentColor" fillOpacity={0.12} />
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {interactive && activeIndex !== null && (
        <g pointerEvents="none">
          <line
            x1={activeIndex * stepX}
            y1={0}
            x2={activeIndex * stepX}
            y2={height}
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={0.5}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={activeIndex * stepX}
            cy={yFor(values[activeIndex]!)}
            r={2}
            fill="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  );

  if (!interactive) {
    return <div className={className}>{svg}</div>;
  }

  const activeDate =
    activeIndex !== null ? dates![activeIndex] ?? null : null;
  const activeValue =
    activeIndex !== null ? values[activeIndex] ?? null : null;

  return (
    <div
      ref={containerRef}
      className={`relative ${className ?? ""}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {svg}
      {activeDate !== null && activeValue !== null && (
        <div
          className="absolute -top-1 left-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm px-2 py-1 text-[10px] pointer-events-none whitespace-nowrap"
          style={{ transform: "translateY(-100%)" }}
        >
          <span className="font-mono">{activeDate}</span>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
          <span className="tabular-nums font-medium">
            {activeValue.toFixed(valueDigits)}
          </span>
        </div>
      )}
    </div>
  );
}
