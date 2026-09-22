import "server-only";
import profilesData from "@/data/profiles.json";
import { countries, manifest } from "./catalog";
import { parseFilters, queryDirectory } from "./directory";
import type { MvpProfile } from "./types";

export type SearchParams = Record<string, string | string[] | undefined>;
export function serverResults(search: SearchParams, country?: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) if (typeof value === "string") params.set(key, value);
  if (country) params.set("country", country);
  const filters = parseFilters(params, countries, manifest);
  return { filters, ...queryDirectory(profilesData as MvpProfile[], countries, filters) };
}
export type DirectoryResult = ReturnType<typeof serverResults>;
