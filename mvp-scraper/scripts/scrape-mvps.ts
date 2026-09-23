import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { crawl, createApi, freshCheckpoint, makeExport, validateCheckpoint } from "./lib/crawl.js";
import { HttpClient } from "./lib/http.js";
import { discoverApiOrigin, SITE_ORIGIN, SOURCE_URL } from "./lib/source.js";

const robotsParser = createRequire(import.meta.url)("robots-parser") as typeof import("robots-parser").default;

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "data/mvps.json" },
    "page-size": { type: "string", default: "0" },
    "max-pages": { type: "string" },
    "delay-ms": { type: "string", default: "1000" },
    query: { type: "string", default: "" },
    country: { type: "string", default: "" },
    enrich: { type: "boolean", default: false },
    concurrency: { type: "string", default: "1" },
    resume: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

function integer(value: string, label: string, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  return number;
}

async function atomicJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  await rename(temporary, path);
}

async function main() {
  if (values.help) {
    console.log(`Usage: npm run scrape -- [options]

  --out PATH       Export file (default: data/mvps.json)
  --page-size N    Profiles per page, 1–100; 0 uses the site's all-results map mode
                   (default: 0)
  --max-pages N    Limit total pages, including pages in a resumed checkpoint
  --enrich         Fetch public award categories and technology areas
  --concurrency N  Detail workers, 1–4 (default: 1); share the request rate limit
  --resume         Continue OUT.checkpoint.json with the same page size/filters
  --country NAME   Source country/region name, e.g. Philippines
  --query TEXT     Source search query
  --delay-ms N     Global request interval, at least 250ms (default: 1000)

Start without --resume for a fresh snapshot. Use a separate --out for samples.
Enrichment sends one extra request per profile. Check coverage before publishing.`);
    return;
  }
  const config = {
    pageSize: integer(values["page-size"]!, "--page-size", 0, 100),
    query: values.query!.trim(), country: values.country!.trim(),
  };
  const maxPages = values["max-pages"] === undefined ? 1000 : integer(values["max-pages"], "--max-pages", 1, 1000);
  const interval = integer(values["delay-ms"]!, "--delay-ms", 250, 60_000);
  const concurrency = integer(values.concurrency!, "--concurrency", 1, 4);
  if (!values.out?.trim()) throw new Error("--out must name a JSON file.");
  const output = resolve(values.out);
  const checkpointPath = `${output}.checkpoint.json`;
  const state = values.resume
    ? validateCheckpoint(JSON.parse(await readFile(checkpointPath, "utf8")), config)
    : freshCheckpoint(config);
  const client = new HttpClient(interval);
  const robots = robotsParser(`${SITE_ORIGIN}/robots.txt`, await client.text(`${SITE_ORIGIN}/robots.txt`));
  const assertAllowed = (url: string) => {
    if (robots.isAllowed(url, "MvpGlobalDirectoryScraper") !== true) {
      throw new Error(`robots.txt does not allow ${url}; stopping.`);
    }
  };
  assertAllowed(SOURCE_URL);
  assertAllowed(`${SITE_ORIGIN}/runtime-configuration.js`);
  const crawlDelay = robots.getCrawlDelay("MvpGlobalDirectoryScraper");
  if (crawlDelay && interval < crawlDelay * 1000) throw new Error(`Use --delay-ms ${crawlDelay * 1000} or greater to respect the source's crawl delay.`);
  const origin = discoverApiOrigin(await client.text(`${SITE_ORIGIN}/runtime-configuration.js`));
  console.error(`Using public source ${origin}; checkpoint: ${checkpointPath}`);
  await crawl(state, createApi(origin, client), {
    maxPages, enrich: values.enrich!, concurrency, assertProfileAllowed: assertAllowed,
    save: checkpoint => atomicJson(checkpointPath, checkpoint), log: console.error,
  });
  const result = makeExport(state, values.enrich!);
  await atomicJson(output, result);
  console.log(`Saved ${result.profiles.length} profiles to ${output}`);
  console.log(`Listing complete: ${result.coverage.listingComplete}; enriched: ${result.coverage.enrichedProfiles}/${result.profiles.length}`);
  if (!result.coverage.listingComplete) console.log("This is a partial export. Resume without --max-pages to continue.");
}

main().catch(error => {
  console.error(`Scrape failed: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.cause) console.error("Cause:", error.cause);
  console.error("The last export was not replaced. Saved pages/details remain in OUT.checkpoint.json; use --resume with the same filters and page size.");
  process.exitCode = 1;
});
