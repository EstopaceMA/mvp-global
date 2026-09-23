export const SOURCE_URL = "https://mvp.microsoft.com/en-US/search?target=Profile&program=MVP";
export const SITE_ORIGIN = "https://mvp.microsoft.com";

export interface MvpProfile {
  id: string;
  name: string;
  country: string | null;
  photoUrl: string | null;
  headline: string | null;
  awardCategories: string[] | null;
  technologies: string[] | null;
  yearsInProgram: number | null;
  // The observed public response does not provide individual award years.
  awardYears: number[] | null;
  officialProfileUrl: string;
  lastSeenAt: string;
  detailFetchedAt: string | null;
  detailStatus: "not-requested" | "ok" | "unavailable";
}

export function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Unexpected ${label}: expected an object. The source schema may have changed.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function httpsUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
    throw new Error(`Unexpected ${label}: expected a string array.`);
  }
  return [...new Set(value.map(item => item.trim()).filter(Boolean))];
}

export function normalizeSummary(value: unknown, observedAt: string): MvpProfile {
  const row = object(value, "search profile");
  const id = text(row.userProfileIdentifier);
  if (!id || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) {
    throw new Error("Search profile has a missing or invalid public identifier.");
  }
  if (!Array.isArray(row.tenants) || !row.tenants.includes("MVP")) {
    throw new Error(`Search returned a non-MVP profile (${id}); refusing to mix programs.`);
  }
  const standardName = [text(row.firstName), text(row.lastName)].filter(Boolean).join(" ");
  const localizedName = [text(row.localizedFirstName), text(row.localizedLastName)].filter(Boolean).join(" ");
  const name = (row.screenNameLocalized === true ? localizedName : standardName) || standardName || localizedName;
  if (!name) throw new Error(`Profile ${id} has no display name.`);
  return {
    id: id.toLowerCase(), name, country: text(row.addressCountryOrRegionName),
    photoUrl: httpsUrl(row.profilePictureUrl), headline: text(row.headline),
    awardCategories: null, technologies: null, yearsInProgram: null, awardYears: null,
    officialProfileUrl: `${SITE_ORIGIN}/en-US/mvp/profile/${id.toLowerCase()}`,
    lastSeenAt: observedAt, detailFetchedAt: null, detailStatus: "not-requested",
  };
}

export function parseSearch(value: unknown, observedAt: string) {
  const body = object(value, "search response");
  if (!Number.isSafeInteger(body.filteredCount) || (body.filteredCount as number) < 0 || !Array.isArray(body.communityLeaderProfiles)) {
    throw new Error("Unexpected search response: expected filteredCount and communityLeaderProfiles.");
  }
  return {
    total: body.filteredCount as number,
    profiles: body.communityLeaderProfiles.map(row => normalizeSummary(row, observedAt)),
  };
}

export function enrichProfile(profile: MvpProfile, value: unknown, observedAt: string): MvpProfile {
  const row = object(object(value, "profile response").userProfile, "public profile");
  if (text(row.userProfileIdentifier)?.toLowerCase() !== profile.id) {
    throw new Error(`Public profile identifier did not match ${profile.id}.`);
  }
  if (row.isPrivate !== false) throw new Error(`Profile ${profile.id} is no longer confirmed public; restart the scrape.`);
  const latest = normalizeSummary(row, profile.lastSeenAt);
  return {
    ...latest,
    awardCategories: strings(row.awardCategory, "award categories"),
    technologies: strings(row.technologyFocusArea, "technology areas"),
    yearsInProgram: Number.isSafeInteger(row.yearsInProgram) && (row.yearsInProgram as number) >= 0 ? row.yearsInProgram as number : null,
    detailFetchedAt: observedAt, detailStatus: "ok",
  };
}

export function searchPayload(pageIndex: number, pageSize: number, query: string, country: string) {
  return {
    searchKey: query, academicInstitution: "", program: ["MVP"],
    countryRegionList: country ? [country] : [], stateProvinceList: [],
    languagesList: [], milestonesList: [], academicCountryRegionList: [],
    technologyFocusAreaList: [], industryFocusList: [], technicalExpertiseList: [],
    technologyFocusAreaGroupList: [], pageIndex, pageSize,
  };
}

export function discoverApiOrigin(script: string): string {
  const match = script.match(/Object\.freeze\((\{[\s\S]*\})\)\s*;?\s*$/);
  if (!match?.[1]) throw new Error("Could not read the site's runtime configuration; no JavaScript was executed.");
  const config = object(JSON.parse(match[1]), "runtime configuration");
  const values = object(config.values, "runtime values");
  const origin = values.REACT_APP_BACKEND_HOST_AFD || values.REACT_APP_BACKEND_HOST;
  if (origin !== "https://mavenapi-prod.microsoft.com" && origin !== "https://mavenapi-prod.azurewebsites.net") {
    throw new Error("The public API host changed. Review scripts/lib/source.ts before continuing.");
  }
  return origin;
}
