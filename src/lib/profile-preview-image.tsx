/* eslint-disable @next/next/no-img-element -- ImageResponse renders HTML into PNG; next/image is not supported. */
import { ImageResponse } from "next/og";
import { join } from "node:path";
import sharp from "sharp";
import { profileInitials } from "./profile";
import { profilePreviewSize } from "./profile-metadata";
import { loadPreviewPortrait } from "./preview-portrait";
import { loadPreviewFonts } from "./preview-fonts";
import type { MvpProfile } from "./types";

let logoPromise: Promise<string> | undefined;
function loadLogo() {
    return logoPromise ??= sharp(join(process.cwd(), "public/mvp-logo.png"))
        .resize(96, 96).png().toBuffer().then(image => `data:image/png;base64,${image.toString("base64")}`);
}

export function profilePreviewElement(profile: MvpProfile, country: string, portrait: string | null, logo: string, fontFamily = "sans-serif") {
    return <div style={{
        display: "flex", width: "100%", height: "100%", padding: 34, color: "#f5f5f7", backgroundColor: "#111318",
        backgroundImage: "linear-gradient(125deg, #263c45, #181922 48%, #3d3443)", fontFamily,
    }}>
        <div style={{
            display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "34px 40px",
            border: "1px solid #78818e", borderRadius: 28, backgroundColor: "#191c24",
            backgroundImage: "linear-gradient(120deg, #24404b, #22232f 45%, #443d39 80%, #2a3544)",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <img src={logo} width={58} height={58} alt="" style={{ borderRadius: 5 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 26, fontWeight: 700 }}>Microsoft MVP</div>
                    <div style={{ fontSize: 17, color: "#c5cedb", letterSpacing: 1 }}>Most Valuable Professional</div>
                </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", flexGrow: 1, gap: 36, margin: "28px 0" }}>
                <div style={{
                    display: "flex", width: 216, height: 244, flexShrink: 0, alignItems: "center", justifyContent: "center",
                    borderRadius: 18, overflow: "hidden", border: "1px solid #647081", backgroundColor: "#263647", color: "#d8f0ff", fontSize: 76,
                }}>
                    {portrait ? <img src={portrait} width={216} height={244} alt="" style={{ objectFit: "cover" }} /> : profileInitials(profile.name)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", width: 798, flexShrink: 1 }}>
                    <div style={{ fontSize: profile.name.length > 32 ? 48 : 58, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, overflowWrap: "break-word" }}>{profile.name}</div>
                    <div style={{ fontSize: 25, color: "#d0d7e2", marginTop: 16 }}>{country}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 }}>
                        {profile.awardCategories.map(category => <div key={category} style={{ display: "flex", padding: "8px 13px", border: "1px solid #6a7280", borderRadius: 7, backgroundColor: "#20242e", fontSize: 21 }}>{category}</div>)}
                    </div>
                </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 20, borderTop: "1px solid #616773", color: "#c2cbd9" }}>
                <div style={{ fontSize: 18, letterSpacing: 3 }}>MVP GLOBAL</div>
                <div style={{ fontSize: 16 }}>{`MVP ID · ${profile.id}`}</div>
            </div>
        </div>
    </div>;
}

export async function createProfilePreview(profile: MvpProfile, country: string) {
    const text = [profile.name, profileInitials(profile.name), country, ...profile.awardCategories, profile.id,
        "Microsoft MVP Most Valuable Professional MVP GLOBAL MVP ID ·"].join(" ");
    const [portrait, logo, fonts] = await Promise.all([loadPreviewPortrait(profile.photoUrl), loadLogo(), loadPreviewFonts(text)]);
    const fontFamily = [...new Set(fonts.map(font => font.name))].join(", ");
    return new ImageResponse(profilePreviewElement(profile, country, portrait, logo, fontFamily), { ...profilePreviewSize, fonts });
}