# Contributing to MVP Global

Thanks for your interest in improving MVP Global. This document covers how to set up the project, the conventions the codebase follows, and how to submit changes.

> [!NOTE]
> MVP Global is an independent community project, not an official Microsoft product. See the [README](README.md) for details.

## Getting started

### Prerequisites

- Node.js 20.9 or newer
- npm

### Setup

```sh
git clone https://github.com/EstopaceMA/mvp-site.git
cd mvp-site/mvp-site
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No environment variables, database, or Microsoft credentials are needed — the app runs entirely from the [bundled snapshot](src/data/manifest.json).

## Project structure

This repository contains two independent npm packages:

- **`mvp-site/`** — the Next.js App Router site (TypeScript, Tailwind CSS, shadcn/ui). This is almost certainly where you'll be working.
- **`mvp-scraper/`** — a separate package that scrapes the public Microsoft MVP directory and produces the data snapshot consumed by the site. See [`mvp-scraper/README.md`](mvp-scraper/README.md).

The site never talks to Microsoft at build or request time. If your change touches directory data, see [Working with data](#working-with-data) below.

## Making changes

1. Create a branch off `main` with a short, descriptive name (e.g. `fix/country-page-routing`).
2. Make your changes, keeping commits focused and scoped to one logical change.
3. Run the full check suite before opening a PR (see [Testing](#testing)).
4. Open a pull request against `main` describing the change and, for behavior changes, how you verified it.

## Testing

Run these from `mvp-site/` before submitting a change:

```sh
npm test              # unit tests: projection, filtering, snapshot validation, URL state...
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e      # desktop + mobile, real WebGL, accessibility checks
```

If you touched `mvp-scraper/`, also run its own checks:

```sh
npm --prefix mvp-scraper test
npm --prefix mvp-scraper run typecheck
```

Pull requests are gated by CI running these same checks — a PR won't be merged with a failing check.

## Code style

- TypeScript throughout; keep new code typed, avoid `any`.
- Follow the existing ESLint config (`npm run lint`) — don't disable rules inline without a good reason.
- Match the existing component conventions (shadcn/ui primitives under `src/components/ui`, feature components alongside their routes).
- Prefer small, composable functions over large ones; keep URL/filter state logic consistent with the existing patterns in `src/lib`.
- No unrelated formatting or refactoring churn in a functional PR — keep diffs focused and reviewable.

## Working with data

The site reads a prepared, version-controlled snapshot (`src/data/profiles.json`, `src/data/manifest.json`, `public/data/directory.<hash>.json`) — it does not fetch from Microsoft at runtime. Don't hand-edit these files.

To regenerate the snapshot from a fresh scrape:

```sh
cd mvp-scraper
npm run scrape -- --enrich

cd ../mvp-site
npm run data:import
```

The importer validates the export (duplicate IDs, inconsistent coverage totals, unknown country labels, unexpected image hosts, invalid profile links) before writing the three data files, which must be committed together.

> [!IMPORTANT]
> New source country labels need an explicit entry in [`src/data/countries.json`](src/data/countries.json) before import will succeed.

Routine data refreshes are automated monthly via [`.github/workflows/refresh-mvp-data.yml`](.github/workflows/refresh-mvp-data.yml) and land as a PR from `automation/refresh-mvp-data` — you generally shouldn't need to run the scraper manually unless you're fixing an import/validation bug.

## Reporting bugs and requesting features

Please open a [GitHub issue](https://github.com/EstopaceMA/mvp-site/issues) with:

- A clear description of the problem or request
- Steps to reproduce (for bugs), including browser/OS if relevant
- Screenshots for visual issues where helpful

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
