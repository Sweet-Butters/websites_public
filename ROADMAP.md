# websites — roadmap

Living document. Tracks the monorepo across all sites under `sites/`.

## Shipped (2026-05)

### Infrastructure
- npm workspaces monorepo, shared `tsconfig.base.json`.
- Vercel project per site, auto-deploy on push to main (after CLI
  link).
- Vercel Analytics mounted in `sites/meme-dashboard`.
- Sanitized public mirror via `.github/workflows/sync_public.yml`
  (weekly + dispatch).

### `sites/meme-dashboard/`
The big one. Reads `meme_project` state via GitHub Contents API + PAT.

- Home: top-10 keywords + AI featured sparkline + **LLM-powered action
  recommendations** (Gemini 2.5 Flash, `unstable_cache` 1h to stay in
  free tier; heuristic fallback).
- `/k/[keyword]` drilldown:
  - Multi-source intensity sparklines (per-source raw values).
  - **Absolute values table** (real numbers in Korean compact format —
    1.2억 / 350만 — alongside the 0-100 relative index sources).
  - Lead/Lag matrix with auto zero-trim to dodge sparse-data artefacts.
  - Demographic breakdown (gender / age / device) + **week-over-week
    shift annotations** ("↑ 30s +12pt").
  - **Hover tooltip on every sparkline** showing date + value at cursor.
- `/compare?kw=A,B,C&source=...`: 6-color overlay chart + per-keyword
  stats table + **crosshair tooltip with date + each series' value**.
- `/brief`: rendered LLM marketing brief + **"🔁 N일 연속 등장 키워드"
  chips** + 20-day archive nav.
- Date range picker (`?from=&to=` URL params + 7/30/60/90d presets).
- Mobile-friendly: tables use `overflow-x-auto + min-w-*` so they
  scroll horizontally instead of clipping.

### `sites/portfolio/`
Bare landing with 5 project cards (meme_project, mail-notifier,
auto_project, Notes_project, the dashboard itself). Static page.

## Next up

### `sites/meme-dashboard/`
- [ ] **Screenshot / OG images** for shared links (1200×630 with
  current top keywords overlaid — easy via `next-og` API route).
- [ ] **Per-source intensity also gets the absolute-value tooltip** —
  currently only synth-level shows real numbers.
- [ ] **`/compare` deep-link from drill-down** — already done, but
  pre-select the 2 most-related keywords (high RRF co-occurrence) as
  defaults.
- [ ] **CSV / JSON export buttons** beside each chart for downstream
  analysis.
- [ ] **Korean URL handling check** — `/k/딥러닝` currently works via
  encodeURIComponent but verify on Naver Whale / older mobile browsers.
- [ ] **Real mobile testing** on 375px Galaxy / iPhone breakpoints.
- [ ] **Action recommendations: 2-shot LLM** — first categorise, then
  generate narrative with full demographic context.

### `sites/portfolio/`
- [ ] Project screenshots (use the meme-dashboard's own page snapshots).
- [ ] Light/dark theme toggle (currently system-only).
- [ ] Custom domain — Vercel project setting; depends on user
  registering a `.com / .me / .dev`.

### New sites (`sites/<name>/`)
Open slot in the monorepo for whichever prototype is next.
Candidates discussed:
- **Personal blog** (markdown + maybe Contentful or just MDX).
- **Reading-list/notes browser** (Obsidian vault read via GitHub API,
  similar pattern to meme-dashboard's data path).
- **mail-notifier dashboard** (Gmail triage stats over time).

## Operational

- [ ] **Vercel custom domain** when a domain is purchased.
- [ ] **Vercel Analytics → Plausible / Umami self-host** if the free
  tier becomes a privacy concern (currently fine for personal site).

## Won't do (for now)

- Pulling in a chart library (Chart.js / Recharts / Visx) — SVG-by-hand
  works for our complexity and avoids 100KB+ bundles.
- Hosting our own LLM — Gemini free tier is sufficient and we have a
  deterministic stat-fallback for outages.
- Adding redux/zustand — server components + URL state cover all
  current interactivity.

## See also

- `CLAUDE.md` — codebase conventions.
- Companion repo: `Sweet-Butters/meme_project` (the data source).
