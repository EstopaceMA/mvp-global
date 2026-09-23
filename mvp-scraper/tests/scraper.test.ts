import assert from "node:assert/strict";
import test from "node:test";
import { crawl, freshCheckpoint, makeExport, validateCheckpoint, type Checkpoint, type PublicApi } from "../scripts/lib/crawl.js";
import { HttpClient, HttpError, retryDelay } from "../scripts/lib/http.js";
import { splitByCountry } from "../scripts/lib/countries.js";
import { discoverApiOrigin, enrichProfile, normalizeSummary, parseSearch, searchPayload } from "../scripts/lib/source.js";

const observed = "2026-09-21T00:00:00.000Z";
const config = { pageSize: 2, query: "", country: "" };
function row(number: number) {
  return {
    userProfileIdentifier: `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`,
    firstName: "Test", lastName: String(number), localizedFirstName: "テスト", localizedLastName: String(number),
    screenNameLocalized: false, tenants: ["MVP"], addressCountryOrRegionName: "Philippines",
    profilePictureUrl: "https://images.mvp.microsoft.com/example", headline: "Example headline",
    // Extra source fields must not leak into the export.
    primaryEmail: "excluded@example.invalid", addressLatitude: 14.5,
  };
}
function detail(number: number) {
  return { userProfile: { ...row(number), isPrivate: false, awardCategory: ["Azure"], technologyFocusArea: ["AI", "AI"], yearsInProgram: 3 } };
}
function page(numbers: number[], total = 3) {
  return { communityLeaderProfiles: numbers.map(row), filteredCount: total };
}
const baseOptions = {
  maxPages: 1000, enrich: false, save: async (_state: Checkpoint) => {},
  assertProfileAllowed: (_url: string) => {}, log: (_message: string) => {},
};

test("country exports preserve every unique profile, unknown countries, and colliding country labels", () => {
  const state = freshCheckpoint(config);
  state.profiles = ["Côte", "Cote", null, "Philippines", "Philippines", "Index"].map((country, index) =>
    normalizeSummary({ ...row(index + 1), addressCountryOrRegionName: country }, observed));
  state.expectedTotal = state.profiles.length;
  state.listingComplete = true;
  const directory = makeExport(state, false);
  const result = splitByCountry(directory);
  assert.equal(result.index.countryCount, 4);
  assert.equal(result.index.profilesWithoutCountry, 1);
  assert.equal(result.index.countries.reduce((sum, entry) => sum + entry.count, 0), 6);
  assert.equal(new Set(result.exports.map(entry => entry.filename)).size, 5);
  assert.ok(result.exports.every(entry => entry.filename !== "index.json"));
  assert.equal(result.exports.find(entry => entry.filename === "philippines.json")?.data.profiles.length, 2);
  assert.equal(result.exports.find(entry => entry.filename === "_unknown.json")?.data.country, null);
  assert.throws(() => splitByCountry({ ...directory, coverage: { ...directory.coverage, listingComplete: false } }), /complete/);
  assert.throws(() => splitByCountry({ ...directory, filters: { ...directory.filters, country: "Philippines" } }), /unfiltered/);
  const duplicated = structuredClone(directory);
  duplicated.profiles[1] = duplicated.profiles[0]!;
  assert.throws(() => splitByCountry(duplicated), /duplicate/);
});

test("normalization preserves unknown fields as null and exports only the selected public fields", () => {
  const profile = normalizeSummary({ ...row(1), screenNameLocalized: true }, observed);
  assert.equal(profile.name, "テスト 1");
  assert.equal(profile.awardCategories, null);
  assert.equal(profile.awardYears, null);
  assert.equal("primaryEmail" in profile, false);
  assert.equal("addressLatitude" in profile, false);
  const enriched = enrichProfile(profile, detail(1), observed);
  assert.deepEqual(enriched.technologies, ["AI"]);
  assert.deepEqual(enriched.awardCategories, ["Azure"]);
  assert.equal(enriched.awardYears, null);
  assert.equal(enriched.yearsInProgram, 3);
});

test("rejects schema changes, wrong programs, private details, and mismatched identities", () => {
  assert.throws(() => parseSearch({ results: [] }, observed), /Unexpected search response/);
  assert.throws(() => normalizeSummary({ ...row(1), tenants: ["RD"] }, observed), /non-MVP/);
  assert.throws(() => enrichProfile(normalizeSummary(row(1), observed), detail(2), observed), /identifier/);
  assert.throws(() => enrichProfile(normalizeSummary(row(1), observed), { userProfile: { ...detail(1).userProfile, isPrivate: true } }, observed), /public/);
});

test("discovers the public host without executing script code; filters always retain MVP", () => {
  const script = 'window.__MAVEN_RUNTIME_CONFIGURATION__ = Object.freeze({"values":{"REACT_APP_BACKEND_HOST_AFD":"https://mavenapi-prod.microsoft.com"}});';
  assert.equal(discoverApiOrigin(script), "https://mavenapi-prod.microsoft.com");
  assert.throws(() => discoverApiOrigin(script.replace("mavenapi-prod.microsoft.com", "example.com")), /host changed/);
  assert.throws(() => discoverApiOrigin("runArbitraryCode()"), /configuration/);
  const payload = searchPayload(2, 50, "Azure", "Philippines");
  assert.deepEqual(payload.program, ["MVP"]);
  assert.deepEqual(payload.countryRegionList, ["Philippines"]);
  assert.equal(payload.pageIndex, 2);
});

test("partial export resumes pagination and enriches all profiles, without re-fetching completed details", async () => {
  const calls: number[] = [];
  const detailCalls: string[] = [];
  const api: PublicApi = {
    search: async number => { calls.push(number); return number === 1 ? page([1, 2]) : page([3]); },
    profile: async id => { detailCalls.push(id); return detail(Number(id.slice(-12))); },
  };
  let saved: Checkpoint | undefined;
  const options = { ...baseOptions, save: async (state: Checkpoint) => { saved = structuredClone(state); } };
  const state = await crawl(freshCheckpoint(config), api, { ...options, maxPages: 1, enrich: true });
  assert.equal(makeExport(state, true).coverage.listingComplete, false);
  assert.equal(saved?.nextPage, 2);
  const restored = validateCheckpoint(JSON.parse(JSON.stringify(saved)), config);
  await crawl(restored, api, { ...options, enrich: true });
  const result = makeExport(restored, true);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(detailCalls.length, 3);
  assert.equal(result.coverage.listingComplete, true);
  assert.equal(result.coverage.enrichmentComplete, true);
  assert.deepEqual(result.countries, [{ country: "Philippines", count: 3 }]);
  assert.throws(() => validateCheckpoint(saved, { ...config, country: "Japan" }), /filters/);
});

test("detects repeated pages, changing totals, and premature empty pages before saving bad progress", async () => {
  for (const badPage of [page([1]), page([3], 4), page([])]) {
    let saves = 0;
    const state = freshCheckpoint(config);
    const api: PublicApi = { search: async number => number === 1 ? page([1, 2]) : badPage, profile: async () => detail(1) };
    await assert.rejects(crawl(state, api, { ...baseOptions, save: async () => { saves++; } }));
    assert.equal(saves, 1);
    assert.equal(state.nextPage, 2);
    assert.equal(state.profiles.length, 2);
    assert.equal(state.listingComplete, false);
  }
});

test("does not infer completion from a short page if the source reports more records", async () => {
  const api: PublicApi = { search: async number => page([number], 2), profile: async () => detail(1) };
  const state = await crawl(freshCheckpoint({ ...config, pageSize: 50 }), api, baseOptions);
  assert.equal(state.nextPage, 3);
  assert.equal(state.listingComplete, true);
});

test("the site's all-results map mode must return the full count in a single response", async () => {
  const allConfig = { ...config, pageSize: 0 };
  const api: PublicApi = { search: async () => page([1, 2, 3]), profile: async () => detail(1) };
  const state = await crawl(freshCheckpoint(allConfig), api, baseOptions);
  assert.equal(state.listingComplete, true);
  assert.equal(state.profiles.length, 3);
  api.search = async () => page([1, 2]);
  await assert.rejects(crawl(freshCheckpoint(allConfig), api, baseOptions), /all-results mode/);
});

test("404 details remain explicitly unavailable and are retried on resume; 403 stops", async () => {
  const state = freshCheckpoint(config);
  const api: PublicApi = { search: async () => page([1], 1), profile: async () => { throw new HttpError(404, "https://example.invalid"); } };
  await crawl(state, api, { ...baseOptions, enrich: true });
  assert.equal(makeExport(state, true).coverage.enrichmentComplete, false);
  assert.equal(state.profiles[0]?.detailStatus, "unavailable");
  api.profile = async () => { throw new HttpError(403, "https://example.invalid"); };
  await assert.rejects(crawl(state, api, { ...baseOptions, enrich: true }), /access denied/);
  api.profile = async () => detail(1);
  await crawl(state, api, { ...baseOptions, enrich: true });
  assert.equal(state.profiles[0]?.detailStatus, "ok");
});

test("request retries honor Retry-After and never retry access denials", async () => {
  const waits: number[] = [];
  let clock = 100_000;
  let attempts = 0;
  const fakeFetch: typeof fetch = async () => {
    attempts++;
    return attempts === 1 ? new Response("slow down", { status: 429, headers: { "Retry-After": "10" } }) : Response.json({ ok: true });
  };
  const client = new HttpClient(0, fakeFetch, async ms => { waits.push(ms); clock += ms; }, () => {}, () => clock);
  assert.deepEqual(await client.json("https://example.invalid"), { ok: true });
  assert.equal(attempts, 2);
  assert.ok(waits.includes(10_000));
  for (const status of [401, 403]) {
    let deniedAttempts = 0;
    const denied = new HttpClient(0, async () => { deniedAttempts++; return new Response("denied", { status }); }, async () => {}, () => {});
    await assert.rejects(denied.json("https://example.invalid"), /access denied/);
    assert.equal(deniedAttempts, 1);
  }
  assert.equal(retryDelay("Mon, 21 Sep 2026 00:00:10 GMT", 2000, Date.parse(observed)), 10_000);
});

test("retry limit, long server pause, and malformed JSON cannot silently succeed", async () => {
  let attempts = 0;
  let clock = 100_000;
  const failures = new HttpClient(0, async () => { attempts++; return new Response("error", { status: 503 }); }, async ms => { clock += ms; }, () => {}, () => clock);
  await assert.rejects(failures.json("https://example.invalid"), /HTTP 503/);
  assert.equal(attempts, 4);
  const paused = new HttpClient(0, async () => new Response("wait", { status: 429, headers: { "Retry-After": "3600" } }), async () => {}, () => {});
  await assert.rejects(paused.json("https://example.invalid"), /Resume later/);
  const html = new HttpClient(0, async () => new Response("<html>error</html>"), async () => {}, () => {});
  await assert.rejects(html.json("https://example.invalid"), /Expected JSON/);
});

test("concurrent requests share one request-start rate limiter", async () => {
  let clock = 100_000;
  const starts: number[] = [];
  const client = new HttpClient(250, async () => { starts.push(clock); return Response.json({ ok: true }); },
    async ms => { clock += ms; }, () => {}, () => clock);
  await Promise.all(Array.from({ length: 4 }, () => client.json("https://example.invalid")));
  assert.equal(starts.length, 4);
  for (let index = 1; index < starts.length; index++) assert.ok(starts[index]! - starts[index - 1]! >= 250);
});

test("concurrent enrichment serializes checkpoint writes and drains active workers on failure", async () => {
  const state = freshCheckpoint(config);
  let active = 0;
  let maxActive = 0;
  let writing = false;
  const api: PublicApi = {
    search: async () => page([1, 2, 3, 4, 5, 6], 6),
    profile: async id => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 3));
      active--;
      if (Number(id.slice(-12)) === 2) throw new HttpError(403, "https://example.invalid");
      return detail(Number(id.slice(-12)));
    },
  };
  await assert.rejects(crawl(state, api, {
    ...baseOptions, enrich: true, concurrency: 4,
    save: async () => {
      assert.equal(writing, false);
      writing = true;
      await new Promise(resolve => setTimeout(resolve, 2));
      writing = false;
    },
  }), /access denied/);
  assert.equal(maxActive, 4);
  assert.equal(active, 0);
  assert.equal(writing, false);
  assert.equal(state.profiles.filter(profile => profile.detailStatus === "ok").length, 3);
});
