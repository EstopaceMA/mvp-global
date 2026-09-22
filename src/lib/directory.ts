import type { Country, Filters, MvpProfile, SnapshotManifest } from "./types";
import { EMPTY_FILTERS, PAGE_SIZE } from "./types";

export function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/[’']/g, "");
}

export function parseFilters(params: URLSearchParams, countries: Country[], manifest: Pick<SnapshotManifest, "categories" | "technologies" | "regions">): Filters {
  const country = params.get("country") ?? "";
  const category = params.get("category") ?? "";
  const technology = params.get("technology") ?? "";
  const region = params.get("region") ?? "";
  const page = Number(params.get("page") ?? 1);
  return { q: (params.get("q") ?? "").trim().slice(0, 200),
    country: countries.some(entry => entry.slug === country) ? country : "",
    category: manifest.categories.includes(category) ? category : "",
    technology: manifest.technologies.includes(technology) ? technology : "",
    region: manifest.regions.includes(region) ? region : "",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}

export function filterParams(filters: Filters) {
  const params = new URLSearchParams();
  for (const key of ["q", "country", "category", "technology", "region"] as const) if (filters[key]) params.set(key, filters[key]);
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
  const selected = countries.find(country => country.slug === filters.country);
  const tokens = normalize(filters.q).split(/\s+/).filter(Boolean);
  const counts: Record<string, number> = {};
  const globalMatches = profiles.filter(profile => {
    const country = byId.get(profile.countryId);
    if (!country || (filters.category && !profile.awardCategories.includes(filters.category)) ||
        (filters.technology && !profile.technologies.includes(filters.technology)) ||
        (filters.region && country.region !== filters.region)) return false;
    const text = normalize([profile.name, country.name, country.region, ...profile.awardCategories, ...profile.technologies].join(" "));
    if (!tokens.every(token => text.includes(token))) return false;
    counts[country.id] = (counts[country.id] ?? 0) + 1;
    return true;
  });
  const matches = selected ? globalMatches.filter(profile => profile.countryId === selected.id) : globalMatches;
  const sorted = [...matches].sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  return { total: sorted.length, globalTotal: globalMatches.length, counts, page, pages,
    profiles: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export function hasFilters(filters: Filters) {
  return !!(filters.q || filters.country || filters.category || filters.technology || filters.region);
}
export { EMPTY_FILTERS };
