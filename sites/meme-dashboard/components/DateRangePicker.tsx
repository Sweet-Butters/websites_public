"use client";

/**
 * Date range picker.
 *
 * Two `<input type="date">` controls + an Apply button. On submit, pushes
 * the chosen `from` / `to` as URL search params on the current path —
 * server components on the page re-render with the new range.
 *
 * Kept dead-simple: no calendar widget, no presets list. The native date
 * input is good enough on every modern browser and we don't want a date
 * library in the bundle just for this.
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Props = {
  defaultFrom: string; // YYYY-MM-DD
  defaultTo: string;
};

export function DateRangePicker({ defaultFrom, defaultTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [from, setFrom] = useState(params.get("from") ?? defaultFrom);
  const [to, setTo] = useState(params.get("to") ?? defaultTo);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    next.set("from", from);
    next.set("to", to);
    router.push(`${pathname}?${next.toString()}`);
  }

  function quick(days: number) {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const newFrom = fmt(start);
    const newTo = fmt(end);
    setFrom(newFrom);
    setTo(newTo);
    const next = new URLSearchParams(params);
    next.set("from", newFrom);
    next.set("to", newTo);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-2 text-sm"
    >
      <label className="flex flex-col">
        <span className="text-xs text-zinc-500 mb-1">from</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-zinc-500 mb-1">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-medium"
      >
        Apply
      </button>
      <span className="flex gap-1 ml-2">
        {[7, 30, 60, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => quick(d)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            {d}d
          </button>
        ))}
      </span>
    </form>
  );
}
