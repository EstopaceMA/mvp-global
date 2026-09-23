# MVP Global Directory — data scraper

TypeScript scraper for the public [Microsoft MVP directory](https://mvp.microsoft.com/en-US/search?target=Profile&program=MVP). Requires Node.js 20 or newer. This independent package lives inside the [frontend project](../README.md).

Run all commands below from `mvp-site/mvp-scraper/`. Data paths are relative to this folder. Dependencies and TypeScript checks are separate from the frontend.

## Run

```sh
npm ci

# Small sample, including award categories and technology areas
npm run scrape -- --page-size 5 --max-pages 2 --enrich --out data/sample.json

# All search summaries (names, countries, photos, headlines, official links)
npm run scrape

# Add categories and technologies to the saved directory
npm run scrape -- --resume --enrich

# Or fetch the complete directory with details in one run
npm run scrape -- --enrich
```

By default, requests run sequentially with at least one second between request starts. Enrichment requires one additional request per profile, so thousands of profiles take at least an hour at the default rate. Use `--concurrency 4 --delay-ms 250` for up to four concurrent detail requests with a shared cap of four request starts per second. Server backoff applies to all workers, and checkpoint writes remain sequential. Increase the interval with `--delay-ms 2000` for a slower run. No browser, account, API key, or database is required.

Additional options:

```sh
npm run scrape -- --country Philippines --enrich --out data/philippines.json
npm run scrape -- --query Azure --max-pages 1 --out data/azure-sample.json
npm run scrape -- --help
```

Country and query filters use the source's own matching behavior. Country names should match the source, e.g. `Philippines`.

## Output

To export the complete directory into one file per country/region:

```sh
npm run scrape -- --page-size 0
npm run export:countries
```

`--page-size 0` uses the website's all-results map request. It avoids unstable ordering among profiles with the same first name at page boundaries. The scraper requires this response to contain exactly the reported total, with unique IDs. To enrich this snapshot afterward, use `npm run scrape -- --resume --page-size 0 --enrich`, then regenerate country exports.

This reads `data/mvps.json` and writes `data/countries/index.json` plus files such as `data/countries/philippines.json`. The index records each source country name, profile count, enrichment count, and filename. Profiles without a country go into `_unknown.json` when present. Incomplete or filtered snapshots are rejected to avoid presenting partial country counts as complete. Regenerate these files after enrichment or a refresh; consumers should follow the current index rather than globbing the directory. Existing files absent from the latest index may belong to an earlier snapshot.

`data/mvps.json` contains `profiles`, aggregated `countries`, and `coverage` metadata. Each profile has a stable source `id`, `name`, `country`, `photoUrl`, `headline`, `awardCategories`, `technologies`, `yearsInProgram`, `awardYears`, `officialProfileUrl`, and observation timestamps/status. Photos remain source URLs; image files are not downloaded. Country labels remain exactly as provided; ISO codes, regions, and globe coordinates require a separate mapping.

Use `profiles` as the input to a later Prisma importer, with the source UUID as a unique key. No database writes happen in this scraper.

- `coverage.listingComplete` means pagination collected the reported number of unique public results for the chosen filters. It does **not** establish coverage of every award holder globally.
- `coverage.enrichmentComplete` means every exported profile has successful detail data, when enrichment was requested.
- A limited sample has `listingComplete: false`; its country counts represent only that sample. Missing countries must not be displayed as having zero MVPs globally.
- `awardCategories` and `technologies` are `null` until enrichment succeeds; `[]` means the source explicitly returned an empty list.
- `awardYears` remains `null`. The inspected public response provides years in the program, not individual award years. Do not derive award history or current award status from tenure.
- Categories and technology names are source values, without inferred aliases or classifications.

The exporter deliberately selects directory fields. It does not store raw profile responses, email addresses, biographies, street addresses, personal coordinates, or unrelated account fields. Generated data and checkpoints are ignored by Git.

## Resume and refresh

Every completed page and detail request is saved to `<output>.checkpoint.json`. If a run fails, the existing export stays intact. Rerun with `--resume` and the same `--out`, `--page-size`, `--query`, and `--country`. You may add `--enrich` or increase/remove `--max-pages`; the page limit is the total number of pages, including saved pages.

```sh
# Continue the sample into a complete enriched snapshot
npm run scrape -- --resume --page-size 5 --enrich --out data/sample.json
```

Resume skips successful details and retries unavailable ones. Run **without** `--resume` to refresh the source from the beginning; a completed checkpoint otherwise reuses old data. Use separate output paths for samples and full snapshots, and do not run concurrent jobs targeting the same output. Export and checkpoint files are replaced atomically, individually.

A changed total, duplicate page, unexpected empty page, or changed response shape stops the run. For changed totals or duplicates, start fresh rather than resuming an unstable page order. The source offers no snapshot transaction, so even a complete scrape is an observation over a period of time, not a guaranteed point-in-time inventory.

## Source adapter

The public website's JavaScript was inspected to identify these requests:

- Read the API origin from `https://mvp.microsoft.com/runtime-configuration.js` without executing it.
- `POST /api/CommunityLeaders/search/` with `program: ["MVP"]`, one-based `pageIndex`, and `pageSize`. The response contains `communityLeaderProfiles` and `filteredCount`.
- Optional `GET /api/mvp/UserProfiles/public/{id}` for public award categories and technology areas.

These are the anonymous endpoints used by the website, not a documented supported integration API. The adapter may need updates when the site changes. The scraper checks the site's robots.txt for search/profile access, uses no authentication, retries temporary network/server errors with backoff, honors `Retry-After`, and stops on access denials. Missing public profiles (404/410) are marked unavailable. A newly private profile stops enrichment so stale public data can be reviewed in a fresh run.

## Verify

```sh
npm run typecheck
npm test
```

Tests use synthetic profiles and mocked requests to check pagination, resumability, source drift detection, field selection, and retry handling without querying Microsoft.
