"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import Clarity from "@microsoft/clarity";
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

function ThemeColor() {
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  useEffect(() => {
    if (!resolvedTheme) return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#111111" : "#ffffff");
  }, [resolvedTheme, pathname]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      Clarity.init("ymc3v0693l");
    }
  }, []);

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
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <ThemeColor/>
    <TooltipProvider delayDuration={250}>
      <DirectoryContext.Provider value={{ profiles, error, retry }}>{children}</DirectoryContext.Provider>
    </TooltipProvider>
    {process.env.NODE_ENV === "production" && <Analytics beforeSend={event => {
      const url = new URL(event.url);
      return { ...event, url: `${url.origin}${url.pathname}` };
    }} />}
  </ThemeProvider>;
}
