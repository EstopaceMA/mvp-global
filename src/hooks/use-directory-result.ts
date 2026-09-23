"use client";

import { useMemo } from "react";
import { useDirectory } from "@/components/providers";
import { countries } from "@/lib/catalog";
import { filterParams, queryDirectory } from "@/lib/directory";
import type { DirectoryResult } from "@/lib/server-directory";
import type { Filters } from "@/lib/types";

export function useDirectoryResult(filters: Filters, initial?: DirectoryResult) {
  const { profiles } = useDirectory();
  const { q, country, category, technology, region, page } = filters;
  return useMemo(() => {
    const current = { q, country, category, technology, region, page };
    if (profiles) return queryDirectory(profiles, countries, current);
    // A server result remains useful during loading/failure only for its original filters.
    return initial && filterParams(initial.filters).toString() === filterParams(current).toString() ? initial : null;
  }, [profiles, initial, q, country, category, technology, region, page]);
}
