export interface MvpProfile {
  id: string;
  name: string;
  countryId: string;
  photoUrl: string | null;
  awardCategories: string[];
  technologies: string[];
  officialProfileUrl: string;
}

export interface Country {
  id: string;
  name: string;
  slug: string;
  region: string;
  lat: number;
  lng: number;
  geometryId: string | null;
}

export interface SnapshotManifest {
  schemaVersion: 1;
  version: string;
  source: string;
  exportedAt: string;
  dataUrl: string;
  profileCount: number;
  countryCount: number;
  counts: Record<string, number>;
  categories: string[];
  technologies: string[];
  regions: string[];
  coverage: { listingComplete: true; enrichmentComplete: true; awardHistoryAvailable: false };
}

export interface Filters {
  q: string;
  country: string[];
  category: string[];
  technology: string[];
  region: string[];
  page: number;
}

export type FacetKey = "country" | "category" | "technology" | "region";
export type RelaxableKey = FacetKey | "q";
export interface Facet {
  counts: Record<string, number>;
  total: number;
}
export type Facets = Record<FacetKey, Facet>;
export interface Relaxation {
  key: RelaxableKey;
  count: number;
}

export const PAGE_SIZE = 24;
export const EMPTY_FILTERS: Filters = { q: "", country: [], category: [], technology: [], region: [], page: 1 };
