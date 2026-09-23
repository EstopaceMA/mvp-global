import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { countries } from "../src/lib/catalog";
import { summarizeProfileChanges } from "../src/lib/snapshot";
import type { MvpProfile, SnapshotManifest } from "../src/lib/types";

const cli = resolve("scripts/import-data.ts");
const loader = import.meta.resolve("tsx");
const source = "https://mvp.microsoft.com/en-US/search?target=Profile&program=MVP";
function profile(number: number): MvpProfile {
  const id = `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`;
  return { id, name: `Expert ${number}`, countryId: "PH", photoUrl: null,
    awardCategories: ["Microsoft Azure", "Data Platform"], technologies: ["Power BI", ".NET"],
    officialProfileUrl: `https://mvp.microsoft.com/en-US/mvp/profile/${id}` };
}
function snapshot(profiles: MvpProfile[], exportedAt = "2026-10-02T01:30:00.000Z") {
  return { schemaVersion: 1, source, exportedAt, filters: { program: "MVP", query: "", country: "" },
    coverage: { listingComplete: true, enrichmentComplete: true, expectedProfiles: profiles.length, exportedProfiles: profiles.length, enrichedProfiles: profiles.length, unavailableProfiles: 0 },
    profiles: profiles.map(profile => ({ ...profile, country: countries.find(country => country.id === profile.countryId)!.name, detailStatus: "ok", observedAt: exportedAt })),
  };
}
function workspace() {
  const root = mkdtempSync(join(tmpdir(), "mvp-import-test-"));
  for (const directory of ["src/data", "public/data", "mvp-scraper/data"]) mkdirSync(join(root, directory), { recursive: true });
  writeFileSync(join(root, "src/data/countries.json"), JSON.stringify(countries));
  const input = (value: unknown) => writeFileSync(join(root, "mvp-scraper/data/mvps.json"), JSON.stringify(value));
  const run = (...args: string[]) => spawnSync(process.execPath, ["--import", loader, cli, ...args], { cwd: root, encoding: "utf8" });
  const read = (file: string) => readFileSync(join(root, file), "utf8");
  const generated = () => Object.fromEntries(["src/data/profiles.json", "src/data/manifest.json", ...readdirSync(join(root, "public/data")).map(name => `public/data/${name}`)].map(file => [file, read(file)]));
  input(snapshot([profile(1), profile(2)], "2026-09-02T01:30:00.000Z"));
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  return { root, input, run, read, generated, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("profile comparison counts additions, removals, and every changed published field", () => {
  const original = profile(1);
  const patches: Partial<MvpProfile>[] = [
    { name: "Changed" }, { countryId: "US" }, { photoUrl: "https://images.mvp.microsoft.com/changed.jpg" },
    { officialProfileUrl: "https://mvp.microsoft.com/changed" }, { awardCategories: ["Security"] }, { technologies: ["SQL"] },
  ];
  for (const patch of patches) assert.equal(summarizeProfileChanges([original], [{ ...original, ...patch }]).updated, 1);
  assert.deepEqual(summarizeProfileChanges([original, profile(2)], [{ ...original, name: "Changed" }, { ...profile(3), countryId: "US" }]), {
    changed: true, added: 1, removed: 1, updated: 1, previousTotal: 2, total: 2, previousCountryCount: 1, countryCount: 2,
  });
});

test("CLI skips identical data, timestamps, and reordered profiles/expertise without touching snapshots", t => {
  const work = workspace(); t.after(work.cleanup);
  const before = work.generated();
  for (const entries of [[profile(1), profile(2)], [profile(2), { ...profile(1), awardCategories: ["Data Platform", "Microsoft Azure", "Data Platform"], technologies: [".NET", "Power BI"] }]]) {
    work.input(snapshot(entries));
    const result = work.run("--skip-unchanged", "--report", join(work.root, "report.json"));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /unchanged/);
    assert.deepEqual(work.generated(), before);
    assert.deepEqual(JSON.parse(work.read("report.json")), {
      changed: false, added: 0, removed: 0, updated: 0, previousTotal: 2, total: 2, previousCountryCount: 1, countryCount: 1, collectedAt: "2026-10-02T01:30:00.000Z",
    });
  }
});

test("CLI imports changed data consistently, retains old assets, and skips a repeated import", t => {
  const work = workspace(); t.after(work.cleanup);
  const oldManifest = JSON.parse(work.read("src/data/manifest.json")) as SnapshotManifest;
  const oldAsset = work.read(`public${oldManifest.dataUrl}`);
  work.input(snapshot([{ ...profile(1), name: "Changed expert" }, { ...profile(3), countryId: "US" }, profile(4)]));
  const result = work.run("--skip-unchanged", "--report", "report.json");
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(work.read("src/data/manifest.json")) as SnapshotManifest;
  const profiles = work.read("src/data/profiles.json");
  assert.equal(manifest.version, createHash("sha256").update(profiles.trim()).digest("hex").slice(0, 16));
  assert.equal(work.read(`public${manifest.dataUrl}`), profiles);
  assert.equal(work.read(`public${oldManifest.dataUrl}`), oldAsset);
  assert.equal(manifest.exportedAt, "2026-10-02T01:30:00.000Z");
  assert.equal(manifest.profileCount, 3);
  assert.deepEqual(manifest.counts, { PH: 2, US: 1 });
  assert.deepEqual(JSON.parse(work.read("report.json")), {
    changed: true, added: 2, removed: 1, updated: 1, previousTotal: 2, total: 3, previousCountryCount: 1, countryCount: 2, collectedAt: manifest.exportedAt,
  });
  const imported = work.generated();
  assert.equal(work.run("--skip-unchanged", "--report", "report.json").status, 0);
  assert.equal(JSON.parse(work.read("report.json")).changed, false);
  assert.deepEqual(work.generated(), imported);
});

test("CLI rejects incomplete, duplicate, and unmapped exports before skipping or writing", t => {
  const work = workspace(); t.after(work.cleanup);
  const before = work.generated();
  const incomplete = snapshot([profile(1), profile(2)]); incomplete.coverage.enrichmentComplete = false;
  const unmapped = snapshot([profile(1), profile(2)]); unmapped.profiles[0].country = "Atlantis";
  const duplicate = snapshot([profile(1), profile(1)]);
  for (const input of [incomplete, unmapped, duplicate]) {
    work.input(input);
    const result = work.run("--skip-unchanged", "--report", "report.json");
    assert.notEqual(result.status, 0);
    assert.deepEqual(work.generated(), before);
    assert.throws(() => work.read("report.json"), /ENOENT/);
  }
});

test("manual import without skip-unchanged still updates the collection date", t => {
  const work = workspace(); t.after(work.cleanup);
  work.input(snapshot([profile(1), profile(2)]));
  assert.equal(work.run().status, 0);
  assert.equal(JSON.parse(work.read("src/data/manifest.json")).exportedAt, "2026-10-02T01:30:00.000Z");
});
