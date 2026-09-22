import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { countries, manifest } from "../src/lib/catalog";
import { EMPTY_FILTERS, filterParams, normalize, parseFilters, queryDirectory, updateFilters, viewHref } from "../src/lib/directory";
import { prepareSnapshot } from "../src/lib/snapshot";
import type { MvpProfile } from "../src/lib/types";

const profiles = JSON.parse(readFileSync(new URL("../src/data/profiles.json", import.meta.url), "utf8")) as MvpProfile[];
function fixture() {
  return { schemaVersion: 1, source: manifest.source, exportedAt: manifest.exportedAt,
    filters: { program: "MVP", query: "", country: "" },
    coverage: { listingComplete: true, enrichmentComplete: true, expectedProfiles: 2, exportedProfiles: 2, enrichedProfiles: 2, unavailableProfiles: 0 },
    profiles: profiles.slice(0, 2).map(profile => ({ ...profile, country: countries.find(country => country.id === profile.countryId)!.name, detailStatus: "ok" })),
  };
}

test("snapshot reconciles every unique profile and every covered country", () => {
  assert.equal(profiles.length, manifest.profileCount);
  assert.equal(new Set(profiles.map(profile => profile.id)).size, profiles.length);
  assert.equal(Object.keys(manifest.counts).length, manifest.countryCount);
  assert.equal(Object.values(manifest.counts).reduce((sum, count) => sum + count, 0), profiles.length);
  assert.ok(profiles.every(profile => countries.some(country => country.id === profile.countryId)));
  assert.equal(new Set(countries.map(country => country.id)).size, countries.length);
  assert.equal(new Set(countries.map(country => country.slug)).size, countries.length);
});

test("all covered countries have finite coordinates, including marker-only territories", () => {
  const covered = countries.filter(country => manifest.counts[country.id]);
  assert.ok(covered.every(country => Number.isFinite(country.lat) && Number.isFinite(country.lng)));
  for (const name of ["Singapore", "Hong Kong SAR", "Malta", "Bahrain", "Mauritius"]) {
    const country = covered.find(country => country.name === name)!;
    assert.ok(country);
    assert.equal(country.geometryId, null);
  }
  const topology = JSON.parse(readFileSync(new URL("../public/geo/countries.topo.json", import.meta.url), "utf8"));
  assert.ok(topology.objects.countries.geometries.every((entry: { id: string }) => countries.some(country => country.id === entry.id)));
});

test("country selection scopes cards without erasing counts for the rest of the globe", () => {
  const result = queryDirectory(profiles, countries, { ...EMPTY_FILTERS, country: "philippines" });
  assert.equal(result.total, manifest.counts.PH);
  assert.equal(result.globalTotal, profiles.length);
  assert.equal(result.counts.US, manifest.counts.US);
  assert.ok(result.profiles.every(profile => profile.countryId === "PH"));
});

test("all profiles are discoverable exactly once across paginated country directories", () => {
  const discovered = new Set<string>();
  for (const country of countries.filter(country => manifest.counts[country.id])) {
    const initial = queryDirectory(profiles, countries, { ...EMPTY_FILTERS, country: country.slug });
    assert.equal(initial.total, manifest.counts[country.id]);
    for (let page = 1; page <= initial.pages; page++) {
      const result = queryDirectory(profiles, countries, { ...EMPTY_FILTERS, country: country.slug, page });
      for (const profile of result.profiles) {
        assert.equal(profile.countryId, country.id);
        assert.ok(!discovered.has(profile.id));
        discovered.add(profile.id);
      }
    }
  }
  assert.equal(discovered.size, profiles.length);
  const browserData = JSON.parse(readFileSync(new URL(`../public${manifest.dataUrl}`, import.meta.url), "utf8"));
  assert.deepEqual(browserData, profiles);
});

test("search ignores accents and apostrophes; category, technology, and region filters use AND", () => {
  assert.equal(normalize("CÔTE D’IVOIRE"), normalize("Cote dIvoire"));
  const ivory = queryDirectory(profiles, countries, { ...EMPTY_FILTERS, q: "Cote dIvoire" });
  assert.equal(ivory.total, manifest.counts.CI);
  const result = queryDirectory(profiles, countries, { ...EMPTY_FILTERS, category: "Microsoft Azure", region: "Europe" });
  assert.ok(result.total > 0);
  assert.ok(result.profiles.every(profile => profile.awardCategories.includes("Microsoft Azure") && countries.find(country => country.id === profile.countryId)?.region === "Europe"));
  const technology = result.profiles.find(profile => profile.technologies.length)!.technologies[0];
  const specialized = queryDirectory(profiles, countries, { ...EMPTY_FILTERS, category: "Microsoft Azure", region: "Europe", technology });
  assert.ok(specialized.total > 0 && specialized.total <= result.total);
  assert.ok(specialized.profiles.every(profile => profile.technologies.includes(technology) && profile.awardCategories.includes("Microsoft Azure") && countries.find(country => country.id === profile.countryId)?.region === "Europe"));
  assert.equal(queryDirectory(profiles, countries, { ...EMPTY_FILTERS, q: "does-not-exist-abc123" }).total, 0);
});

test("pagination is alphabetical, disjoint, bounded, and resets when filters change", () => {
  const first = queryDirectory(profiles, countries, EMPTY_FILTERS);
  const second = queryDirectory(profiles, countries, { ...EMPTY_FILTERS, page: 2 });
  assert.equal(first.profiles.length, 24);
  assert.ok(first.profiles.every(profile => !second.profiles.some(other => other.id === profile.id)));
  assert.ok(first.profiles[0].name.localeCompare(first.profiles[23].name, "en") <= 0);
  assert.equal(updateFilters({ ...EMPTY_FILTERS, page: 20 }, { q: "Azure" }).page, 1);
  assert.equal(queryDirectory(profiles, countries, { ...EMPTY_FILTERS, country: "philippines", page: 9999 }).page, 1);
});

test("URL state round-trips and invalid filter values fall back safely", () => {
  const filters = { ...EMPTY_FILTERS, q: "identity & access", country: "philippines", category: "Security", page: 2 };
  assert.deepEqual(parseFilters(filterParams(filters), countries, manifest), filters);
  assert.ok(viewHref("/mvps", filters).includes("q=identity+%26+access"));
  assert.deepEqual(parseFilters(new URLSearchParams("country=unknown&category=made-up&technology=none&region=Atlantis&page=-2"), countries, manifest), EMPTY_FILTERS);
});

test("snapshot import rejects incomplete, filtered, duplicate, unmapped, and inconsistent data", () => {
  assert.equal(prepareSnapshot(fixture(), countries).profiles.length, 2);
  const incomplete = fixture(); incomplete.coverage.listingComplete = false;
  assert.throws(() => prepareSnapshot(incomplete, countries), /Invalid snapshot/);
  const filtered = fixture(); filtered.filters.query = "Azure";
  assert.throws(() => prepareSnapshot(filtered, countries), /Invalid snapshot/);
  const duplicate = fixture(); duplicate.profiles[1] = duplicate.profiles[0];
  assert.throws(() => prepareSnapshot(duplicate, countries), /Duplicate/);
  const missing = fixture(); missing.profiles[0].country = "Atlantis";
  assert.throws(() => prepareSnapshot(missing, countries), /Unmapped/);
  const inconsistent = fixture(); inconsistent.coverage.expectedProfiles = 3;
  assert.throws(() => prepareSnapshot(inconsistent, countries), /coverage/);
});

test("import accepts legacy Microsoft GUIDs and strips fields outside card data", () => {
  const raw = fixture();
  raw.profiles[0].id = "ffa78124-233f-e411-93f2-9cb65495d3c4";
  raw.profiles[0].officialProfileUrl = `${new URL(manifest.source).origin}/en-US/mvp/profile/${raw.profiles[0].id}`;
  const input = { ...raw, profiles: raw.profiles.map(profile => ({ ...profile, email: "not-exported@example.invalid" })) };
  assert.ok(prepareSnapshot(input, countries).profiles.every(profile => !("email" in profile)));
});
