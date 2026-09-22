import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { geoOrthographic } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { countries, manifest } from "../src/lib/catalog";
import { cobeViewport, countryAtPoint, focusAngles, nearestAngle, projectLocation, unprojectLocation, type CountryFeature } from "../src/lib/globe-geometry";

const size = { width: 800, height: 800, centerX: 400, centerY: 400, radius: 800 * 0.4 * 1.12, scale: 1.12 };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} differs from ${expected}`);

test("all 105 country markers focus at the center and round-trip to their coordinates", () => {
  for (const country of countries.filter(entry => manifest.counts[entry.id])) {
    const frame = { ...size, ...focusAngles(country.lat, country.lng) };
    const projected = projectLocation(country.lat, country.lng, frame);
    assert.ok(projected.visible);
    close(projected.x, 400); close(projected.y, 400);
    const location = unprojectLocation(projected.x, projected.y, frame)!;
    close(location[0], country.lng); close(location[1], country.lat);
    assert.equal(projectLocation(-country.lat, country.lng + 180, frame).visible, false);
  }
});

test("marker projection agrees with country outlines across rotations and zoom levels", () => {
  for (const viewport of [size, { ...size, width: 1440, height: 920, centerX: 850, centerY: 465 }, { ...size, width: 412, height: 773, centerX: 206, centerY: 432 }, { ...size, width: 768, height: 680, centerX: 164, centerY: 345 }])
  for (const scale of [0.7, 1, 2.5]) for (const [lat, lng] of [[20, 10], [-30, 170], [60, -100]]) {
    const frame = { ...viewport, radius: 320 * scale, scale, ...focusAngles(lat, lng) };
    const projection = geoOrthographic().rotate([-lng, -lat]).translate([frame.centerX, frame.centerY]).scale(frame.radius);
    for (const country of countries) {
      const projected = projectLocation(country.lat, country.lng, frame);
      const outlinePoint = projection([country.lng, country.lat])!;
      close(projected.x, outlinePoint[0]); close(projected.y, outlinePoint[1]);
      if (projected.visible) {
        const restored = unprojectLocation(projected.x, projected.y, frame)!;
        close(restored[0], country.lng); close(restored[1], country.lat);
      }
    }
  }
});

test("land clicks resolve countries, while ocean and space remain unselected", () => {
  const topology = JSON.parse(readFileSync(new URL("../public/geo/countries.topo.json", import.meta.url), "utf8")) as Topology<{ countries: GeometryCollection }>;
  const features = feature(topology, topology.objects.countries).features as CountryFeature[];
  assert.equal(countryAtPoint(features, [10, 20]), "NE");
  assert.equal(countryAtPoint(features, [2.35, 48.85]), "FR");
  assert.equal(countryAtPoint(features, [-140, 0]), undefined);
  assert.equal(unprojectLocation(0, 0, { ...size, ...focusAngles(20, 10) }), null);
});

test("camera focus takes the short route across the antimeridian after repeated rotations", () => {
  const current = focusAngles(0, 179).phi + Math.PI * 8;
  const next = nearestAngle(focusAngles(0, -179).phi, current);
  close(Math.abs(next - current), 2 * Math.PI / 180);
});


test("COBE shader coordinates match CSS projection at every zoom and pixel density", () => {
  for (const pixelRatio of [1, 1.5, 2]) for (const scale of [0.7, 1, 2.5]) {
    for (const viewport of [size, { ...size, width: 1440, height: 920, centerX: 500, centerY: 465 }, { ...size, width: 412, height: 773, centerX: 206, centerY: 432 }]) {
      const frame = { ...viewport, radius: 300 * scale, scale, ...focusAngles(20, 10) };
      const cobe = cobeViewport(frame, pixelRatio);
      // Evaluate COBE 0.6's fragment-coordinate normalization, including its Y flip.
      for (const [dx, dy] of [[0, 0], [-0.5, 0.5], [0.8, -0.2]]) {
        const x = (frame.centerX + frame.radius * dx) * pixelRatio;
        const y = (frame.height - frame.centerY - frame.radius * dy) * pixelRatio;
        const shaderX = ((2 * x / cobe.width - 1) / cobe.scale - cobe.offset[0] / cobe.width) * cobe.width / cobe.height;
        const shaderY = (2 * y / cobe.height - 1) / cobe.scale + cobe.offset[1] / cobe.height;
        close(shaderX, 0.8 * dx); close(shaderY, -0.8 * dy);
      }
    }
  }
});
