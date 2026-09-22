# Map data

- Geometry: World Atlas 2, `countries-110m.json`, https://github.com/topojson/world-atlas (ISC distribution license).
- Underlying country boundaries: Natural Earth, public domain, https://www.naturalearthdata.com/about/terms-of-use/.
- Country/region metadata and label coordinates: Natural Earth `ne_50m_admin_0_countries.geojson`, https://github.com/nvkelso/natural-earth-vector.

The local topology keeps the original geometry, with application country identifiers and display labels added. The country table preserves the scraper's labels for covered locations. Labels and coordinates are discovery aids. Smaller territories absent from the simplified boundaries are represented with selectable markers and country-picker entries.
