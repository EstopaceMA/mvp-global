import { geoContains } from "d3-geo";
import type { Feature, Geometry } from "geojson";

export type CountryFeature = Feature<Geometry, { countryId: string; name: string }>;
/** Layout coordinates and radius are CSS pixels; scale is the user's zoom factor. */
export interface GlobeLayout { centerX: number; centerY: number; radius: number }
export interface GlobeFrame extends GlobeLayout { phi: number; theta: number; scale: number; width: number; height: number }
/** COBE applies its pixel offset after inverse scale, so compensate for scale and DPR. */
export function cobeViewport(frame: GlobeFrame, pixelRatio: number) {
  const scale = frame.radius / (0.4 * frame.height);
  return {
    width: frame.width * pixelRatio,
    height: frame.height * pixelRatio,
    scale,
    offset: [
      2 * pixelRatio * (frame.centerX - frame.width / 2) / scale,
      2 * pixelRatio * (frame.centerY - frame.height / 2) / scale,
    ] as [number, number],
  };
}
const RAD = Math.PI / 180;
export function focusAngles(lat: number, lng: number) {
  return { phi: -lng * RAD - Math.PI / 2, theta: lat * RAD };
}
export function nearestAngle(target: number, current: number) {
  return current + Math.atan2(Math.sin(target - current), Math.cos(target - current));
}
/** Matches COBE 0.6's orthographic shader, including its 0.8 globe radius. */
export function projectLocation(lat: number, lng: number, frame: GlobeFrame) {
  const x = Math.cos(lat * RAD) * Math.cos(lng * RAD);
  const y = Math.sin(lat * RAD);
  const z = -Math.cos(lat * RAD) * Math.sin(lng * RAD);
  const cp = Math.cos(frame.phi), sp = Math.sin(frame.phi);
  const ct = Math.cos(frame.theta), st = Math.sin(frame.theta);
  const cameraX = x * cp + z * sp;
  const cameraY = x * sp * st + y * ct - z * cp * st;
  const depth = -x * sp * ct + y * st + z * cp * ct;
  return { x: frame.centerX + frame.radius * cameraX, y: frame.centerY - frame.radius * cameraY, visible: depth > 0.015, depth };
}
export function unprojectLocation(x: number, y: number, frame: GlobeFrame): [number, number] | null {
  const cx = (x - frame.centerX) / frame.radius;
  const cy = (frame.centerY - y) / frame.radius;
  if (cx * cx + cy * cy > 1) return null;
  const cz = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
  const cp = Math.cos(frame.phi), sp = Math.sin(frame.phi);
  const ct = Math.cos(frame.theta), st = Math.sin(frame.theta);
  const wx = cx * cp + cy * sp * st - cz * sp * ct;
  const wy = cy * ct + cz * st;
  const wz = cx * sp - cy *cp * st + cz * cp * ct;
  return [Math.atan2(-wz, wx) / RAD, Math.asin(Math.max(-1, Math.min(1, wy))) / RAD];
}
export function countryAtPoint(features: CountryFeature[], point: [number, number]) {
  return features.find(feature => geoContains(feature, point))?.properties.countryId;
}
