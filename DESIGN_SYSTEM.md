# MVP Global design system

MVP Global adapts the monochrome, editorial presentation of [Microsoft Command Line](https://commandline.microsoft.com/) to a geographic directory. The atlas stays immersive; content pages use flat surfaces, clear typography, thin rules, and generous spacing.

## Foundations

The source of truth is `src/app/globals.css`. Use its semantic variables and the shared UI primitives rather than introducing page-specific colors, shadows, or corner radii.

| Foundation | Light | Dark |
| --- | --- | --- |
| Background | `#ffffff` | `#111111` |
| Raised surface | `#ffffff` | `#1a1a1a` |
| Foreground | `#000000` | `#ffffff` |
| Secondary text | `#555555` | `#999999` |
| Interactive hover | `#dbeafe` | `#0f2a4a` |
| Keyboard focus | `#237ae2` | `#237ae2` |

- Geist Variable supplies headings, names, and prose; Geist Mono Variable supplies navigation, filters, metadata, counts, and expertise. Both fonts are served locally from the installed Fontsource packages.
- Page headings step from 42px desktop to 36px tablet and 28px mobile. Profile names use 21px, metadata 13px, and About prose 17px. Small labels stay at least 11px.
- Cards are borderless and square. Controls have at most 2px rounding. Separate related sections with a thin neutral rule; avoid decorative shadows, gradients, and translucent surfaces.
- MVP blue marks hover and selection feedback, keyboard focus, and geographic data; keep the globe markers, selected boundaries, and legend consistent with the same hue.

## Layout and interaction

- Use desktop/tablet/mobile gutters of 30/24/16px and grid gaps of 30/20/20px. The responsive boundaries are 1100px and 767px, matching globe geometry.
- Content pages have a maximum width of 1440px. Above 1100px, a sticky 260px filter rail sits beside three profile columns. Tablet shows filters above two columns; mobile shows one column. About has an 800px reading column.
- Preserve the header's 80px desktop and 66px mobile heights. The explorer retains its viewport composition and a 440px desktop results panel; mobile results occupy the full screen.
- Portrait thumbnails are 56px. Names, categories, and expertise wrap rather than truncate. Failed portrait requests show initials.
- Make interactive targets at least 44px, keep mobile input text at 16px, and show a 2px blue focus outline. Keep native keyboard behavior, labels, announcements, and focus restoration intact.
- Controls transition for 150–200ms; panels transition for 250ms. Honor reduced motion and forced colors. Layouts must remain usable at 200% zoom.
- First visits use light mode. The theme toggle persists explicit choices in the existing `theme` storage key. Browser theme color follows the selected theme rather than operating-system preference.

## Adding or changing UI

Reuse `Button`, `Input`, `Popover`, `Sheet`, and other shared primitives. Apply the semantic palette in both themes, use the existing filter and results components, and retain URL-driven filters and browser history. Give loading, empty, retry, and unavailable states the same typography and surfaces as loaded content.

## MVP profile pages

The profile ID card is a deliberate exception to the flat, square directory cards: a centered, dark metallic surface up to 640px wide, with 24px corners and restrained cyan/violet/gold foil. It stays dark in either theme; the surrounding page, expertise, navigation, and footer use the semantic palette above. Text and portraits sit above decorative layers, and identity and award text wrap without clipping. The card footer shows “MVP ID ·” followed by the full Microsoft profile ID, matching the social preview; it remains accessible and wraps on narrow screens without truncation.

Only hover-capable fine pointers without a reduced-motion preference get pointer-driven shimmer and spring tilt (bounded to ±6°, 1000px perspective). Leaving or cancelling returns to neutral; touch and reduced-motion presentations keep the static foil. The card has no action and is not a keyboard tab stop. Forced colors removes the foil and uses system colors.

The holographic material combines two opposing, independently translating/scaling radial gradients, a pointer-following soft-light highlight, and a static procedural crosshatch texture. These are original CSS gradients, not copied image assets. The existing Motion springs drive only transforms and opacity; there are no looping or entrance animations, added dependencies, SVG lighting filters, or flip controls. A clipped, isolated decorative group sits below all text and photos, retaining the same neutral material in static modes.

A repeating MVP watermark reuses the existing logo through Next's image optimizer at tile resolution. A luminance mask (the source is opaque, not a transparent silhouette) reveals a cyan/violet/gold gradient through the diamond and subdues its blue field and lettering. Screen blending integrates the print with the foil beneath the moving reflections. The mask stays fixed while its opacity follows the existing light spring (18% at rest, 30% on hover). Tiles are 88px on desktop and 72px on narrow screens; touch/reduced motion retains the quiet resting print, and forced colors hides it with the other decoration. No reference artwork or additional logo assets are used.

Local profile URLs use the published Microsoft ID. Result names and “View profile” carry the URL filters and page; “Back to directory” preserves them. The external Microsoft link lives below the profile card. Profile content and metadata are generated on first request and cached for the snapshot's deployment, while query-dependent navigation hydrates separately.

Shared profile links have ID-based canonical URLs and Open Graph/Twitter large-image metadata. Their 1200×630 static previews echo the dark card palette, showing the portrait (or initials), full name, country, all award categories, and Microsoft profile ID. Previews are generated server-side and cached independently; they contain no motion or directory filters. `SITE_URL` configures the public origin outside Vercel.

Before shipping a visual change, run the existing unit, type, lint, production-build, and Playwright checks. Review 320, 390, 768, 1100, and 1440px widths in both themes, including open filters and results panels. Check long names and expertise, missing photos, empty results, failed data loads, unavailable WebGL, keyboard access, theme persistence, and no horizontal overflow. Accessibility audits must have no serious or critical violations.
