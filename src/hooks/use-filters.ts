"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { countries, manifest } from "@/lib/catalog";
import { parseFilters, updateFilters, viewHref } from "@/lib/directory";
import type { Filters } from "@/lib/types";

export function useFilters() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const routeCountry = pathname.startsWith("/countries/") ? pathname.split("/")[2] : undefined;
  const filters = parseFilters(new URLSearchParams(search.toString()), countries, manifest);
  if (routeCountry) filters.country = routeCountry;
  const setFilters = useCallback((changes: Partial<Filters>, replace = false) => {
    const current = parseFilters(new URLSearchParams(window.location.search), countries, manifest);
    if (routeCountry) current.country = routeCountry;
    const next = updateFilters(current, changes);
    if (routeCountry && changes.country !== undefined && changes.country !== routeCountry) {
      router.push(viewHref(changes.country ? `/countries/${changes.country}` : "/mvps", { ...next, country: "" }));
      return;
    }
    const href = viewHref(pathname, routeCountry ? { ...next, country: "" } : next);
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, [pathname, routeCountry, router]);
  return { filters, setFilters };
}
