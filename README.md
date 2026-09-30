<div align="center">

<img src="public/mvp-logo.png" alt="MVP Global logo" width="72" />

# MVP Global — the community atlas

An interactive globe and accessible directory of Microsoft Most Valuable Professionals around the world.

[![Data refresh](https://img.shields.io/github/actions/workflow/status/EstopaceMA/mvp-global/refresh-mvp-data.yml?branch=main&label=data%20refresh)](../../actions/workflows/refresh-mvp-data.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A520.9-339933?logo=node.js&logoColor=white)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Overview](#overview) • [Features](#features) • [Getting started](#getting-started) • [Explore](#explore) • [Refreshing the data](#refreshing-the-data) • [Testing](#testing)

</div>

## Overview

MVP Global turns the public [Microsoft MVP directory](https://mvp.microsoft.com/en-US/search?target=Profile&program=MVP) into an explorable atlas: a dotted 3D globe built with [Magic UI's Globe](https://magicui.design/docs/components/globe) and [COBE](https://cobe.vercel.app/), backed by a fully accessible directory that needs no WebGL. It's a Next.js App Router site written in TypeScript, styled with Tailwind CSS and shadcn/ui, and ships as a static snapshot — no database, API keys, or Microsoft credentials required to run it.

> [!NOTE]
> MVP Global is an independent community project, not an official Microsoft product. "Microsoft" and "Microsoft MVP" are trademarks of Microsoft. Profile content and photos belong to their respective owners and are linked back to the [official directory](https://mvp.microsoft.com/en-US/search?target=Profile&program=MVP).

## Features

- **Interactive globe** — logarithmic marker sizing and coloring, country highlights, drag-to-rotate, and reduced-motion support.
- **Accessible directory** — every profile is reachable without WebGL, with keyboard navigation and 24 results per page.
- **Shareable country pages** — deep links like `/countries/hong-kong-sar`, including small territories without a globe polygon.
- **Profile link previews** — ID-based profile links include Open Graph and Twitter cards with a generated portrait, name, country, and awards preview.
- **Profile sharing** — share a profile on Facebook, LinkedIn, or X, or copy its public link from the Share button. Shared links omit directory filters.
- **Composable search & filters** — country, award category, technology, and region combine through URL state (`?country=philippines&country=singapore`), with browser history and persisted theme.
- **Zero-config to run** — the bundled snapshot means `npm ci && npm run dev` is all it takes; no environment variables or backend.
- **Self-refreshing data** — a monthly GitHub Actions workflow scrapes, validates, and opens a pull request with the updated snapshot.

## Getting started

### Prerequisites

- Node.js 20.9 or newer
- npm

### Run locally

```sh
cd mvp-global
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No environment variables, database, scraper files, or Microsoft credentials are needed — the app runs entirely from the [bundled snapshot](src/data/manifest.json).

### Public link previews

Set `SITE_URL` to the public HTTPS origin in both the build and runtime environments on a custom host. On Vercel, the production domain is detected from `VERCEL_PROJECT_PRODUCTION_URL` (falling back to `VERCEL_URL`); local development defaults to localhost. This produces absolute canonical, Open Graph, and Twitter URLs without using request headers or disabling profile-page caching.

Each profile has a 1200×630 PNG at `/mvps/[id]/preview`, generated on its first request and cached for one day. Sharing `/mvps/[id]` uses that image automatically; directory filters never change the canonical or preview URL. Missing IDs return 404. Portraits come only from the published Microsoft image URL, with a three-second timeout and initials on missing, invalid, or unavailable images. Social services cache previews separately and may need a rescrape after deployment.

Preview fonts are local Geist and Noto Sans WOFF subsets, including CJK and Korean names; no external font service is required. Production browser checks can enforce ISR behavior with `PREVIEW_TEST_PRODUCTION=1` alongside `PLAYWRIGHT_BASE_URL` and the same `SITE_URL` used by the server.

## Explore

| Route | Description |
| --- | --- |
| `/` | The interactive globe: search, filters, and country selection. Desktop shows a side sheet; mobile shows a bottom sheet. |
| `/mvps` | The accessible directory, with alphabetical cards. |
| `/mvps/[id]` | An individual MVP profile with an ID-based social preview. |
| `/countries/[country]` | Shareable, per-country pages. |
| `/about` | Snapshot coverage, data source, and attribution. |

Search matches names, countries, regions, award categories, and technologies, ignoring case and accents. Selections within a filter combine with OR, and different filters combine with AND — selecting a country narrows the directory while the globe keeps showing counts for everything else.

## Refreshing the data

Profile data comes from a prepared, version-controlled snapshot, not a live Microsoft directory API. On-page portraits load from Microsoft's image host using their original URLs, with lazy loading in results, eager loading on profile pages, and initials on failure. Local logos remain optimized, and the server-side social preview renderer fetches portraits independently. A separate, independent scraper package collects the snapshot:

```sh
# 1. Scrape a fresh export (see mvp-scraper/README.md)
cd mvp-scraper
npm run scrape -- --enrich

# 2. Import it into the site
cd ..
npm run data:import
```

The importer validates the export — rejecting duplicate IDs, inconsistent coverage totals, unknown country labels, unexpected image hosts, and invalid profile links — before writing `src/data/profiles.json`, `src/data/manifest.json`, and a content-hashed `public/data/directory.<hash>.json`. All three are committed together.

> [!IMPORTANT]
> New source country labels need an explicit entry in [`src/data/countries.json`](src/data/countries.json) before import will succeed.

### Automated monthly refresh

The [Refresh MVP data](.github/workflows/refresh-mvp-data.yml) workflow runs on the 2nd of each month (12:00 AM Asia/Manila), scrapes a complete export, and — only if profiles actually changed — opens a pull request from `automation/refresh-mvp-data` into `main` after tests, typecheck, lint, and the production build all pass. It can also be triggered manually from **Actions → Refresh MVP data → Run workflow**. Review and merge the PR like any other change; nothing is published automatically.

## Testing

```sh
npm test              # unit tests: projection, filtering, snapshot validation, URL state...
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e      # desktop + mobile, real WebGL, accessibility checks
```

The scraper package tests and typechecks independently: `npm --prefix mvp-scraper test` and `npm --prefix mvp-scraper run typecheck`.

## Resources

- [Microsoft MVP directory](https://mvp.microsoft.com/en-US/search?target=Profile&program=MVP) — the data source
- [mvp-scraper](mvp-scraper/README.md) — the independent scraper package
- [Magic UI Globe](https://magicui.design/docs/components/globe) and [COBE](https://cobe.vercel.app/) — the globe renderer
- [Map attribution](public/geo/ATTRIBUTION.md) — Natural Earth boundaries and World Atlas topology
