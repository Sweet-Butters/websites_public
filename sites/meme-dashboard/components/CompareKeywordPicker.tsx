"use client";

/**
 * Client-side keyword chip editor for the /compare page.
 *
 * Renders the currently selected keywords as removable chips, plus an
 * autocomplete input to add more. On every change, updates the URL with
 * the new `?kw=...` so the server-rendered page re-fetches.
 */
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

const MAX = 5;

type Props = {
  allKeywords: string[];
  current: string[];
  source: string;
  fromStr: string;
  toStr: string;
};

export function CompareKeywordPicker({
  allKeywords,
  current,
  source,
  fromStr,
  toStr,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const taken = new Set(current);
    const pool = allKeywords.filter((k) => !taken.has(k));
    if (!q) return pool.slice(0, 8);
    return pool.filter((k) => k.toLowerCase().includes(q)).slice(0, 8);
  }, [query, current, allKeywords]);

  function push(kws: string[]) {
    const next = new URLSearchParams(params);
    if (kws.length === 0) {
      next.delete("kw");
    } else {
      next.set("kw", kws.join(","));
    }
    next.set("source", source);
    next.set("from", fromStr);
    next.set("to", toStr);
    router.push(`${pathname}?${next.toString()}`);
  }

  function add(kw: string) {
    if (current.length >= MAX) return;
    if (current.includes(kw)) return;
    push([...current, kw]);
    setQuery("");
  }

  function remove(kw: string) {
    push(current.filter((k) => k !== kw));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {current.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs"
          >
            {kw}
            <button
              type="button"
              onClick={() => remove(kw)}
              aria-label={`remove ${kw}`}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ×
            </button>
          </span>
        ))}
        {current.length === 0 && (
          <span className="text-xs text-zinc-500">(no keywords yet)</span>
        )}
      </div>
      {current.length < MAX && (
        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={query}
            placeholder={`Add keyword (max ${MAX})`}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {focused && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute top-full mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg z-10"
            >
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={() => add(s)}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
