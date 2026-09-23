import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { prepareSnapshot, summarizeProfileChanges } from "../src/lib/snapshot";
import type { Country, MvpProfile, SnapshotManifest } from "../src/lib/types";

const { values } = parseArgs({ options: {
  source: { type: "string", default: "mvp-scraper/data/mvps.json" },
  "skip-unchanged": { type: "boolean", default: false },
  report: { type: "string" },
} });
const countries = JSON.parse(await readFile(resolve("src/data/countries.json"), "utf8")) as Country[];
// Always validate the full export before deciding whether to skip an import.
const data = prepareSnapshot(JSON.parse(await readFile(resolve(values.source!), "utf8")), countries);
let previous: MvpProfile[] = [];
try {
  previous = JSON.parse(await readFile(resolve("src/data/profiles.json"), "utf8")) as MvpProfile[];
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const summary = { ...summarizeProfileChanges(previous, data.profiles), collectedAt: data.exportedAt };
const content = JSON.stringify(data.profiles);
const version = createHash("sha256").update(content).digest("hex").slice(0, 16);
const manifest: SnapshotManifest = {
  schemaVersion: 1, version, source: data.source, exportedAt: data.exportedAt,
  dataUrl: `/data/directory.${version}.json`, profileCount: data.profiles.length,
  countryCount: Object.keys(data.counts).length, counts: data.counts,
  categories: data.categories, technologies: data.technologies, regions: data.regions,
  coverage: { listingComplete: true, enrichmentComplete: true, awardHistoryAvailable: false },
};
async function atomicWrite(path: string, content: string) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(`${target}.tmp`, content + "\n");
  await rename(`${target}.tmp`, target);
}
if (values["skip-unchanged"] && !summary.changed) {
  console.log("Published MVP profiles are unchanged; snapshot files and collection date were preserved.");
} else {
  await atomicWrite(`public${manifest.dataUrl}`, content);
  await atomicWrite("src/data/profiles.json", content);
  await atomicWrite("src/data/manifest.json", JSON.stringify(manifest, null, 2));
  console.log(`Imported ${manifest.profileCount} profiles in ${manifest.countryCount} countries/regions. Snapshot ${version}.`);
}
if (values.report) await atomicWrite(values.report, JSON.stringify(summary, null, 2));
