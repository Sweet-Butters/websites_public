/**
 * Portfolio landing — short intro + a card per public-facing prototype.
 *
 * The page is static (no fetches, no params), so it pre-renders once at
 * build time and gets edge-cached by Vercel. No JS hydration cost beyond
 * the framework runtime.
 */
type Project = {
  title: string;
  blurb: string;
  tech: string[];
  links: { label: string; href: string }[];
  status?: "live" | "private" | "wip";
};

const PROJECTS: Project[] = [
  {
    title: "meme_project — KR trend radar + LLM brief",
    blurb:
      "Crawls YouTube + TikTok + Naver + Google daily, synthesises a cross-source ranking with RRF confidence + momentum + lead/lag analysis, and ships a Korean LLM-generated marketing brief to Telegram every morning. Backfilled with 1 month of historical data via WebShare residential proxy to bypass cloud IP blocks.",
    tech: ["Python", "GitHub Actions cron", "Naver DataLab", "pytrends", "Gemini"],
    links: [
      { label: "Dashboard", href: "https://meme-dashboard-theta.vercel.app" },
      { label: "Source", href: "https://github.com/Sweet-Butters/meme_project_public" },
    ],
    status: "live",
  },
  {
    title: "meme-dashboard — Next.js analytics frontend",
    blurb:
      "The viewing companion for meme_project. Server-rendered, no chart library — all SVG hand-rolled. Multi-source intensity sparklines, lead/lag matrix with auto zero-trim, demographic breakdown + week-over-week shifts, multi-keyword overlay, LLM-powered action recommendations. Reads private state via GitHub Contents API with a fine-grained PAT.",
    tech: ["Next.js 16", "TypeScript strict", "Tailwind 4", "Vercel"],
    links: [
      { label: "Live", href: "https://meme-dashboard-theta.vercel.app" },
      { label: "Source", href: "https://github.com/Sweet-Butters/websites_public" },
    ],
    status: "live",
  },
  {
    title: "mail-notifier — Gmail → Telegram triage",
    blurb:
      "Pulls Gmail every few minutes via the Gmail API, sends snippet + sender through Gemini for classification (important / promotional / spam), forwards only signal to Telegram. Cron + free LLM tier = $0 / month.",
    tech: ["Python", "Gmail API", "Gemini", "Telegram Bot API", "GitHub Actions"],
    links: [
      { label: "Source", href: "https://github.com/Sweet-Butters/mail-notifier" },
    ],
    status: "live",
  },
  {
    title: "auto_project — zero-cost agent framework",
    blurb:
      "The substrate every other project sits on: LLM router (Gemini → Groq → Cerebras failover), Telegram notifier, project-state helpers, JSON snapshot conventions. Versioned with semver; downstream repos pin a tag.",
    tech: ["Python", "github.com module install", "free-tier LLM routing"],
    links: [
      { label: "Source", href: "https://github.com/Sweet-Butters/auto_project" },
    ],
    status: "live",
  },
  {
    title: "Notes_project — YouTube → Obsidian",
    blurb:
      "Forward a YouTube URL to a Telegram bot; get back an LLM summary in your Obsidian vault, with transcript fallback chain (self-hosted runner → WebShare proxy → Whisper). Bridges with meme_project so trending video discoveries become deep-dive notes in one tap.",
    tech: ["Python", "yt-dlp", "youtube-transcript-api", "Gemini"],
    links: [],
    status: "private",
  },
];

const STATUS_LABEL: Record<NonNullable<Project["status"]>, string> = {
  live: "● live",
  private: "● private",
  wip: "● wip",
};

const STATUS_COLOR: Record<NonNullable<Project["status"]>, string> = {
  live: "text-emerald-600 dark:text-emerald-400",
  private: "text-zinc-400",
  wip: "text-amber-600 dark:text-amber-400",
};

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 space-y-12">
      <header>
        <p className="text-xs font-mono text-zinc-500 tracking-wider uppercase">
          Sweet-Butters · portfolio
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight leading-tight">
          Building data tools the lean way.
        </h1>
        <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Each project here is a self-contained prototype solving a real
          personal workflow gap — Korean trend analytics, YouTube →
          Obsidian, Gmail triage, and more. Built interactively with
          Claude Code, shipped on free tiers, written for the long-haul
          (TypeScript strict, hand-rolled charts, observable cron).
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-mono text-zinc-500 uppercase">
          Selected projects
        </h2>
        <ul className="space-y-4">
          {PROJECTS.map((p) => (
            <li
              key={p.title}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold leading-snug">{p.title}</h3>
                {p.status && (
                  <span
                    className={`text-[10px] font-mono ${STATUS_COLOR[p.status]}`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {p.blurb}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tech.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {p.links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {p.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className="underline text-zinc-700 dark:text-zinc-300 hover:opacity-80"
                    >
                      {l.label} →
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-mono text-zinc-500 uppercase">
          Stack I reach for
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {[
            "Python",
            "TypeScript",
            "Next.js",
            "Tailwind",
            "GitHub Actions",
            "Vercel",
            "Naver/Google APIs",
            "Telegram bots",
            "Free-tier LLMs (Gemini, Groq, Cerebras)",
          ].map((t) => (
            <span
              key={t}
              className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      <footer className="pt-8 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
        <p>
          GitHub —{" "}
          <a
            href="https://github.com/Sweet-Butters"
            className="underline hover:opacity-80"
          >
            @Sweet-Butters
          </a>
        </p>
        <p>
          Source —{" "}
          <a
            href="https://github.com/Sweet-Butters/websites_public"
            className="underline hover:opacity-80"
          >
            Sweet-Butters/websites_public
          </a>{" "}
          (sanitized public mirror)
        </p>
      </footer>
    </main>
  );
}
