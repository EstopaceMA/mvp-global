"use client";

import Image, { getImageProps } from "next/image";
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import { MapPin } from "lucide-react";
import { ProfilePortrait } from "@/components/profile-portrait";
import { useMedia } from "@/hooks/use-media";
import { countryById } from "@/lib/catalog";
import type { MvpProfile } from "@/lib/types";

const spring = { stiffness: 180, damping: 30, mass: 1, restDelta: 0.001 };
const cardWidth = 640;
const cardHeight = 400;
// Reuse the official artwork at tile resolution, not its 4268px source size.
const watermarkImage = getImageProps({ src: "/mvp-logo.png", alt: "", width: 88, height: 88 }).props.src;

export function MvpIdCard({ profile }: { profile: MvpProfile }) {
    // Reset springs and photo failure state even when a client navigation reuses this component.
    return <InteractiveIdCard key={profile.id} profile={profile} />;
}

function InteractiveIdCard({ profile }: { profile: MvpProfile }) {
    const stage = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLDivElement>(null);
    const name = useRef<HTMLHeadingElement>(null);
    const interactive = useMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const x = useSpring(0, spring);
    const y = useSpring(0, spring);
    const light = useSpring(0, spring);
    // The output mappings clamp too, so spring momentum can never exceed ±6°.
    const rotateX = useTransform(y, [-1, 1], [6, -6]);
    const rotateY = useTransform(x, [-1, 1], [-6, 6]);
    // Separate corner reflections expand and travel in opposite directions.
    // Only transforms and opacity change per frame; the CSS gradients stay rasterized.
    const nearX = useTransform(x, [-1, 1], ["-14%", "14%"]);
    const nearY = useTransform(y, [-1, 1], ["-10%", "10%"]);
    const nearScale = useTransform(x, [-1, 1], [0.82, 1.18]);
    const farX = useTransform(x, [-1, 1], ["16%", "-16%"]);
    const farY = useTransform(y, [-1, 1], ["12%", "-12%"]);
    const farScale = useTransform(x, [-1, 1], [1.16, 0.84]);
    // A 160%-size light moves 31.25% of itself to reach either card edge.
    const spotlightX = useTransform(x, [-1, 1], ["-31.25%", "31.25%"]);
    const spotlightY = useTransform(y, [-1, 1], ["-31.25%", "31.25%"]);
    const nearOpacity = useTransform(light, [0, 1], [0.28, 0.55]);
    const farOpacity = useTransform(light, [0, 1], [0.22, 0.45]);
    const spotlightOpacity = useTransform(light, [0, 1], [0.14, 0.5]);
    const watermarkOpacity = useTransform(light, [0, 1], [0.18, 0.3]);

    useLayoutEffect(() => {
        const container = stage.current, surface = canvas.current, heading = name.current;
        if (!container || !surface || !heading) return;
        let active = true;
        const resize = () => {
            surface.style.setProperty("--mvp-id-measured-scale", String(container.getBoundingClientRect().width / cardWidth));
        };
        // Fit the full name once in design coordinates, never to the viewport.
        // Its fixed-height slot keeps the country and awards anchored below it.
        const fitName = () => {
            if (!active) return;
            const text = heading.firstElementChild as HTMLSpanElement;
            heading.style.fontSize = "36px";
            const size = Math.min(36, 36 * (heading.clientWidth - 2) / Math.max(1, text.offsetWidth));
            heading.style.fontSize = `${size}px`;
        };
        resize();
        fitName();
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        void document.fonts.ready.then(fitName);
        document.fonts.addEventListener("loadingdone", fitName);
        return () => {
            active = false;
            observer.disconnect();
            document.fonts.removeEventListener("loadingdone", fitName);
        };
    }, []);

    useEffect(() => {
        if (!interactive) { x.jump(0); y.jump(0); light.jump(0); }
    }, [interactive, x, y, light]);

    const reset = () => { x.set(0); y.set(0); light.set(0); };
    const move = (event: PointerEvent<HTMLDivElement>) => {
        if (!interactive || event.pointerType === "touch") return;
        // Measure the untransformed stage, not the tilting card: no feedback-loop jitter.
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const normalize = (value: number) => Math.max(-1, Math.min(1, value * 2 - 1));
        x.set(normalize((event.clientX - bounds.left) / bounds.width));
        y.set(normalize((event.clientY - bounds.top) / bounds.height));
        light.set(1);
    };

    return <div ref={stage} className="mvp-id-stage" style={{
        "--mvp-id-width": `${cardWidth}px`, "--mvp-id-height": `${cardHeight}px`, aspectRatio: `${cardWidth} / ${cardHeight}`,
    } as CSSProperties} onPointerEnter={move} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
        <div ref={canvas} className="mvp-id-canvas">
            <motion.article className="mvp-id-card" aria-labelledby="mvp-name" data-interactive={interactive}
                style={{ rotateX: interactive ? rotateX : 0, rotateY: interactive ? rotateY : 0 }}>
                <div className="mvp-id-material" aria-hidden="true">
                    <div className="mvp-id-foil" />
                    <motion.div className="mvp-id-watermark" style={{
                        maskImage: `url("${watermarkImage}")`, opacity: interactive ? watermarkOpacity : 0.18,
                    }} />
                    <motion.div className="mvp-id-refraction mvp-id-refraction--near" style={{
                        x: interactive ? nearX : "0%", y: interactive ? nearY : "0%", scale: interactive ? nearScale : 1, opacity: interactive ? nearOpacity : 0.28,
                    }} />
                    <motion.div className="mvp-id-refraction mvp-id-refraction--far" style={{
                        x: interactive ? farX : "0%", y: interactive ? farY : "0%", scale: interactive ? farScale : 1, opacity: interactive ? farOpacity : 0.22,
                    }} />
                    <motion.div className="mvp-id-spotlight" style={{
                        x: interactive ? spotlightX : "0%", y: interactive ? spotlightY : "0%", opacity: interactive ? spotlightOpacity : 0.14,
                    }} />
                    <div className="mvp-id-texture" />
                </div>
                <div className="mvp-id-content">
                    <div className="mvp-id-brand"><Image src="/mvp-logo.png" alt="" width={44} height={44} sizes="44px" /><p>Microsoft MVP<span>Most Valuable Professional</span></p></div>
                    <div className="mvp-id-identity">
                        <ProfilePortrait profile={profile} className="mvp-id-portrait" sizes="144px" eager />
                        <div className="mvp-id-details"><h1 ref={name} id="mvp-name" style={{ fontSize: `${Math.min(36, 400 / Math.max(1, [...profile.name].length))}px` }}><span>{profile.name}</span></h1><p className="mvp-id-country"><MapPin size={14} aria-hidden="true" />{countryById.get(profile.countryId)?.name ?? "Country not listed"}</p></div>
                        <div className="mvp-id-awards"><h2>Award categories</h2><ul>{profile.awardCategories.map(category => <li key={category}>{category}</li>)}</ul></div>
                    </div>
                    <div className="mvp-id-bottom"><span aria-hidden="true">MVP GLOBAL</span><span className="mvp-id-number">MVP ID · {profile.id}</span></div>
                </div>
            </motion.article>
        </div>
    </div>;
}