# MVP Global — the community atlas

Next.js App Router, TypeScript, shadcn/ui, Tailwind CSS, and [Magic UI’s Globe](https://magicui.design/docs/components/globe), powered by COBE. The bundled [snapshot manifest](src/data/manifest.json) records the current collection date, profile total, and country coverage. All profiles are available without WebGL through the directory.

The project includes the [apple-design skill](../.agents/skills/apple-design/SKILL.md), pinned in `../skills-lock.json`. Its interface guidance is applied through readable type, 44px touch controls, immediate press feedback, translucent panels, and reduced-motion, reduced-transparency, and increased-contrast preferences. The MVP logo and the atlas’s navy/blue identity are retained.

## Run locally

Use Node.js 20.9 or newer and npm:

```sh
cd mvp-site
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No environment variables, database, scraper files, or Microsoft credentials are needed.

## Pages and interactions

- `/`: interactive dotted globe, logarithmic marker sizes and colors, country highlights, search and filters. Select a polygon, marker, or country picker entry. Desktop results use a non-modal side sheet; mobile results use a modal bottom sheet. On mobile, finish typing and press Enter or View MVPs to open search results.
- `/mvps`: accessible directory with alphabetical cards and 24 results per page.
- `/countries/[country]`: shareable country pages, including small territories such as `/countries/hong-kong-sar`.
- `/about`: snapshot coverage, source, independence, and map attribution.

Search matches names, countries, regions, award categories, and technologies, ignoring case and accents. Selections within each filter combine with OR; different filters combine with AND. Selecting a country narrows the cards while preserving matching counts elsewhere on the globe. State uses `q`, `country`, `category`, `technology`, `region`, and `page` URL parameters and supports browser history. Multiple selections repeat the same parameter, such as `country=philippines&country=singapore`; existing single-selection links still work. Theme preference persists locally.

Country and Award category are the primary filters; technology expertise and region are under Filters. All four use the same searchable multi-select design, with accent-insensitive label search, checkboxes, and contextual counts. Searching a dropdown only narrows its options. Toggle several options without closing it, then choose Done or press Escape. Closing a nested picker returns focus to its trigger and keeps Filters open. On the mobile globe, finish selecting filters and use View MVPs to open results.

The Filters badge counts individual technology and region selections; Reset these filters clears only those fields. Option counts apply every criterion except that option’s entire filter. “All” clears the field and shows its unique-profile total, which can be smaller than the sum of overlapping option counts. Selections stay inside the dropdowns, keeping the globe clear of filter chips. Clear all appears below Reset these filters in the Filters panel whenever a criterion is active and resets every field. Use each dropdown’s Clear selections or toggle individual options to remove selections. Adding another country or removing the country from a country page navigates to `/mvps`, preserving other criteria. Empty results offer up to three positive whole-filter removals, prioritizing preservation of technology selections. Pending counts display as unavailable rather than showing stale values or zero.

The country picker includes source locations plus mapped places without recorded profiles. Camera positions represent countries, not individual MVP locations. WebGL failure and context loss expose a directory link with the current filters. Reduced motion disables camera transitions; rendering pauses when the document is hidden. Missing or failed photos show initials.

## Refresh the snapshot

Run the independent [scraper](mvp-scraper/README.md) in `mvp-site/mvp-scraper/` first, then explicitly import from `mvp-site/`:

```sh
cd mvp-site
npm run data:import
# Or use a complete export elsewhere:
npm run data:import -- --source /absolute/path/to/mvps.json
npm test
npm run build
```

The default import source is `mvp-scraper/data/mvps.json`. The scraper keeps its own dependencies and TypeScript configuration; frontend typechecking and linting exclude that package. Run its checks with `npm --prefix mvp-scraper run typecheck` and `npm --prefix mvp-scraper test`.

The importer requires a complete, enriched, unfiltered export. It rejects duplicate IDs, inconsistent coverage totals, unknown country labels, unexpected image hosts, and invalid official profile links. Source Microsoft GUIDs remain profile identifiers. New source country labels require an explicit entry in `src/data/countries.json` before import succeeds.

Keep these generated files in source control together:

- `src/data/profiles.json`: server-rendered initial card data.
- `src/data/manifest.json`: counts, filter options, coverage, timestamp, and content version.
- `public/data/directory.<hash>.json`: compact browser dataset, fetched once and reused across views.

Deployments read only these prepared files. The build never runs the scraper or fetches directory data from Microsoft. Photos load lazily through Next.js image optimization, restricted to `images.mvp.microsoft.com`. Older content-hashed browser snapshots may be retained across updates for clients with previously cached pages.

Country metadata, region assignments, and camera coordinates are explicit in `src/data/countries.json`. Simplified Natural Earth boundaries are bundled in `public/geo/countries.topo.json`; [map attribution](public/geo/ATTRIBUTION.md) records their origin. Small territories without polygons remain available as markers and picker entries. The Magic UI globe uses COBE for the dotted globe, with a projected SVG overlay for all covered countries (avoiding the renderer’s 64-marker limit). Natural Earth geometry powers land selection and hovered/selected country outlines. Drag to rotate, scroll or pinch to zoom, and use the zoom/reset controls. Camera movement uses interruptible Motion springs.

## Monthly refresh pull requests

[Refresh MVP data](.github/workflows/refresh-mvp-data.yml) runs on the **2nd day of each month at 08:17 Asia/Manila** (00:17 UTC; cron `17 0 2 * *`). GitHub may delay scheduled jobs. The workflow must be merged into `main` before the schedule is active. To run it manually, open **Actions → Refresh MVP data → Run workflow**, selecting `main`.

Each run installs both packages from their lockfiles on Node.js 24, checks the scraper, and collects a fresh complete export with enrichment at one request start per second. There is no checkpoint reuse between runs. The scraper step allows 150 minutes, within a 180-minute job timeout; overlapping runs are serialized.

The importer validates coverage before comparing published profiles by ID. Observation timestamps, profile order, and category/technology ordering do not count as changes. If profiles are unchanged, the workflow leaves all snapshot files and their collection date untouched and skips PR creation/update. The Actions run summary records the successful check date instead.

For changed profiles, site tests, typecheck, lint, and the production build must pass before the workflow creates or updates **`automation/refresh-mvp-data` → `main`**. The PR includes added, updated, and removed counts, before/after totals, the collection date, and a run link. Only `src/data/profiles.json`, `src/data/manifest.json`, and `public/data/directory.*.json` are committed. Published older browser datasets are retained; raw exports, checkpoints, dependencies, and reports are excluded. Review and merge the PR manually. A failed or unchanged run leaves any existing data PR untouched.

The workflow uses GitHub's automatically supplied `GITHUB_TOKEN`, with `contents: write` and `pull-requests: write`. The repository setting **Actions → General → Allow GitHub Actions to create and approve pull requests** must be enabled. No personal token or additional secret is required. All refresh checks run before PR creation, without depending on a second PR-triggered workflow.

To use the same import behavior locally after a scrape:

```sh
npm run data:import -- --skip-unchanged
# Optionally write a machine-readable change report outside the repository:
npm run data:import -- --skip-unchanged --report /tmp/mvp-refresh-report.json
```

Without `--skip-unchanged`, a manual import retains its existing behavior and updates the collection date even when profiles match. No snapshot format changes are introduced.

On failure, inspect the failed step and its logs in Actions, resolve the source/schema or country-mapping issue, and rerun manually. Partial exports are never published; the live site and existing PR remain unchanged. The monthly checks use synthetic data for fixed filter scenarios and verify the new snapshot's totals and assets independently of any historical MVP count.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover globe projection, land hit detection, camera wrapping, snapshot validation, country mapping, reconciliation, filtering, facet counts, recovery suggestions, aggregation, pagination, and URL state. Playwright tests exercise desktop and mobile browsers, real WebGL, country selection, searchable expertise, filter resets and recovery, delayed or failed data, history, themes, long labels, keyboard access, accessibility checks, failed photos, retry, and WebGL fallback. Screenshots and failure traces are written to ignored `test-results/`.

Production builds explicitly use Next.js's supported Webpack compiler because Turbopack's CSS worker could not bind its internal port in the development environment. Development uses the default Next.js compiler.

## Deploy

Create a Vercel Next.js project with **Root Directory: `mvp-site`**, install command `npm ci`, and build command `npm run build`. No sibling-folder access or environment variables are required. Enable Vercel Web Analytics in the project dashboard to collect production page views. Query strings and hashes are removed before Vercel page-view events; no custom search or profile events are emitted.

Microsoft Clarity initializes in the browser on all pages in production builds using project ID `ymc3v0693l`. It is disabled during `npm run dev` and enabled during local production previews. View its session recordings and heatmaps in the corresponding Clarity project dashboard.

For a local production preview:

```sh
npm run build
npm start
```

To run browser checks against an already-running production preview, set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e`.

This is an independent community directory. Snapshot completeness describes the public results returned by Microsoft at collection time, not every award holder or current award status. Award years, individual local profile pages, accounts, editing, and rankings are outside this release.
