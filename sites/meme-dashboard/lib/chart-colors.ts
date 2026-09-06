/**
 * Shared chart color palette. Kept out of MultiLineChart.tsx (which is
 * "use client") so server components can import it without crashing the
 * client/server boundary.
 */
const COLORS = [
  "text-blue-600 dark:text-blue-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-rose-600 dark:text-rose-400",
  "text-amber-600 dark:text-amber-400",
  "text-violet-600 dark:text-violet-400",
  "text-cyan-600 dark:text-cyan-400",
];

export function chartColorClass(index: number): string {
  return COLORS[index % COLORS.length]!;
}
