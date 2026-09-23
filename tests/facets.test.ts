import test from "node:test";
import assert from "node:assert/strict";
import { countries } from "../src/lib/catalog";
import { EMPTY_FILTERS, queryDirectory } from "../src/lib/directory";
import type { FacetKey, MvpProfile } from "../src/lib/types";

function profile(id: string, countryId: string, awardCategories: string[], technologies: string[], name = `Expert ${id}`): MvpProfile {
  return { id, name, countryId, awardCategories, technologies, photoUrl: null, officialProfileUrl: `https://example.com/${id}` };
}

const fixtures = [
  profile("1", "PH", ["Cloud", "Data", "Data"], ["TypeScript", "SQL", "SQL"]),
  profile("2", "PH", ["Data"], ["TypeScript"]),
  profile("3", "PH", ["Cloud"], ["SQL"]),
  profile("4", "US", ["Cloud"], ["TypeScript"]),
  profile("5", "FR", ["Cloud"], ["SQL"]),
  profile("6", "PH", ["Cloud"], ["TypeScript"], "Someone else"),
];

test("facets ignore only their own criterion and count each profile once", () => {
  const filters = { ...EMPTY_FILTERS, q: "Expert", country: ["philippines"], category: ["Cloud"], technology: ["TypeScript"] };
  const result = queryDirectory(fixtures, countries, filters);
  assert.equal(result.total, 1);
  assert.deepEqual(result.facets, {
    country: { counts: { PH: 1, US: 1 }, total: 2 },
    category: { counts: { Cloud: 1, Data: 2 }, total: 2 },
    technology: { counts: { TypeScript: 1, SQL: 2 }, total: 2 },
    region: { counts: { Asia: 1 }, total: 1 },
  });
  assert.deepEqual(result.counts, result.facets.country.counts);
  assert.equal(result.globalTotal, result.facets.country.total);
  for (const key of ["country", "category", "technology", "region"] as FacetKey[]) {
    assert.equal(result.facets[key].total, queryDirectory(fixtures, countries, { ...filters, [key]: [] }).total);
  }
  const regional = queryDirectory(fixtures, countries, { ...filters, region: ["Asia"] });
  assert.deepEqual(regional.counts, { PH: 1 });
  assert.deepEqual(regional.facets.region, result.facets.region);
});

test("facet and recovery counts are independent of pagination", () => {
  const many = Array.from({ length: 60 }, (_, index) => profile(String(index), "PH", ["Cloud", "Data"], ["TypeScript", "SQL"]));
  const first = queryDirectory(many, countries, EMPTY_FILTERS);
  const second = queryDirectory(many, countries, { ...EMPTY_FILTERS, page: 2 });
  assert.deepEqual(first.facets, second.facets);
  assert.deepEqual(first.facets.technology, { counts: { TypeScript: 60, SQL: 60 }, total: 60 });
  assert.notDeepEqual(first.profiles, second.profiles);
  const empty = { ...EMPTY_FILTERS, technology: ["Missing"] };
  assert.deepEqual(queryDirectory(many, countries, empty).relaxations, queryDirectory(many, countries, { ...empty, page: 99 }).relaxations);
});

test("recovery preserves technology, prefers fewer matches, and breaks ties deterministically", () => {
  const filters = { ...EMPTY_FILTERS, q: "Wanted", country: ["philippines"], category: ["Cloud"], technology: ["TypeScript"] };
  const data = [
    profile("country", "US", ["Cloud"], ["TypeScript"], "Wanted"),
    profile("category", "PH", ["Data"], ["TypeScript"], "Wanted"),
    profile("query1", "PH", ["Cloud"], ["TypeScript"], "Other"),
    profile("query2", "PH", ["Cloud"], ["TypeScript"], "Other"),
    profile("technology", "PH", ["Cloud"], ["SQL"], "Wanted"),
    profile("two-failures", "US", ["Data"], ["TypeScript"], "Wanted"),
  ];
  assert.deepEqual(queryDirectory(data, countries, filters).relaxations, [
    { key: "country", count: 1 }, { key: "category", count: 1 }, { key: "q", count: 2 },
  ]);
  assert.deepEqual(queryDirectory(data.filter(entry => entry.id === "technology" || entry.id.startsWith("query")), countries, filters).relaxations, [
    { key: "q", count: 2 }, { key: "technology", count: 1 },
  ]);
  const tiedRegion = queryDirectory([
    profile("region", "FR", ["Cloud"], ["TypeScript"], "Wanted"),
    profile("category", "PH", ["Data"], ["TypeScript"], "Wanted"),
  ], countries, { ...filters, country: [], region: ["Asia"] });
  assert.deepEqual(tiedRegion.relaxations, [{ key: "region", count: 1 }, { key: "category", count: 1 }]);
});

test("recovery includes only positive single removals and never changes a nonempty result", () => {
  assert.deepEqual(queryDirectory(fixtures, countries, EMPTY_FILTERS).relaxations, []);
  assert.deepEqual(queryDirectory(fixtures, countries, { ...EMPTY_FILTERS, category: ["Missing"], technology: ["Missing"] }).relaxations, []);
  const filters = { ...EMPTY_FILTERS, country: ["philippines"], q: "nothing matches" };
  assert.deepEqual(queryDirectory(fixtures, countries, filters).relaxations, [{ key: "q", count: 4 }]);
});

test("Philippine Azure and Power BI search suggests category before technology", () => {
  const snapshot = [
    profile("azure", "PH", ["Microsoft Azure"], ["Azure Compute Infrastructure"]),
    profile("power-bi-1", "PH", ["Data Platform"], ["Power BI"]),
    profile("power-bi-2", "PH", ["Data Platform"], ["Power BI"]),
    profile("other-country", "US", ["Data Platform"], ["Power BI"]),
  ];
  const result = queryDirectory(snapshot, countries, { ...EMPTY_FILTERS, country: ["philippines"], category: ["Microsoft Azure"], technology: ["Power BI"] });
  assert.equal(result.total, 0);
  assert.deepEqual(result.relaxations, [{ key: "category", count: 2 }, { key: "technology", count: 1 }]);
});


test("multiple values use OR within each field and AND across fields without double counting", () => {
  const filters = { ...EMPTY_FILTERS, country: ["philippines", "united-states"], category: ["Cloud", "Data"], technology: ["TypeScript", "SQL"], region: ["Asia", "Americas"] };
  // Use the catalog's exact region label for the US, alongside Asia.
  filters.region = ["Asia", countries.find(country => country.id === "US")!.region];
  const result = queryDirectory(fixtures, countries, filters);
  assert.equal(result.total, 5);
  assert.deepEqual(result.profiles.map(profile => profile.id).sort(), ["1", "2", "3", "4", "6"]);
  assert.equal(result.facets.technology.total, 5);
  assert.deepEqual(result.facets.technology.counts, { TypeScript: 4, SQL: 2 });
  assert.deepEqual(result.counts, queryDirectory(fixtures, countries, { ...filters, country: [] }).counts);
  for (const key of ["country", "category", "technology", "region"] as FacetKey[]) {
    assert.equal(result.facets[key].total, queryDirectory(fixtures, countries, { ...filters, [key]: [] }).total);
  }
  const empty = queryDirectory(fixtures, countries, { ...filters, technology: ["Missing", "Also missing"] });
  assert.deepEqual(empty.relaxations, [{ key: "technology", count: 5 }]);
});
