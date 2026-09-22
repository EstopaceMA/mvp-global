"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, Check, ChevronDown, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { countries, formatCount, manifest } from "@/lib/catalog";
import { EMPTY_FILTERS, hasFilters } from "@/lib/directory";
import { useFilters } from "@/hooks/use-filters";
import type { Filters } from "@/lib/types";

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange(value: string): void }) {
  return <Select value={value || "__all"} onValueChange={value => onChange(value === "__all" ? "" : value)}>
    <SelectTrigger aria-label={label} className="filter-select"><SelectValue placeholder={label}/></SelectTrigger>
    <SelectContent position="popper"><SelectItem value="__all">All {label.toLowerCase()}</SelectItem>{options.map(option => <SelectItem value={option} key={option}>{option}</SelectItem>)}</SelectContent>
  </Select>;
}

export function CountryPicker({ value, onSelect, counts = manifest.counts }: { value: string; onSelect(slug: string): void; counts?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const selected = countries.find(country => country.slug === value);
  const sorted = [...countries].sort((a, b) => Number(!!manifest.counts[b.id]) - Number(!!manifest.counts[a.id]) || a.name.localeCompare(b.name, "en"));
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-expanded={open} aria-label="Select country" className="country-picker"><Globe2 size={14}/><span>{selected?.name ?? "All countries"}</span><ChevronDown size={13}/></Button></PopoverTrigger>
    <PopoverContent className="w-[300px] p-0" align="start"><Command>
      <CommandInput placeholder="Find a country or region…" aria-label="Search countries" />
      <CommandList><CommandEmpty>No country found.</CommandEmpty><CommandGroup heading="Countries & regions">
        <CommandItem value="All countries" onSelect={() => { onSelect(""); setOpen(false); }}><Globe2 size={14}/>All countries{!value && <Check className="ml-auto" size={14}/>}</CommandItem>
        {sorted.map(country => <CommandItem key={country.id} value={country.name} onSelect={() => { onSelect(country.slug); setOpen(false); }}>
          <span>{country.name}</span><span className="ml-auto tabular-nums text-xs text-muted-foreground">{formatCount(counts[country.id] ?? 0)}</span>{country.slug === value && <Check size={13}/>}
        </CommandItem>)}
      </CommandGroup></CommandList>
    </Command></PopoverContent>
  </Popover>;
}

export function FilterBar({ counts, onInteract, onSubmit }: { counts?: Record<string, number>; onInteract?: (values: Partial<Filters>) => void; onSubmit?: () => void }) {
  const { filters, setFilters } = useFilters();
  const search = useSearchParams();
  const change = (values: Partial<Filters>, replace = false) => { setFilters(values, replace); onInteract?.(values); };
  const extraCount = Number(!!filters.technology) + Number(!!filters.region);
  return <div className="filter-bar">
    <div className="search-field"><Search size={18}/><Input aria-label="Search MVPs" placeholder="Search people, places, and expertise…" value={search.get("q") ?? ""} onChange={event => change({ q: event.target.value }, true)} onKeyDown={event => {
      if (event.key === "Enter" && onSubmit && !event.nativeEvent.isComposing) {
        // The modal moves focus to Close; cancel Enter's default click on that new target.
        event.preventDefault();
        onSubmit();
      }
    }}/>
      {filters.q ? <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => change({ q: "" })}><X size={15}/></Button> : <span className="search-hint">EXPLORE</span>}
    </div>
    <div className="filter-row">
      <CountryPicker value={filters.country} counts={counts} onSelect={country => change({ country })}/>
      <FilterSelect label="Categories" value={filters.category} options={manifest.categories} onChange={category => change({ category })}/>
      <Popover><PopoverTrigger asChild><Button variant="outline" className="more-filters" aria-label="More filters"><SlidersHorizontal size={14}/><span>Filters</span>{extraCount > 0 && <span className="filter-number">{extraCount}</span>}</Button></PopoverTrigger>
        <PopoverContent className="w-80" align="end"><div className="space-y-4"><div><h3 className="font-semibold">Refine your discovery</h3><p className="mt-1 text-xs text-muted-foreground">Find the expertise you’re looking for.</p></div>
          <div className="space-y-2"><p className="text-xs font-medium">Technology</p><FilterSelect label="Technologies" value={filters.technology} options={manifest.technologies} onChange={technology => change({ technology })}/></div>
          <div className="space-y-2"><p className="text-xs font-medium">Region</p><FilterSelect label="Regions" value={filters.region} options={manifest.regions} onChange={region => change({ region })}/></div>
          <Button variant="secondary" className="w-full" onClick={() => change({ technology: "", region: "" })}>Reset these filters</Button>
        </div></PopoverContent>
      </Popover>
      {hasFilters(filters) && <Button variant="ghost" size="icon" aria-label="Reset all filters" onClick={() => change(EMPTY_FILTERS)}><X size={15}/></Button>}
    </div>
    {(filters.technology || filters.region) && <div className="active-filters">{(["technology", "region"] as const).filter(key => filters[key]).map(key => <button key={key} onClick={() => change({ [key]: "" })} aria-label={`Remove ${filters[key]} filter`}>{filters[key]}<X size={11}/></button>)}</div>}
  </div>;
}
