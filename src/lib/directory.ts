import type { Country, FacetKey, Facets, Filters, MvpProfile, RelaxableKey, Relaxation, SnapshotManifest } from "./types";
import { EMPTY_FILTERS, PAGE_SIZE } from "./types";

export function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/[’']/g, "");
}

export function parseFilters(params: URLSearchParams, countries: Country[], manifest: Pick<SnapshotManifest, "categories" | "technologies" | "regions">): Filters {
  const values = (key: string, valid: string[]) => [...new Set(params.getAll(key))].filter(value => valid.includes(value));
  const page = Number(params.get("page") ?? 1);
  return { q: (params.get("q") ?? "").trim().slice(0, 200),
    country: values("country", countries.map(entry => entry.slug)),
    category: values("category", manifest.categories),
    technology: values("technology", manifest.technologies),
    region: values("region", manifest.regions),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}

export function filterParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const key of ["country", "category", "technology", "region"] as const) for (const value of new Set(filters[key])) params.append(key, value);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function viewHref(path: string, filters: Filters) {
  const params = filterParams(filters).toString();
  return path + (params ? `?${params}` : "");
}

export function updateFilters(current: Filters, changes: Partial<Filters>): Filters {
  return { ...current, ...changes, page: changes.page ?? 1 };
}

export function queryDirectory(profiles: MvpProfile[], countries: Country[], filters: Filters) {
  const byId = new Map(countries.map(country => [country.id, country]));
  const tokens = normalize(filters.q).split(/\s+/).filter(Boolean);
  const facetKeys: FacetKey[] = ["country", "category", "technology", "region"];
  const relaxationOrder: RelaxableKey[] = ["country", "region", "category", "q", "technology"];
  const facets: Facets = {
    country: { counts: {}, total: 0 }, category: { counts: {}, total: 0 },
    technology: { counts: {}, total: 0 }, region: { counts: {}, total: 0 },
  };
  const relaxedCounts: Record<RelaxableKey, number> = { country: 0, category: 0, technology: 0, region: 0, q: 0 };
  const matches: MvpProfile[] = [];
  for (const profile of profiles) {
    const country = byId.get(profile.countryId);
    if (!country) continue;
    const text = tokens.length ? normalize([profile.name, country.name, country.region, ...profile.awardCategories, ...profile.technologies].join(" ")) : "";
    const passes: Record<RelaxableKey, boolean> = {
      country: !filters.country.length || filters.country.includes(country.slug),
      category: !filters.category.length || filters.category.some(value => profile.awardCategories.includes(value)),
      technology: !filters.technology.length || filters.technology.some(value => profile.technologies.includes(value)),
      region: !filters.region.length || filters.region.includes(country.region),
      q: tokens.every(token => text.includes(token)),
    };
    const failed = relaxationOrder.filter(key => !passes[key]);
    // A facet may ignore exactly one criterion; two failures cannot contribute.
    if (failed.length > 1) continue;
    if (!failed.length) matches.push(profile);
    else relaxedCounts[failed[0]]++;
    for (const key of facetKeys) {
      if (failed.length && failed[0] !== key) continue;
      const facet = facets[key];
      facet.total++;
      const values = key === "country" ? [country.id] : key === "region" ? [country.region]
        : key === "category" ? profile.awardCategories : profile.technologies;
      for (const value of new Set(values)) facet.counts[value] = (facet.counts[value] ?? 0) + 1;
    }
  }
  const relaxations: Relaxation[] = matches.length ? [] : relaxationOrder
    .filter(key => filters[key].length && relaxedCounts[key] > 0)
    .map(key => ({ key, count: relaxedCounts[key] }))
    .sort((a, b) => Number(a.key === "technology") - Number(b.key === "technology") || a.count - b.count || relaxationOrder.indexOf(a.key) - relaxationOrder.indexOf(b.key))
    .slice(0, 3);
  const sorted = matches.sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  return { total: sorted.length, globalTotal: facets.country.total, counts: facets.country.counts, facets, relaxations, page, pages,
    profiles: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export type QueryResult = ReturnType<typeof queryDirectory>;

export function describeFilter(key: RelaxableKey, filters: Filters, countries: Country[]) {
  const value = key === "q" ? filters.q : filters[key].map(value => key === "country" ? countries.find(country => country.slug === value)?.name ?? value : value).join(", ");
  return `${key === "q" ? "search" : key}: ${value}`;
}

export function hasFilters(filters: Filters) {
  return !!(filters.q || filters.country.length || filters.category.length || filters.technology.length || filters.region.length);
}
export { EMPTY_FILTERS };
