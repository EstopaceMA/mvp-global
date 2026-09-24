"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useMedia } from "@/hooks/use-media";
import { countries, formatCount, manifest } from "@/lib/catalog";
import { EMPTY_FILTERS, hasFilters, normalize } from "@/lib/directory";
import { useFilters } from "@/hooks/use-filters";
import type { Facet, Facets, Filters } from "@/lib/types";

function FacetCount({ count }: { count?: number }) {
  return <span className="facet-count" data-count={count ?? "pending"} aria-label={count === undefined ? "Matching count unavailable" : `${formatCount(count)} matching MVPs`}>{count === undefined ? "—" : formatCount(count)}</span>;
}

interface PickerOption { value: string; label: string; countKey: string }
const optionsFor = (values: string[]): PickerOption[] => [...values].sort((a, b) => a.localeCompare(b, "en")).map(value => ({ value, label: value, countKey: value }));
const pickerSettings = {
  country: { options: [...countries].sort((a, b) => a.name.localeCompare(b.name, "en")).map(country => ({ value: country.slug, label: country.name, countKey: country.id })), allLabel: "All countries", label: "Select country", searchLabel: "Search countries", placeholder: "Find a country or region…", plural: "countries" },
  category: { options: optionsFor(manifest.categories), allLabel: "All award categories", label: "Select award category", searchLabel: "Search award categories", placeholder: "Find an award category…", plural: "award categories" },
  technology: { options: optionsFor(manifest.technologies), allLabel: "All technologies", label: "Technologies", searchLabel: "Search technologies", placeholder: "Find a technology…", plural: "technologies" },
  region: { options: optionsFor(manifest.regions), allLabel: "All regions", label: "Regions", searchLabel: "Search regions", placeholder: "Find a region…", plural: "regions" },
};

function ExpertisePicker({ kind, value, facet, onSelect }: { kind: keyof typeof pickerSettings; value: string[]; facet?: Facet; onSelect(value: string[]): void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const { options, allLabel, label, searchLabel, placeholder, plural } = pickerSettings[kind];
  const labels = value.map(value => options.find(option => option.value === value)?.label ?? value);
  const selected = labels.join(", ") || allLabel;
  const visible = [{ value: "", label: allLabel, countKey: "" }, ...options].filter(option => normalize(query).split(/\s+/).every(token => normalize(option.label).includes(token)));
  const activeIndex = Math.min(active, visible.length - 1);
  const toggle = (next: string) => onSelect(!next ? [] : value.includes(next) ? value.filter(entry => entry !== next) : [...value, next]);
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-active="true"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, query]);
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) { setQuery(""); setActive(0); } }}>
    <span id={`${id}-selection`} className="sr-only">{selected}</span>
    <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-label={label} aria-describedby={`${id}-selection`} title={selected} className={`expertise-picker filter-select ${kind}-picker`}><span>{labels.length > 1 ? `${labels.length} ${plural}` : selected}</span><ChevronDown size={13}/></Button></PopoverTrigger>
    <PopoverContent className={`expertise-options p-0 ${kind === "technology" || kind === "region" ? "nested-picker-options" : ""}`} align="start" onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActive(visible.length ? (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + visible.length) % visible.length : 0);
      } else if ((event.key === "Home" || event.key === "End") && event.target === list.current) {
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : visible.length - 1);
      } else if ((event.key === "Enter" && (event.target instanceof HTMLInputElement || event.target === list.current)) || (event.key === " " && event.target === list.current)) {
        event.preventDefault();
        if (visible[activeIndex]) toggle(visible[activeIndex].value);
      }
    }}>
      <div className="picker-search"><Search size={16} aria-hidden="true"/><input role="combobox" aria-label={searchLabel} placeholder={placeholder} aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }}/></div>
      <div id={`${id}-list`} ref={list} className="picker-list" role="listbox" aria-label={label} aria-multiselectable="true" tabIndex={0} aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}>
        {visible.map((option, index) => {
          const checked = option.value ? value.includes(option.value) : !value.length;
          return <div id={`${id}-option-${index}`} role="option" aria-selected={checked} data-active={index === activeIndex} key={option.value} className="picker-option" onMouseDown={event => event.preventDefault()} onClick={() => { setActive(index); toggle(option.value); }}>
            <span className="picker-check" aria-hidden="true">{checked && <Check size={14}/>}</span><span className="facet-option-label">{option.label}</span><FacetCount count={facet ? option.value ? facet.counts[option.countKey] ?? 0 : facet.total : undefined}/>
          </div>;
        })}
      </div>
      {!visible.length && <p className="picker-empty">No matching {plural}.</p>}
      <div className="picker-footer"><Button variant="ghost" size="sm" disabled={!value.length} onClick={() => onSelect([])}>Clear selections</Button><Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Done</Button></div>
    </PopoverContent>
  </Popover>;
}

export function FilterBar({ facets, onInteract, onSubmit }: { facets?: Facets; onInteract?: (values: Partial<Filters>) => void; onSubmit?: () => void }) {
  const { filters, setFilters } = useFilters();
  const search = useSearchParams();
  const resetButton = useRef<HTMLButtonElement>(null);
  const mobile = useMedia("(max-width: 767px)");
  const change = (values: Partial<Filters>, replace = false) => { setFilters(values, replace); onInteract?.(values); };
  const extraCount = filters.technology.length + filters.region.length;
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
      <ExpertisePicker kind="country" value={filters.country} facet={facets?.country} onSelect={country => change({ country })}/>
      <ExpertisePicker kind="category" value={filters.category} facet={facets?.category} onSelect={category => change({ category })}/>
      {mobile
        ? <ExpertisePicker kind="technology" value={filters.technology} facet={facets?.technology} onSelect={technology => change({ technology })}/>
        : <Popover><PopoverTrigger asChild><Button variant="outline" className="more-filters" aria-label="More filters"><SlidersHorizontal size={14}/><span>Filters</span>{extraCount > 0 && <span className="filter-number">{extraCount}</span>}</Button></PopoverTrigger>
          <PopoverContent className="more-filter-options w-80" align="end"><div className="space-y-4"><div><h3 className="font-semibold">Refine your discovery</h3><p className="mt-1 text-xs text-muted-foreground">Match any selection within a filter.</p></div>
            <div className="space-y-2"><p className="text-xs font-medium">Technology expertise</p><ExpertisePicker kind="technology" value={filters.technology} facet={facets?.technology} onSelect={technology => change({ technology })}/></div>
            <div className="space-y-2"><p className="text-xs font-medium">Region</p><ExpertisePicker kind="region" value={filters.region} facet={facets?.region} onSelect={region => change({ region })}/></div>
            <Button ref={resetButton} variant="secondary" className="w-full" onClick={() => change({ technology: [], region: [] })}>Reset these filters</Button>
            {hasFilters(filters) && <Button variant="ghost" className="w-full" onClick={() => {
              change(EMPTY_FILTERS);
              // Clear all disappears after reset; keep keyboard focus in the panel.
              resetButton.current?.focus();
            }}>Clear all</Button>}
          </div></PopoverContent>
        </Popover>}
    </div>
    {mobile && <div className="mobile-filter-actions">
      <Popover><PopoverTrigger asChild><Button variant="outline" className="more-filters" aria-label="More filters"><SlidersHorizontal size={14}/><span>Filters</span>{extraCount > 0 && <span className="filter-number">{extraCount}</span>}</Button></PopoverTrigger>
        <PopoverContent className="more-filter-options w-80" align="end"><div className="space-y-4"><div><h3 className="font-semibold">Refine your discovery</h3><p className="mt-1 text-xs text-muted-foreground">Match any selection within a filter.</p></div>
          <div className="space-y-2"><p className="text-xs font-medium">Region</p><ExpertisePicker kind="region" value={filters.region} facet={facets?.region} onSelect={region => change({ region })}/></div>
          <Button ref={resetButton} variant="secondary" className="w-full" onClick={() => change({ technology: [], region: [] })}>Reset these filters</Button>
          {hasFilters(filters) && <Button variant="ghost" className="w-full" onClick={() => {
            change(EMPTY_FILTERS);
            // Clear all disappears after reset; keep keyboard focus in the panel.
            resetButton.current?.focus();
          }}>Clear all</Button>}
        </div></PopoverContent>
      </Popover>
    </div>}
  </div>;
}
