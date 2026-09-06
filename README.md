# websites

Sweet-Butters personal websites monorepo.

## Structure

```
sites/
├── meme-dashboard/   # Reads from Sweet-Butters/meme_project state
└── <next-site>/      # future
```

Each site is an independent Next.js app (TS + Tailwind, App Router) sharing
this repo's root npm workspaces, tsconfig, and `.gitignore`.

## Run a site

```bash
npm install                                  # one-time, installs everything
npm run dev -w sites/meme-dashboard          # → http://localhost:3000
```

## Add a new site

```bash
cd sites
npx create-next-app@latest <name> --ts --tailwind --app --eslint --no-src-dir
# Trim its tsconfig to extend ../../tsconfig.base.json. Done.
```

## Deploy

Each site deploys independently to Vercel — repo root is the project root,
build command `npm run build -w sites/<name>`, output dir
`sites/<name>/.next`. Push to main triggers redeploy.
