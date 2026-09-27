# websites — Claude context (SSOT)

**Public sanitized snapshot** of a personal websites monorepo. Bring your own data + secrets. Each site under `sites/<name>/`
is an independent Next.js app sharing the npm workspace + tsconfig.

## Stack

- **Next.js 15+ App Router** — server components by default
- **TypeScript strict** + `noUncheckedIndexedAccess`
- **Tailwind CSS 4** — utility-first styling
- **npm workspaces** — no extra tooling (turborepo, pnpm) unless we hit a real limit

## Conventions

- Site reads cross-repo data via the GitHub Contents API, server-side, using
  a fine-grained PAT in env (`GH_TOKEN`). Never commit tokens.
- Server components fetch; client components only when interactivity needed.
- One shared style of error / loading: `<ErrorState>` + Suspense fallbacks.
- Lint + type-check on push (CI); never commit failing types.

## Sites

| Path | Purpose | Data source |
|------|---------|-------------|
| `sites/meme-dashboard/` | Trend dashboard | `Sweet-Butters/meme_project` state/ snapshots |

## Adding a new site

```bash
cd sites
npx create-next-app@latest <name> --ts --tailwind --app --eslint --no-src-dir
```

Then in `sites/<name>/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", ... }
```

## Deploy

Vercel. Each site is a separate Vercel project:
- **Root Directory**: `sites/<name>`
- **Build Command**: `npm run build` (Vercel auto-handles workspace install)
- **Output Directory**: `.next` (default)
- Push to `main` → auto-deploy preview + production

## Cross-repo data (meme_project example)

Fine-grained PAT scoped to `Sweet-Butters/meme_project` with `Contents: Read`.
Used by `sites/meme-dashboard/lib/meme.ts` to fetch latest state JSON files
server-side. Set as `GH_TOKEN` env var locally and in Vercel.
