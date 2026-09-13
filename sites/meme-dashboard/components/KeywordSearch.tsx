"use client";

/**
 * Client-side keyword combobox.
 *
 * The full keyword universe (currently ~102 entries) is small enough to
 * ship to the client as a single array — no need for incremental fetch.
 * Filtering happens in-memory; we render at most 10 suggestions to keep
 * the dropdown tight.
 *
 * On submit (Enter or click), navigates to /k/<encoded keyword>.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  keywords: string[];
  initial?: string;
};

const MAX_SUGGESTIONS = 10;

export function KeywordSearch({ keywords, initial = "" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keywords.slice(0, MAX_SUGGESTIONS);
    return keywords
      .filter((k) => k.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [query, keywords]);

  function go(kw: string) {
    const target = kw.trim();
    if (!target) return;
    router.push(`/k/${encodeURIComponent(target)}`);
  }

  return (
    <div className="relative w-full max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(query);
        }}
      >
        <input
          type="text"
          value={query}
          placeholder="Search a keyword — e.g. AI"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>
      {focused && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg z-10"
        >
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={() => go(s)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
