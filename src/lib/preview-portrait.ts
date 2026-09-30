import sharp from "sharp";

const maxImageBytes = 5 * 1024 * 1024;

// Only published Microsoft portraits are fetched. Never follow a redirect to an
// arbitrary host, and never make social crawlers wait indefinitely for a photo.
export async function loadPreviewPortrait(source: string | null, fetchImage: typeof fetch = fetch): Promise<string | null> {
    if (!source) return null;
    try {
        const url = new URL(source);
        if (url.origin !== "https://images.mvp.microsoft.com" || url.username || url.password) return null;
        const response = await fetchImage(source, {
            signal: AbortSignal.timeout(3000), redirect: "error", cache: "no-store",
        });
        // Microsoft's blob host also serves valid photos as application/octet-stream.
        // Decode/allowlist the actual format below; never trust the MIME type alone.
        if (!response.ok || !/^(image\/(png|jpe?g|webp|gif)|application\/octet-stream)(;|$)/i.test(response.headers.get("content-type") ?? "")) return null;
        if (Number(response.headers.get("content-length")) > maxImageBytes || !response.body) return null;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                length += value.length;
                if (length > maxImageBytes) { await reader.cancel(); return null; }
                chunks.push(value);
            }
        } finally { reader.releaseLock(); }
        const input = sharp(Buffer.concat(chunks), { limitInputPixels: 16_000_000 });
        const { format } = await input.metadata();
        if (!format || !["png", "jpeg", "webp", "gif"].includes(format)) return null;
        const image = await input.rotate().resize(240, 272, { fit: "cover" }).png().toBuffer();
        return `data:image/png;base64,${image.toString("base64")}`;
    } catch {
        // Missing, expired, timed-out, or undecodable portraits use initials.
        return null;
    }
}