import countryData from "@/data/countries.json";
import manifestData from "@/data/manifest.json";
import type { Country, SnapshotManifest } from "./types";

export const countries = countryData as Country[];
export const manifest = manifestData as SnapshotManifest;
export const countryById = new Map(countries.map(country => [country.id, country]));
export const snapshotDate = new Date(manifest.exportedAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatCount = (value: number) => value.toLocaleString("en");
