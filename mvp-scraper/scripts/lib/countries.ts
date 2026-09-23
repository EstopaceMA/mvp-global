import { createHash } from "node:crypto";
import type { makeExport } from "./crawl.js";

type Directory = ReturnType<typeof makeExport>;

export function splitByCountry(directory: Directory) {
  if (directory.schemaVersion !== 1 || !directory.coverage?.listingComplete ||
      directory.filters?.query || directory.filters?.country ||
      !Array.isArray(directory.profiles) ||
      directory.profiles.length !== directory.coverage.expectedProfiles ||
      directory.profiles.length !== directory.coverage.exportedProfiles) {
    throw new Error("Country exports require a complete, unfiltered directory snapshot.");
  }
  const ids = new Set<string>();
  const groups = new Map<string | null, Directory["profiles"]>();
  for (const profile of directory.profiles) {
    if (!profile.id || ids.has(profile.id)) throw new Error("Directory contains a missing or duplicate profile ID.");
    if (profile.country !== null && (typeof profile.country !== "string" || !profile.country.trim())) {
      throw new Error(`Invalid country on profile ${profile.id}.`);
    }
    ids.add(profile.id);
    const group = groups.get(profile.country) ?? [];
    group.push(profile);
    groups.set(profile.country, group);
  }
  const filenames = new Set<string>();
  const exports = [...groups].sort(([a], [b]) => (a ?? "\uffff").localeCompare(b ?? "\uffff", "en")).map(([country, profiles]) => {
    const slug = country?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let filename = country === null ? "_unknown.json" : `${slug || "country"}.json`;
    if (filename === "index.json" || filenames.has(filename)) {
      filename = `${slug || "country"}-${createHash("sha256").update(country ?? "").digest("hex").slice(0, 12)}.json`;
    }
    if (filenames.has(filename)) throw new Error("Country filename collision.");
    filenames.add(filename);
    const enriched = profiles.filter(profile => profile.detailStatus === "ok").length;
    return {
      filename,
      data: {
        schemaVersion: 1,
        source: directory.source,
        startedAt: directory.startedAt,
        exportedAt: directory.exportedAt,
        country,
        coverage: {
          listingComplete: true,
          exportedProfiles: profiles.length,
          enrichedProfiles: enriched,
          enrichmentComplete: directory.coverage.enrichmentRequested && enriched === profiles.length,
          unavailableProfiles: profiles.filter(profile => profile.detailStatus === "unavailable").length,
          awardHistoryAvailable: false,
        },
        profiles,
      },
    };
  });
  return {
    exports,
    index: {
      schemaVersion: 1,
      source: directory.source,
      startedAt: directory.startedAt,
      exportedAt: directory.exportedAt,
      coverage: directory.coverage,
      countryCount: exports.filter(entry => entry.data.country !== null).length,
      profilesWithoutCountry: groups.get(null)?.length ?? 0,
      countries: exports.map(({ filename, data }) => ({
        country: data.country, count: data.profiles.length, enrichedProfiles: data.coverage.enrichedProfiles, file: filename,
      })),
    },
  };
}
