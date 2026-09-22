"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import type { GlobeViewProps } from "./globe-view";

const GlobeView = dynamic(() => import("./globe-view"), { ssr: false, loading: () => <div className="globe-loading" role="status"><div className="loading-orbit"/><span>Loading the globe…</span></div> });
class GlobeBoundary extends Component<{ children: ReactNode; onFailure(): void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
export function GlobeClient(props: GlobeViewProps) {
  const [capable, setCapable] = useState(false);
  const { onFailure } = props;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!context) return onFailure();
        context.getExtension("WEBGL_lose_context")?.loseContext();
        setCapable(true);
      } catch { onFailure(); }
    });
    return () => cancelAnimationFrame(frame);
  }, [onFailure]);
  return capable ? <GlobeBoundary onFailure={props.onFailure}><GlobeView {...props}/></GlobeBoundary> : <div className="globe-loading" role="status"><div className="loading-orbit"/><span>Preparing your atlas…</span></div>;
}
