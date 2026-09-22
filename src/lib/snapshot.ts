import { z } from "zod";
import type { Country, MvpProfile } from "./types";

const source = "https://mvp.microsoft.com/en-US/search?target=Profile&program=MVP";
const stringList = z.array(z.string().trim().min(1));
const sourceProfile = z.object({
  // Legacy Microsoft GUIDs do not always follow RFC UUID version/variant bits.
  id: z.string().regex(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i), name: z.string().trim().min(1), country: z.string().min(1),
  photoUrl: z.url().nullable(), awardCategories: stringList, technologies: stringList,
  officialProfileUrl: z.url(), detailStatus: z.literal("ok"),
});
const snapshotSchema = z.object({
  schemaVersion: z.literal(1), source: z.literal(source), exportedAt: z.iso.datetime(),
  filters: z.object({ program: z.literal("MVP"), query: z.literal(""), country: z.literal("") }),
  coverage: z.object({
    listingComplete: z.literal(true), enrichmentComplete: z.literal(true),
    expectedProfiles: z.number().int().positive(), exportedProfiles: z.number().int().positive(),
    enrichedProfiles: z.number().int().positive(), unavailableProfiles: z.literal(0),
  }),
  profiles: z.array(sourceProfile).min(1),
});

export function prepareSnapshot(input: unknown, countries: Country[]) {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid snapshot: ${parsed.error.issues.slice(0, 3).map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const snapshot = parsed.data;
  const byName = new Map(countries.map(country => [country.name, country]));
  if (byName.size !== countries.length || new Set(countries.map(country => country.id)).size !== countries.length || new Set(countries.map(country => country.slug)).size !== countries.length) throw new Error("Country names, identifiers, and slugs must be unique.");
  if (countries.some(country => !Number.isFinite(country.lat) || !Number.isFinite(country.lng) || Math.abs(country.lat) > 90 || Math.abs(country.lng) > 180)) throw new Error("Invalid country coordinates.");
  const ids = new Set<string>();
  const counts: Record<string, number> = {};
  const profiles: MvpProfile[] = snapshot.profiles.map(profile => {
    if (ids.has(profile.id)) throw new Error(`Duplicate profile: ${profile.id}`);
    ids.add(profile.id);
    const country = byName.get(profile.country);
    if (!country) throw new Error(`Unmapped source country: ${profile.country}`);
    const official = new URL(profile.officialProfileUrl);
    if (official.origin !== "https://mvp.microsoft.com" || official.pathname !== `/en-US/mvp/profile/${profile.id}`) throw new Error(`Invalid official profile URL: ${profile.id}`);
    if (profile.photoUrl && new URL(profile.photoUrl).origin !== "https://images.mvp.microsoft.com") throw new Error(`Unexpected image host: ${profile.id}`);
    counts[country.id] = (counts[country.id] ?? 0) + 1;
    return { id: profile.id, name: profile.name, countryId: country.id, photoUrl: profile.photoUrl,
      awardCategories: [...new Set(profile.awardCategories)], technologies: [...new Set(profile.technologies)], officialProfileUrl: profile.officialProfileUrl };
  }).sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
  const { expectedProfiles, exportedProfiles, enrichedProfiles } = snapshot.coverage;
  if ([expectedProfiles, exportedProfiles, enrichedProfiles].some(count => count !== profiles.length)) throw new Error("Source coverage does not match the unique profile count.");
  return { profiles, counts, source, exportedAt: snapshot.exportedAt,
    categories: [...new Set(profiles.flatMap(profile => profile.awardCategories))].sort(),
    technologies: [...new Set(profiles.flatMap(profile => profile.technologies))].sort(),
    regions: [...new Set(countries.filter(country => counts[country.id]).map(country => country.region))].sort(),
  };
}
