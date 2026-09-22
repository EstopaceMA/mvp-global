import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { prepareSnapshot } from "../src/lib/snapshot";
import type { Country, SnapshotManifest } from "../src/lib/types";

const { values } = parseArgs({ options: { source: { type: "string", default: "../mvp-scraper/data/mvps.json" } } });
const countries = JSON.parse(await readFile(resolve("src/data/countries.json"), "utf8")) as Country[];
const data = prepareSnapshot(JSON.parse(await readFile(resolve(values.source!), "utf8")), countries);
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
await atomicWrite(`public${manifest.dataUrl}`, content);
await atomicWrite("src/data/profiles.json", content);
await atomicWrite("src/data/manifest.json", JSON.stringify(manifest, null, 2));
console.log(`Imported ${manifest.profileCount} profiles in ${manifest.countryCount} countries/regions. Snapshot ${version}.`);
