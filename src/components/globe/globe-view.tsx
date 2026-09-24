"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { COBEOptions } from "cobe";
import { geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { useTheme } from "next-themes";
import { Minus, Plus, RotateCcw, Navigation2 } from "lucide-react";
import { Globe, type GlobeHandle } from "@/components/ui/globe";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { countries, countryById, formatCount, manifest } from "@/lib/catalog";
import { useMedia } from "@/hooks/use-media";
import { countryAtPoint, projectLocation, unprojectLocation, type CountryFeature, type GlobeFrame } from "@/lib/globe-geometry";

export interface GlobeViewProps {
  counts: Record<string, number>;
  countsPending?: boolean;
  selected: string[];
  sheetOpen: boolean;
  onSelect(slug: string): void;
  onInteract?(): void;
  onFailure(): void;
}

export default function GlobeView({ counts, countsPending = false, selected, sheetOpen, onSelect, onInteract, onFailure }: GlobeViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeHandle>(null);
  const clickAudio = useRef<HTMLAudioElement>(null);
  const markerElements = useRef(new Map<string, SVGGElement>());
  const selectionPath = useRef<SVGPathElement>(null);
  const hoverPath = useRef<SVGPathElement>(null);
  const hoverTip = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [polygons, setPolygons] = useState<CountryFeature[]>([]);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const mobile = useMedia("(max-width: 767px)");
  const country = countries.find(entry => entry.slug === selected.at(-1));
  const hoveredCountry = hovered ? countryById.get(hovered) : undefined;
  const markers = useMemo(() => countries.filter(entry => counts[entry.id] || selected.includes(entry.slug)), [counts, selected]);
  const labels = useMemo(() => new Set([...markers].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0)).slice(0, mobile ? 4 : 7).map(entry => entry.id)), [markers, counts, mobile]);
  const maximum = Math.max(1, ...Object.values(counts));
  const config = useMemo<Partial<COBEOptions>>(() => ({
    dark: dark ? 1 : 0, diffuse: 0.4, mapSamples: mobile ? 18000 : 24000,
    mapBrightness: dark ? 5 : 1.2,
    baseColor: dark ? [0.42, 0.55, 0.78] : [0.92, 0.95, 1],
    glowColor: dark ? [0.025, 0.075, 0.16] : [0.75, 0.81, 0.9],
    // All 105 country markers live in the projected overlay, avoiding COBE 0.6's 64-marker limit.
    markers: [],
  }), [dark, mobile]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/geo/countries.topo.json", { signal: abort.signal }).then(response => {
      if (!response.ok) throw new Error("Map data unavailable");
      return response.json();
    }).then((topology: Topology<{ countries: GeometryCollection }>) => {
      setPolygons(feature(topology, topology.objects.countries).features as CountryFeature[]);
    }).catch(error => { if (error.name !== "AbortError") onFailure(); });
    return () => abort.abort();
  }, [onFailure]);
  useEffect(() => {
    if (!ready) return;
    if (country) globe.current?.focus(country.lat, country.lng);
    else globe.current?.reset();
  }, [country, ready]);
  useEffect(() => {
    if (ready) return;
    const timeout = window.setTimeout(onFailure, 20000);
    return () => window.clearTimeout(timeout);
  }, [ready, onFailure]);

  const renderFrame = useCallback((frame: GlobeFrame) => {
    const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
    const priority = [...markers].sort((a, b) => Number(selected.includes(b.slug)) - Number(selected.includes(a.slug)) || (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
    for (const entry of priority) {
      const element = markerElements.current.get(entry.id);
      if (!element) continue;
      const position = projectLocation(entry.lat, entry.lng, frame);
      element.setAttribute("transform", "translate(" + position.x + " " + position.y + ")");
      element.style.display = position.visible ? "" : "none";
      const label = element.querySelector<SVGGElement>("[data-marker-label]");
      if (label && position.visible) {
        const width = Number(label.dataset.width);
        const offset = Number(label.dataset.offset);
        const box = { left: position.x - width / 2 - 3, right: position.x + width / 2 + 3, top: position.y + offset - 12, bottom: position.y + offset + 14 };
        const overlaps = occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
        label.style.visibility = overlaps ? "hidden" : "visible";
        if (!overlaps) occupied.push(box);
      }
    }
    const projection = geoOrthographic()
      .rotate([frame.phi * 180 / Math.PI + 90, -frame.theta * 180 / Math.PI])
      .translate([frame.centerX, frame.centerY])
      .scale(frame.radius);
    const path = geoPath(projection);
    const selectedIds = new Set(countries.filter(entry => selected.includes(entry.slug)).map(entry => entry.id));
    const selectedFeatures = polygons.filter(entry => selectedIds.has(entry.properties.countryId));
    const hoveredFeature = polygons.find(entry => entry.properties.countryId === hovered);
    selectionPath.current?.setAttribute("d", selectedFeatures.map(feature => path(feature) ?? "").join(" "));
    hoverPath.current?.setAttribute("d", hoveredFeature ? path(hoveredFeature) ?? "" : "");
    if (host.current) host.current.dataset.scale = frame.scale.toFixed(3);
  }, [markers, selected, counts, hovered, polygons]);

  const hitTest = (x: number, y: number, frame: GlobeFrame) => {
    let nearest: string | undefined;
    let distance = mobile ? 18 : 13;
    for (const entry of markers) {
      const point = projectLocation(entry.lat, entry.lng, frame);
      const delta = Math.hypot(point.x - x, point.y - y);
      if (point.visible && delta < distance) { distance = delta; nearest = entry.id; }
    }
    if (nearest) return nearest;
    const point = unprojectLocation(x, y, frame);
    return point ? countryAtPoint(polygons, point) : undefined;
  };
  const tablet = !mobile && size.width <= 1100;
  const availableWidth = mobile ? size.width : sheetOpen ? Math.max(260, size.width - 440) : tablet ? size.width - 280 : size.width;
  const mobileGlobeTop = size.width <= 370 ? 330 : 250;
  const mobileGlobeBottom = size.height - 160;
  const side = mobile
    ? Math.max(0, Math.min(availableWidth * 1.05, (mobileGlobeBottom - mobileGlobeTop) / 0.8))
    : Math.min(size.height * 0.95, availableWidth * (sheetOpen ? 1.25 : tablet ? 1.1 : 0.85));
  const centerX = mobile ? size.width / 2 : sheetOpen ? availableWidth / 2 : tablet ? (size.width + 280) / 2 : size.width * 0.59;
  const centerY = mobile ? (mobileGlobeTop + mobileGlobeBottom) / 2 : size.height / 2 + 5;
  const hoverCount = hovered ? counts[hovered] ?? 0 : 0;

  return <div ref={host} className="globe-host" data-testid="globe-container" data-renderer="magic-ui-cobe" data-ready={ready} onPointerDownCapture={() => onInteract?.()}>
    <audio ref={clickAudio} src="/click-effect.mp3" preload="auto" />
    {side > 0 && polygons.length > 0 && <Globe ref={globe} className="globe-renderer" layout={{ centerX, centerY, radius: side * 0.4 }}
      config={config} reducedMotion={reducedMotion} onReady={() => setReady(true)} onFailure={onFailure} onFrame={renderFrame}
      onPick={(x, y, frame) => {
        const id = hitTest(x, y, frame);
        const entry = id ? countryById.get(id) : undefined;
        if (!entry) return;
        onInteract?.();
        const audio = clickAudio.current;
        if (audio) {
          audio.currentTime = 0;
          void audio.play().catch(() => { /* Country selection still works if playback is unavailable. */ });
        }
        onSelect(entry.slug);
      }}
      onHover={(x, y, frame) => {
        const id = hitTest(x, y, frame);
        setHovered(id ?? null);
        if (hoverTip.current) { hoverTip.current.style.left = Math.max(8, Math.min(frame.width - 195, x + 16)) + "px"; hoverTip.current.style.top = Math.max(8, y - 56) + "px"; }
        return !!id;
      }}
      onLeave={() => setHovered(null)}>
      <svg className="globe-marker-layer" width={size.width} height={size.height} aria-hidden="true">
        <path ref={hoverPath} className="globe-country-hover"/>
        <path ref={selectionPath} className="globe-country-selected"/>
        {markers.map(entry => {
          const count = counts[entry.id] ?? 0;
          const intensity = Math.log1p(count) / Math.log1p(maximum);
          const radius = 3 + intensity * 4;
          const chosen = selected.includes(entry.slug);
          const color = dark ? "hsl(213 95% " + (48 + intensity * 32) + "%)" : "hsl(213 85% " + (52 - intensity * 20) + "%)";
          const countLabel = countsPending ? "—" : formatCount(count);
          const label = chosen ? entry.name + " · " + countLabel : countLabel;
          return <g key={entry.id} data-country-marker={entry.slug} ref={element => { if (element) markerElements.current.set(entry.id, element); else markerElements.current.delete(entry.id); }} style={{ display: "none" }}>
            <circle r={radius + 5} fill={color} fillOpacity={chosen ? 0.22 : 0.1}/>
            {chosen && <circle r={radius + 7} className="globe-marker-ring"/>}
            <circle r={radius} fill={color} stroke={dark ? "#dcecff" : "#ffffff"} strokeWidth={chosen ? 2 : 0.7}/>
            {(chosen || labels.has(entry.id)) && <g data-marker-label data-width={label.length * 6.8 + 14} data-offset={-radius - 12} transform={"translate(0 " + (-radius - 12) + ")"}>
              <rect x={-label.length * 3.4 - 7} y={-9} width={label.length * 6.8 + 14} height={20} rx={6} className="globe-marker-label-bg"/>
              <text textAnchor="middle" dominantBaseline="middle" className="globe-marker-label">{label}</text>
            </g>}
          </g>;
        })}
      </svg>
      <div ref={hoverTip} className="globe-country-tooltip" aria-hidden="true" hidden={!hoveredCountry}><strong>{hoveredCountry?.name}</strong><span>{countsPending ? "Matching counts unavailable" : hoverCount ? formatCount(hoverCount) + " matching MVPs" : hoveredCountry && manifest.counts[hoveredCountry.id] ? "No matching MVPs" : "No profiles in this snapshot"}</span></div>
    </Globe>}
    {!ready && <div className="globe-loading" role="status"><div className="loading-orbit"/><span>Bringing the world closer…</span></div>}
    <div className="globe-controls" aria-label="Globe controls">
      <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="Reset globe view" onClick={() => { onInteract?.(); globe.current?.reset(); }}><Navigation2 size={16}/></Button></TooltipTrigger><TooltipContent side="left">Reset view · North up</TooltipContent></Tooltip>
      <div className="zoom-buttons"><Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => { onInteract?.(); globe.current?.zoom(1.2); }}><Plus size={18}/></Button><span/><Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => { onInteract?.(); globe.current?.zoom(1 / 1.2); }}><Minus size={18}/></Button></div>
      <Button variant="ghost" size="icon" aria-label="Recenter globe" onClick={() => { onInteract?.(); globe.current?.reset(); }}><RotateCcw size={15}/></Button>
    </div>
  </div>;
}
