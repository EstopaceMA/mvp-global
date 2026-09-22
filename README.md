# MVP Global — the community atlas

Next.js App Router, TypeScript, shadcn/ui, Tailwind CSS, and [Magic UI’s Globe](https://magicui.design/docs/components/globe), powered by COBE. The included September 21, 2026 snapshot contains **3,798 unique public profiles across 105 countries/regions**. All profiles are available without WebGL through the directory.

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

Search matches names, countries, regions, award categories, and technologies, ignoring case and accents. Filters combine with AND. Selecting a country narrows the cards while preserving matching counts elsewhere on the globe. State uses `q`, `country`, `category`, `technology`, `region`, and `page` URL parameters and supports browser history. Theme preference persists locally.

The country picker includes all 105 source locations plus mapped places without recorded profiles. Camera positions represent countries, not individual MVP locations. WebGL failure and context loss expose a directory link with the current filters. Reduced motion disables camera transitions; rendering pauses when the document is hidden. Missing or failed photos show initials.

## Refresh the snapshot

Run the independent [scraper](../mvp-scraper/README.md) first, then explicitly import:

```sh
cd mvp-site
npm run data:import
# Or use a complete export elsewhere:
npm run data:import -- --source /absolute/path/to/mvps.json
npm test
npm run build
```

The importer requires a complete, enriched, unfiltered export. It rejects duplicate IDs, inconsistent coverage totals, unknown country labels, unexpected image hosts, and invalid official profile links. Source Microsoft GUIDs remain profile identifiers. New source country labels require an explicit entry in `src/data/countries.json` before import succeeds.

Keep these generated files in source control together:

- `src/data/profiles.json`: server-rendered initial card data.
- `src/data/manifest.json`: counts, filter options, coverage, timestamp, and content version.
- `public/data/directory.<hash>.json`: compact browser dataset, fetched once and reused across views (approximately 195 KiB gzip for this snapshot).

Deployments read only these prepared files. The build never runs the scraper or fetches directory data from Microsoft. Photos load lazily through Next.js image optimization, restricted to `images.mvp.microsoft.com`. Older content-hashed browser snapshots may be retained across updates for clients with previously cached pages.

Country metadata, region assignments, and camera coordinates are explicit in `src/data/countries.json`. Simplified Natural Earth boundaries are bundled in `public/geo/countries.topo.json`; [map attribution](public/geo/ATTRIBUTION.md) records their origin. Small territories without polygons remain available as markers and picker entries. The Magic UI globe uses COBE for the dotted globe, with a projected SVG overlay for all 105 countries (avoiding the renderer’s 64-marker limit). Natural Earth geometry powers land selection and hovered/selected country outlines. Drag to rotate, scroll or pinch to zoom, and use the zoom/reset controls. Camera movement uses interruptible Motion springs.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover globe projection, land hit detection, camera wrapping, snapshot validation, country mapping, reconciliation, filtering, aggregation, pagination, and URL state. Playwright tests exercise desktop and mobile browsers, real WebGL, country selection, search, filters, history, themes, keyboard access, accessibility checks, failed photos, retry, and WebGL fallback. Screenshots and failure traces are written to ignored `test-results/`.

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
