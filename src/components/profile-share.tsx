"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProfileShareData } from "@/lib/profile-share";

export function ProfileShare({ url, links }: ProfileShareData) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle");
    const copyRequest = useRef(0);
    const firstLink = useRef<HTMLAnchorElement>(null);
    const manualLink = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (copyState === "error") {
            manualLink.current?.focus();
            manualLink.current?.select();
        }
    }, [copyState]);

    function changeOpen(next: boolean) {
        copyRequest.current++;
        setCopyState("idle");
        setOpen(next);
    }

    async function copyLink() {
        if (copyState === "copying") return;
        const request = ++copyRequest.current;
        setCopyState("copying");
        try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
            await navigator.clipboard.writeText(url);
            if (request === copyRequest.current) setCopyState("copied");
        } catch {
            if (request === copyRequest.current) setCopyState("error");
        }
    }

    return <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
            <Button variant="outline" aria-label="Share profile"><Share2 aria-hidden="true" />Share</Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="mvp-share-options" aria-labelledby={`${id}-title`} onOpenAutoFocus={event => {
            event.preventDefault();
            firstLink.current?.focus();
        }}>
            <h2 id={`${id}-title`} className="mvp-share-title">Share profile</h2>
            {links.map(({ platform, href }, index) => <Button key={platform} asChild variant="ghost" className="mvp-share-option">
                <a ref={index === 0 ? firstLink : undefined} href={href} target="_blank" rel="noopener noreferrer" onClick={() => changeOpen(false)}>
                    {platform}<ArrowUpRight aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
                </a>
            </Button>)}
            <div className="mvp-share-copy">
                <Button variant="ghost" className="mvp-share-option" onClick={copyLink} aria-disabled={copyState === "copying"}>
                    {copyState === "copied" ? "Copied" : copyState === "copying" ? "Copying…" : "Copy link"}
                    {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </Button>
                <p role="status" className={copyState === "copied" || copyState === "error" ? "mvp-share-status" : "sr-only"}>
                    {copyState === "copied" ? "Link copied." : copyState === "error" ? "Couldn't copy automatically. Select and copy the link below." : ""}
                </p>
                {copyState === "error" && <div className="mvp-share-manual">
                    <label htmlFor={`${id}-url`}>Profile link</label>
                    <Input ref={manualLink} id={`${id}-url`} value={url} readOnly onFocus={event => event.currentTarget.select()} />
                </div>}
            </div>
        </PopoverContent>
    </Popover>;
}