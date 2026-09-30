import { readFile } from "node:fs/promises";
import { join } from "node:path";
import geist from "@fontsource/geist/unicode.json";
import japanese from "@fontsource/noto-sans-jp/unicode.json";
import korean from "@fontsource/noto-sans-kr/unicode.json";
import chinese from "@fontsource/noto-sans-sc/unicode.json";

const families = [
    { font: "geist", ranges: geist },
    { font: "noto-sans-jp", ranges: japanese },
    { font: "noto-sans-kr", ranges: korean },
    { font: "noto-sans-sc", ranges: chinese },
].map(({ font, ranges }) => ({
    font, subsets: Object.entries(ranges).map(([subset, range]) => ({
        subset: subset.replace(/[\[\]]/g, ""),
        ranges: range.split(",").map(value => {
            const [first, last = first] = value.trim().slice(2).split("-");
            return [parseInt(first, 16), parseInt(last, 16)];
        }),
    })),
}));

// Fontsource's Unicode manifests select small, local WOFF fragments. No runtime
// font service, and no loading an entire CJK font for a two-character name.
export function selectPreviewFonts(text: string) {
    const missing = new Set([...text].map(character => character.codePointAt(0)!));
    const selected: { font: string; subset: string }[] = [];
    for (const { font, subsets } of families) {
        for (const { subset, ranges } of subsets) {
            const covered = [...missing].filter(code => ranges.some(([start, end]) => code >= start && code <= end));
            if (!covered.length) continue;
            selected.push({ font, subset });
            covered.forEach(code => missing.delete(code));
        }
    }
    return { selected, missing: [...missing] };
}

const buffers = new Map<string, Promise<Buffer>>();
export async function loadPreviewFonts(text: string) {
    const { selected, missing } = selectPreviewFonts(text);
    if (missing.length) throw new Error(`Unsupported preview glyphs: ${missing.map(code => code.toString(16)).join(", ")}`);
    return Promise.all(selected.flatMap(({ font, subset }) => (font === "geist" ? [400, 700] as const : [400] as const).map(async weight => {
        const name = `${font}-${subset}`;
        const file = join(process.cwd(), `node_modules/@fontsource/${font}/files/${name}-${weight}-normal.woff`);
        let data = buffers.get(file);
        if (!data) { data = readFile(file); buffers.set(file, data); }
        return { name, data: await data, weight, style: "normal" as const };
    })));
}