/**
 * Tiny markdown → React renderer.
 *
 * The trend_brief body uses a very constrained markdown subset (the
 * SYSTEM_PROMPT in agents/trend_brief.py enforces it): h1/h2 headers,
 * bullet lists, **bold**, _italic_, plus inline code in backticks.
 *
 * Pulling react-markdown for ~20KB just to render that is overkill. This
 * 80-line component covers the subset and emits properly-styled Tailwind
 * elements. If the brief format ever grows beyond what's parsed here, we
 * swap to react-markdown in one place.
 */
import type { JSX, ReactNode } from "react";

type Props = { source: string };

const HEADER = /^(#{1,3})\s+(.+)$/;
const ULIST = /^(?:[-•]|\d+\.)\s+(.+)$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let key = 0;
  const pattern = /(\*\*([^*]+)\*\*)|(_([^_]+)_)|(`([^`]+)`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push(text.slice(lastIndex, m.index));
    }
    if (m[2] !== undefined) {
      out.push(<strong key={`${keyPrefix}-b-${key++}`}>{m[2]}</strong>);
    } else if (m[4] !== undefined) {
      out.push(<em key={`${keyPrefix}-i-${key++}`}>{m[4]}</em>);
    } else if (m[6] !== undefined) {
      out.push(
        <code
          key={`${keyPrefix}-c-${key++}`}
          className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[0.9em] font-mono"
        >
          {m[6]}
        </code>,
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }
  return out;
}

export function Markdown({ source }: Props) {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listBuf: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuf.length === 0) return;
    blocks.push(
      <ul
        key={`l-${key++}`}
        className="list-disc list-outside ml-5 space-y-1 my-2"
      >
        {listBuf.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    const h = HEADER.exec(line);
    if (h) {
      flushList();
      const level = h[1]!.length;
      const text = h[2]!;
      const Tag: keyof JSX.IntrinsicElements =
        level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      const className =
        level === 1
          ? "text-2xl font-semibold mt-6 mb-2"
          : level === 2
          ? "text-xl font-semibold mt-5 mb-2"
          : "text-lg font-medium mt-4 mb-1";
      blocks.push(
        <Tag key={`h-${key++}`} className={className}>
          {renderInline(text, `h-${key}`)}
        </Tag>,
      );
      continue;
    }
    const li = ULIST.exec(line);
    if (li) {
      listBuf.push(li[1]!);
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${key++}`} className="my-2 leading-relaxed">
        {renderInline(line, `p-${key}`)}
      </p>,
    );
  }
  flushList();

  return (
    <article className="text-sm sm:text-base text-zinc-800 dark:text-zinc-200">
      {blocks}
    </article>
  );
}
