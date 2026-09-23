"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { countries, manifest } from "@/lib/catalog";
import { parseFilters, updateFilters, viewHref } from "@/lib/directory";
import type { Filters } from "@/lib/types";

export function useFilters() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const routeCountry = pathname.startsWith("/countries/") ? pathname.split("/")[2] : undefined;
  const searchKey = search.toString();
  const filters = useMemo(() => {
    const parsed = parseFilters(new URLSearchParams(searchKey), countries, manifest);
    if (routeCountry) parsed.country = [routeCountry];
    return parsed;
  }, [searchKey, routeCountry]);
  const setFilters = useCallback((changes: Partial<Filters>, replace = false) => {
    const current = parseFilters(new URLSearchParams(window.location.search), countries, manifest);
    if (routeCountry) current.country = [routeCountry];
    const next = updateFilters(current, changes);
    if (routeCountry && changes.country !== undefined && (changes.country.length !== 1 || changes.country[0] !== routeCountry)) {
      router.push(viewHref("/mvps", next));
      return;
    }
    const href = viewHref(pathname, routeCountry ? { ...next, country: [] } : next);
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, [pathname, routeCountry, router]);
  return { filters, setFilters };
}
