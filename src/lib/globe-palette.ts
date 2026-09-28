type RGB = readonly [number, number, number];

/** Geographic data keeps its blue accent against the neutral application shell. */
const GEOGRAPHIC_BLUE: RGB = [35, 122, 226];
const RAMPS = {
  light: [GEOGRAPHIC_BLUE, [22, 75, 138]],
  dark: [GEOGRAPHIC_BLUE, [167, 209, 255]],
} satisfies Record<"light" | "dark", readonly [RGB, RGB]>;

const cssColor = (color: RGB) => `rgb(${color.join(" ")})`;

/** The legend and markers use the same sRGB endpoints and interpolation. */
export const GLOBE_LEGEND_GRADIENTS = {
  light: `linear-gradient(to right in srgb, ${RAMPS.light.map(cssColor).join(", ")})`,
  dark: `linear-gradient(to right in srgb, ${RAMPS.dark.map(cssColor).join(", ")})`,
};

export function globeMarkerColor(intensity: number, dark: boolean) {
  const [start, end] = RAMPS[dark ? "dark" : "light"];
  const position = Math.max(0, Math.min(1, intensity));
  const channel = (index: number) => Math.round(start[index] + (end[index] - start[index]) * position);
  return cssColor([channel(0), channel(1), channel(2)]);
}

export const GLOBE_MARKER_COLOR: [number, number, number] = GEOGRAPHIC_BLUE.map(channel => channel / 255) as [number, number, number];
