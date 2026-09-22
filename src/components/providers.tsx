"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { countries, manifest } from "@/lib/catalog";
import type { MvpProfile } from "@/lib/types";

let cached: Promise<MvpProfile[]> | null = null;
function loadProfiles() {
  if (!cached) cached = fetch(manifest.dataUrl).then(async response => {
    if (!response.ok) throw new Error("The directory could not be loaded.");
    const data: MvpProfile[] = await response.json();
    const ids = new Set(countries.map(country => country.id));
    if (!Array.isArray(data) || data.length !== manifest.profileCount || new Set(data.map(profile => profile.id)).size !== data.length || data.some(profile => !ids.has(profile.countryId) || typeof profile.name !== "string" || !Array.isArray(profile.awardCategories) || !Array.isArray(profile.technologies))) throw new Error("The directory snapshot is invalid.");
    return data;
  }).catch(error => { cached = null; throw error; });
  return cached;
}
interface DirectoryContextValue { profiles: MvpProfile[] | null; error: string | null; retry: () => void }
const DirectoryContext = createContext<DirectoryContextValue>({ profiles: null, error: null, retry: () => {} });
export const useDirectory = () => useContext(DirectoryContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<MvpProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retry = useCallback(() => {
    setError(null);
    loadProfiles().then(setProfiles).catch(() => setError("We couldn’t load the directory. Please try again."));
  }, []);
  useEffect(() => {
    let active = true;
    loadProfiles().then(data => { if (active) setProfiles(data); }).catch(() => { if (active) setError("We couldn’t load the directory. Please try again."); });
    return () => { active = false; };
  }, []);
  return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <TooltipProvider delayDuration={250}>
      <DirectoryContext.Provider value={{ profiles, error, retry }}>{children}</DirectoryContext.Provider>
    </TooltipProvider>
    {process.env.NODE_ENV === "production" && <Analytics beforeSend={event => {
      const url = new URL(event.url);
      return { ...event, url: `${url.origin}${url.pathname}` };
    }} />}
  </ThemeProvider>;
}
