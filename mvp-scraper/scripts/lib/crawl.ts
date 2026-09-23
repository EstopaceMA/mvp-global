import { HttpError } from "./http.js";
import { enrichProfile, parseSearch, searchPayload, SOURCE_URL, type MvpProfile } from "./source.js";

export interface CrawlConfig {
  pageSize: number;
  query: string;
  country: string;
}

export interface Checkpoint {
  schemaVersion: 1;
  config: CrawlConfig;
  startedAt: string;
  nextPage: number;
  expectedTotal: number | null;
  listingComplete: boolean;
  profiles: MvpProfile[];
}

export interface PublicApi {
  search(page: number, config: CrawlConfig): Promise<unknown>;
  profile(id: string): Promise<unknown>;
}

export function createApi(origin: string, client: { json(url: string, payload?: unknown): Promise<unknown> }): PublicApi {
  return {
    search: (page, config) => client.json(`${origin}/api/CommunityLeaders/search/`, searchPayload(page, config.pageSize, config.query, config.country)),
    profile: id => client.json(`${origin}/api/mvp/UserProfiles/public/${encodeURIComponent(id)}`),
  };
}

export function freshCheckpoint(config: CrawlConfig): Checkpoint {
  return { schemaVersion: 1, config, startedAt: new Date().toISOString(), nextPage: 1, expectedTotal: null, listingComplete: false, profiles: [] };
}

export function validateCheckpoint(value: unknown, config: CrawlConfig): Checkpoint {
  const state = value as Checkpoint;
  if (!state || state.schemaVersion !== 1 || !state.config ||
      state.config.pageSize !== config.pageSize || state.config.query !== config.query || state.config.country !== config.country ||
      !Number.isSafeInteger(state.nextPage) || state.nextPage < 1 || !Array.isArray(state.profiles) ||
      typeof state.listingComplete !== "boolean" || !Number.isFinite(Date.parse(state.startedAt)) ||
      !(state.expectedTotal === null || (Number.isSafeInteger(state.expectedTotal) && state.expectedTotal >= 0))) {
    throw new Error("Checkpoint is invalid or filters/page size changed. Start a fresh run without --resume or use a different --out.");
  }
  if (state.profiles.some(profile => !profile || typeof profile.id !== "string" || typeof profile.name !== "string" ||
      !["not-requested", "ok", "unavailable"].includes(profile.detailStatus)) ||
      new Set(state.profiles.map(profile => profile.id)).size !== state.profiles.length ||
      (state.listingComplete && state.expectedTotal !== state.profiles.length)) {
    throw new Error("Checkpoint profile data is inconsistent; start a fresh run.");
  }
  return state;
}

export async function crawl(
  state: Checkpoint,
  api: PublicApi,
  options: {
    maxPages: number;
    enrich: boolean;
    concurrency?: number;
    save(state: Checkpoint): Promise<void>;
    assertProfileAllowed(url: string): void;
    log(message: string): void;
  },
): Promise<Checkpoint> {
  const ids = new Set(state.profiles.map(profile => profile.id));
  while (!state.listingComplete && state.nextPage <= options.maxPages) {
    if (state.nextPage > 1000) throw new Error("Pagination exceeded 1,000 pages; inspect the source before continuing.");
    const page = parseSearch(await api.search(state.nextPage, state.config), new Date().toISOString());
    if (state.config.pageSize === 0 && (state.nextPage !== 1 || page.profiles.length !== page.total)) {
      throw new Error("The site's all-results mode did not return the complete directory in one response.");
    }
    if (state.expectedTotal !== null && state.expectedTotal !== page.total) {
      throw new Error("Source total changed during pagination. Start a fresh run without --resume to avoid missing profiles.");
    }
    const newIds = page.profiles.map(profile => profile.id);
    if (new Set(newIds).size !== newIds.length || newIds.some(id => ids.has(id))) {
      throw new Error("Duplicate profiles across search pages; source ordering may have changed. Start a fresh run.");
    }
    const count = state.profiles.length + page.profiles.length;
    if (count > page.total || (page.profiles.length === 0 && count < page.total)) {
      throw new Error("Pagination ended inconsistently with the source total; checkpoint preserved.");
    }
    state.expectedTotal = page.total;
    state.profiles.push(...page.profiles);
    newIds.forEach(id => ids.add(id));
    state.listingComplete = count === page.total;
    options.log(`Page ${state.nextPage}: ${count}/${page.total} public MVP profiles`);
    state.nextPage++;
    await options.save(state);
  }

  if (options.enrich) {
    const concurrency = options.concurrency ?? 1;
    if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error("Enrichment concurrency must be between 1 and 4.");
    let cursor = 0;
    let failure: unknown;
    let saves: Promise<void> = Promise.resolve();
    const saveProgress = () => {
      // Serialize writes so concurrent workers cannot collide on the temporary file.
      saves = saves.then(() => options.save(state));
      return saves;
    };
    const worker = async () => {
      while (!failure && cursor < state.profiles.length) {
        const index = cursor++;
        const profile = state.profiles[index]!;
        if (profile.detailStatus === "ok") continue;
        try {
          options.assertProfileAllowed(profile.officialProfileUrl);
          try {
            state.profiles[index] = enrichProfile(profile, await api.profile(profile.id), new Date().toISOString());
          } catch (error) {
            if (!(error instanceof HttpError) || ![404, 410].includes(error.status)) throw error;
            state.profiles[index] = { ...profile, detailStatus: "unavailable", detailFetchedAt: new Date().toISOString() };
            options.log(`Public details unavailable for ${profile.id}; keeping its search summary.`);
          }
          await saveProgress();
          const done = state.profiles.filter(profile => profile.detailStatus !== "not-requested").length;
          options.log(`Details ${done}/${state.profiles.length}`);
        } catch (error) {
          failure ??= error;
        }
      }
    };
    // Drain active workers before returning so a failure cannot race a checkpoint write.
    await Promise.all(Array.from({ length: concurrency }, worker));
    if (failure) throw failure;
  }
  return state;
}

export function makeExport(state: Checkpoint, enrichmentRequested: boolean) {
  const profiles = [...state.profiles].sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
  const countries = new Map<string, number>();
  for (const profile of profiles) if (profile.country) countries.set(profile.country, (countries.get(profile.country) ?? 0) + 1);
  const enrichedCount = profiles.filter(profile => profile.detailStatus === "ok").length;
  return {
    schemaVersion: 1,
    source: SOURCE_URL,
    startedAt: state.startedAt,
    exportedAt: new Date().toISOString(),
    filters: { program: "MVP", query: state.config.query, country: state.config.country },
    coverage: {
      expectedProfiles: state.expectedTotal,
      exportedProfiles: profiles.length,
      listingComplete: state.listingComplete,
      enrichmentRequested,
      enrichedProfiles: enrichedCount,
      unavailableProfiles: profiles.filter(profile => profile.detailStatus === "unavailable").length,
      enrichmentComplete: enrichmentRequested && enrichedCount === profiles.length,
      awardHistoryAvailable: false,
    },
    countries: [...countries].map(([country, count]) => ({ country, count })).sort((a, b) => a.country.localeCompare(b.country, "en")),
    profilesWithoutCountry: profiles.filter(profile => !profile.country).length,
    profiles,
  };
}
