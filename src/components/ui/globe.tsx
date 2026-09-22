"use client";

// Magic UI Globe (https://magicui.design/docs/components/globe), adapted for the atlas.
// Preserve COBE's dotted rendering; add focus, direct manipulation, zoom, and lifecycle handling.
import { useCallback, useEffect, useImperativeHandle, useRef, type CSSProperties, type PointerEvent, type ReactNode, type Ref } from "react";
import createGlobe, { type COBEOptions } from "cobe";
import { animate, useMotionValue, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { cobeViewport, focusAngles, nearestAngle, type GlobeFrame, type GlobeLayout } from "@/lib/globe-geometry";

const INITIAL = focusAngles(20, 10);
const clampScale = (value: number) => Math.max(0.7, Math.min(2.5, value));
const clampTheta = (value: number) => Math.max(-1.48, Math.min(1.48, value));
const GLOBE_CONFIG: COBEOptions = {
  width: 800, height: 800, onRender: () => {}, devicePixelRatio: 2,
  ...INITIAL, dark: 0, diffuse: 0.4, mapSamples: 16000, mapBrightness: 1.2, mapBaseBrightness: 0,
  baseColor: [1, 1, 1], markerColor: [251 / 255, 100 / 255, 21 / 255],
  glowColor: [1, 1, 1], markers: [],
};

export interface GlobeHandle { focus(lat: number, lng: number): void; zoom(factor: number): void; reset(): void }
interface GlobeProps {
  layout: GlobeLayout;
  ref?: Ref<GlobeHandle>;
  className?: string;
  style?: CSSProperties;
  config?: Partial<COBEOptions>;
  reducedMotion?: boolean;
  children?: ReactNode;
  onFrame?(frame: GlobeFrame): void;
  onPick?(x: number, y: number, frame: GlobeFrame): void;
  onHover?(x: number, y: number, frame: GlobeFrame): boolean;
  onLeave?(): void;
  onReady?(): void;
  onFailure?(): void;
}

export function Globe({ ref, className, style, children, ...options }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });
  const phi = useMotionValue(INITIAL.phi);
  const theta = useMotionValue(INITIAL.theta);
  const scale = useMotionValue(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ distance: 0, moved: false, lastTime: 0, vx: 0, vy: 0 });
  const size = useRef({ width: 0, height: 0 });
  const getFrame = useCallback((): GlobeFrame => ({
    ...size.current, ...latest.current.layout,
    radius: latest.current.layout.radius * scale.get(),
    phi: phi.get(), theta: theta.get(), scale: scale.get(),
  }), [phi, theta, scale]);
  const move = (value: MotionValue<number>, target: number, velocity?: number) => {
    if (latest.current.reducedMotion) { value.stop(); value.set(target); }
    else animate(value, target, { type: "spring", stiffness: 170, damping: 26, restDelta: 0.0001, ...(velocity === undefined ? {} : { velocity }) });
  };
  useImperativeHandle(ref, () => ({
    focus(lat, lng) {
      const target = focusAngles(lat, lng);
      move(phi, nearestAngle(target.phi, phi.get()));
      move(theta, clampTheta(target.theta));
      move(scale, 1.12);
    },
    zoom(factor) { move(scale, clampScale(scale.get() * factor)); },
    reset() { move(phi, nearestAngle(INITIAL.phi, phi.get())); move(theta, INITIAL.theta); move(scale, 1); },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    let globe: ReturnType<typeof createGlobe> | undefined;
    let readyFrame = 0;
    const resize = () => {
      size.current = { width: canvas.clientWidth, height: canvas.clientHeight };
      globe?.resize();
    };
    resize();
    const ratio = Math.min(window.devicePixelRatio, 2);
    const lost = (event: Event) => { event.preventDefault(); latest.current.onFailure?.(); };
    const visibility = () => globe?.toggle(!document.hidden);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? latest.current.layout.radius / 0.4 : 1);
      const target = clampScale(scale.get() * Math.exp(-delta * 0.0015));
      scale.stop(); scale.set(target);
    };
    const observer = new ResizeObserver(resize);
    try {
      globe = createGlobe(canvas, {
        ...GLOBE_CONFIG, ...latest.current.config, devicePixelRatio: ratio,
        ...cobeViewport(getFrame(), ratio),
        onRender(state) {
          const frame = getFrame();
          Object.assign(state, latest.current.config, { phi: frame.phi, theta: frame.theta }, cobeViewport(frame, ratio));
          latest.current.onFrame?.(frame);
        },
      });
      if (globe.gl.isContextLost() || [...globe.instances.values()].some(instance => !globe!.gl.getProgramParameter(instance.program, globe!.gl.LINK_STATUS))) throw new Error("Globe initialization failed");
      observer.observe(canvas);
      canvas.addEventListener("webglcontextlost", lost);
      canvas.addEventListener("wheel", wheel, { passive: false });
      document.addEventListener("visibilitychange", visibility);
      visibility();
      readyFrame = requestAnimationFrame(() => { canvas.style.opacity = "1"; latest.current.onReady?.(); });
    } catch { globe?.destroy(); globe = undefined; latest.current.onFailure?.(); }
    return () => {
      cancelAnimationFrame(readyFrame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("wheel", wheel);
      document.removeEventListener("visibilitychange", visibility);
      phi.stop(); theta.stop(); scale.stop();
      globe?.destroy();
    };
  }, [phi, theta, scale, getFrame]);

  const local = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    phi.stop(); theta.stop(); scale.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) gesture.current = { distance: 0, moved: false, lastTime: event.timeStamp, vx: 0, vy: 0 };
    else { gesture.current.moved = true; gesture.current.vx = 0; gesture.current.vy = 0; }
    event.currentTarget.style.cursor = "grabbing";
    latest.current.onLeave?.();
  };
  const drag = (event: PointerEvent<HTMLCanvasElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) {
      const point = local(event);
      const selectable = latest.current.onHover?.(point.x, point.y, getFrame());
      event.currentTarget.style.cursor = selectable ? "pointer" : "grab";
      event.currentTarget.classList.toggle("clickable", !!selectable);
      return;
    }
    const next = { x: event.clientX, y: event.clientY };
    const dx = next.x - previous.x, dy = next.y - previous.y;
    const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
      const distance = Math.hypot(next.x - other.x, next.y - other.y);
      if (oldDistance > 10) scale.set(clampScale(scale.get() * distance / oldDistance));
    } else {
      const sensitivity = Math.max(130, latest.current.layout.radius * 0.75) * scale.get();
      phi.set(phi.get() + dx / sensitivity);
      theta.set(clampTheta(theta.get() + dy / sensitivity));
      const dt = Math.max(1, event.timeStamp - gesture.current.lastTime) / 1000;
      gesture.current.vx = dx / sensitivity / dt;
      gesture.current.vy = dy / sensitivity / dt;
    }
    gesture.current.distance += Math.hypot(dx, dy);
    gesture.current.moved ||= gesture.current.distance > 6;
    gesture.current.lastTime = event.timeStamp;
    pointers.current.set(event.pointerId, next);
  };
  const up = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size) return;
    event.currentTarget.style.cursor = "grab";
    if (event.type === "pointercancel") return;
    if (!gesture.current.moved) {
      const point = local(event);
      latest.current.onPick?.(point.x, point.y, getFrame());
    } else if (!latest.current.reducedMotion && event.timeStamp - gesture.current.lastTime < 100) {
      const vx = Math.max(-4, Math.min(4, gesture.current.vx));
      const vy = Math.max(-3, Math.min(3, gesture.current.vy));
      move(phi, phi.get() + vx * 0.12, vx);
      move(theta, clampTheta(theta.get() + vy * 0.12), vy);
    }
  };
  return <div className={cn("absolute inset-0", className)} style={style}>
    <canvas ref={canvasRef} aria-hidden="true" className="magic-globe-canvas size-full opacity-0 transition-opacity duration-300 contain-[layout_paint_size]" style={{ cursor: "grab", touchAction: "none" }}
      onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={up}
      onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
      onPointerLeave={() => { if (!pointers.current.size) latest.current.onLeave?.(); }}/>
    {children}
  </div>;
}
