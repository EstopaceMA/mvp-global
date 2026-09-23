import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { splitByCountry } from "./lib/countries.js";

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: "string", default: "data/mvps.json" },
    out: { type: "string", default: "data/countries" },
  } });
  const directory = JSON.parse(await readFile(resolve(values.input!), "utf8"));
  const result = splitByCountry(directory);
  const output = resolve(values.out!);
  await mkdir(output, { recursive: true });
  async function save(filename: string, data: unknown) {
    const destination = resolve(output, filename);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
    await rename(temporary, destination);
  }
  for (const entry of result.exports) await save(entry.filename, entry.data);
  // Consumers should read only files listed in the current manifest.
  await save("index.json", result.index);
  console.log(`Exported ${directory.profiles.length} profiles across ${result.index.countryCount} countries/regions to ${output}`);
  console.log(`Unknown country: ${result.index.profilesWithoutCountry}; enriched: ${directory.coverage.enrichedProfiles}/${directory.profiles.length}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
