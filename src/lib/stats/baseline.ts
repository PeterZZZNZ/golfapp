import raw from "@/data/baselines/sg.json";
import type { Lie } from "../types";

type Point = { distance: number; strokesToHole: number };
type BaselineTable = Record<Lie, Point[]>;

const TABLE: BaselineTable = {
  tee: raw.tee,
  fairway: raw.fairway,
  rough: raw.rough,
  bunker: raw.bunker,
  recovery: raw.recovery,
  trees: raw.trees,
  hazard: raw.hazard,
  green: raw.green,
};

// Linearly interpolate expected strokes-to-hole from a lie+distance.
// For lies measured in yards: distanceYards is used directly.
// For green: distanceFeet is used directly.
// The caller is responsible for passing the correct unit.
export function expectedStrokes(lie: Lie, distance: number): number {
  const pts = TABLE[lie];
  if (!pts || pts.length === 0) return NaN;
  if (distance <= pts[0].distance) {
    // For very short distances, proportional scaling toward 1 stroke (holed)
    const { distance: d0, strokesToHole: s0 } = pts[0];
    if (lie === "green" && distance <= 1) return 1.001;
    return Math.max(1.0, (distance / d0) * s0);
  }
  if (distance >= pts[pts.length - 1].distance) {
    return pts[pts.length - 1].strokesToHole;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (distance >= a.distance && distance <= b.distance) {
      const t = (distance - a.distance) / (b.distance - a.distance);
      return a.strokesToHole + t * (b.strokesToHole - a.strokesToHole);
    }
  }
  return NaN;
}
