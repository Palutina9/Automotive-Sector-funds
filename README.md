# داشبورد بازدهی صندوق‌ها — راهنمای استقرار

A Persian (RTL) Next.js dashboard that compares fund returns, hosted on GitHub Pages with daily auto-updates via GitHub Actions.

## Architecture

```
GitHub Actions (daily 12:00 Tehran)
  ↓ runs scraper/scraper.py
  ↓ writes public/auto_data.json
  ↓ commits + pushes
GitHub Pages
  ↓ auto-deploys on push
  ↓ serves the static Next.js export
You visit https://<username>.github.io/<repo>/
```

`public/manual_data.json` is for geo-blocked funds (AutoAgah etc.) — you commit it manually whenever you have fresh data.

## Setup steps

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial dashboard"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. **Source**: GitHub Actions
3. (A workflow file at `.github/workflows/deploy.yml` will handle the build+deploy — create it as shown below.)

### 3. Create the deploy workflow

Add `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - name: Build static export
        env:
          # IMPORTANT: change this to your repo name.
          # If your repo is at github.com/ali/fund-dashboard, set this to /fund-dashboard
          NEXT_PUBLIC_BASE_PATH: /<repo-name>
        run: bun run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 4. Set the base path

In `next.config.ts`, the `basePath` is read from `NEXT_PUBLIC_BASE_PATH`. The GitHub Action above sets it to `/<repo-name>`. **Make sure to replace `<repo-name>` with your actual repo name.**

If your repo is at `github.com/ali/fund-dashboard`, set `NEXT_PUBLIC_BASE_PATH=/fund-dashboard`.

### 5. Wire up the scraper

1. Edit `scraper/scraper.py`:
   - Replace the `FUNDS` list with your real fund slugs + API URLs
   - Verify the response shape matches what the scraper expects (`rows[0..7]` = the 8 simple returns in canonical order)
2. Commit + push.
3. The first scrape will run at 12:00 Tehran the next day, OR you can trigger it manually: repo → **Actions** → **Daily Fund Scrape** → **Run workflow**.

### 6. Manual data

For funds you can't auto-scrape (geo-blocked like AutoAgah), edit `public/manual_data.json` locally and commit. The dashboard picks it up on the next deploy.

## Local development

```bash
bun install
bun run dev
# Open http://localhost:3000
```

The dashboard reads `/auto_data.json` and `/manual_data.json` from `public/`. Edit those files to test with different data.

## File structure

```
.
├── .github/workflows/
│   ├── scrape.yml              ← daily cron, updates auto_data.json
│   └── deploy.yml              ← builds + deploys on every push
├── scraper/
│   ├── scraper.py              ← your Python scraper (edit FUNDS list)
│   └── requirements.txt
├── public/
│   ├── auto_data.json          ← auto-updated by GitHub Actions
│   ├── manual_data.json        ← you commit this manually
│   └── .nojekyll               ← tells GitHub Pages to skip Jekyll processing
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← RTL + Persian font (Vazirmatn)
│   │   ├── page.tsx            ← the dashboard
│   │   └── globals.css
│   └── lib/
│       └── dashboard-data.ts   ← merges both JSON files into one structure
└── next.config.ts              ← static export config
```

## Customizing

### Add a new fund

1. Add it to `scraper/scraper.py` `FUNDS` list (if auto-scrapable) OR add entries to `public/manual_data.json` (if manual).
2. Add a Persian display name in `src/lib/dashboard-data.ts` → `FUND_NAMES_FA`.

### Change period labels

Edit `PERIOD_LABELS_FA` in `src/lib/dashboard-data.ts`.

### Change colors

Edit `returnColorClass` / `returnBgClass` in `src/app/page.tsx`.

## Troubleshooting

- **Page is blank on GitHub Pages but works locally** — you forgot to set `NEXT_PUBLIC_BASE_PATH`. Re-check the deploy workflow.
- **Data not updating** — check the Actions tab; the scrape workflow may have failed. Look at the workflow logs.
- **404 on JSON files** — make sure `.nojekyll` is in `public/`. Without it, GitHub Pages' Jekyll processing may skip files starting with `_`.
- **Persian text shows as boxes** — the Vazirmatn font failed to load. Check browser network tab.
