"use client";

import Image, { getImageProps } from "next/image";
import { useEffect, type PointerEvent } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import { MapPin } from "lucide-react";
import { ProfilePortrait } from "@/components/profile-portrait";
import { useMedia } from "@/hooks/use-media";
import { countryById } from "@/lib/catalog";
import type { MvpProfile } from "@/lib/types";

const spring = { stiffness: 180, damping: 30, mass: 1, restDelta: 0.001 };
// Reuse the official artwork at tile resolution, not its 4268px source size.
const watermarkImage = getImageProps({ src: "/mvp-logo.png", alt: "", width: 88, height: 88 }).props.src;

export function MvpIdCard({ profile }: { profile: MvpProfile }) {
    // Reset springs and photo failure state even when a client navigation reuses this component.
    return <InteractiveIdCard key={profile.id} profile={profile} />;
}

function InteractiveIdCard({ profile }: { profile: MvpProfile }) {
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

    return <div className="mvp-id-stage" onPointerEnter={move} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
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
                    <ProfilePortrait profile={profile} className="mvp-id-portrait" sizes="(max-width: 540px) 104px, 144px" eager />
                    <div className="mvp-id-details"><h1 id="mvp-name">{profile.name}</h1><p className="mvp-id-country"><MapPin size={14} aria-hidden="true" />{countryById.get(profile.countryId)?.name ?? "Country not listed"}</p>
                        <div className="mvp-id-awards"><h2>Award categories</h2><ul>{profile.awardCategories.map(category => <li key={category}>{category}</li>)}</ul></div>
                    </div>
                </div>
                <div className="mvp-id-bottom" aria-hidden="true"><span>MVP GLOBAL</span><span>THE COMMUNITY ATLAS</span></div>
            </div>
        </motion.article>
    </div>;
}