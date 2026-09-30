import "server-only";
import profilesData from "@/data/profiles.json";
import { countries, manifest } from "./catalog";
import { parseFilters, queryDirectory } from "./directory";
import type { MvpProfile } from "./types";

const profiles = profilesData as MvpProfile[];
const profilesById = new Map(profiles.map(profile => [profile.id, profile]));

// Shared by profile rendering and metadata; the published snapshot stays server-side.
export function getProfileById(id: string) {
  return profilesById.get(id);
}

export type SearchParams = Record<string, string | string[] | undefined>;
export function serverResults(search: SearchParams, country?: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const item of typeof value === "string" ? [value] : value ?? []) params.append(key, item);
  }
  if (country) params.set("country", country);
  const filters = parseFilters(params, countries, manifest);
  return { filters, ...queryDirectory(profiles, countries, filters) };
}
export type DirectoryResult = ReturnType<typeof serverResults>;
