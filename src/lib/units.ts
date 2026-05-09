"use client";

// Unit conversions and formatters.
//
// Storage model:
//   - Long distances: stored in the user's preferred distUnit ("yd" or "m"),
//     recorded on each Shot via Shot.unit.  Legacy data uses "yd" (yards).
//   - Putt distances: stored in the user's preferred puttUnit ("ft" or "m"),
//     recorded on each Shot via Shot.unit = "ft" | "m".
//   - Temperatures: stored as FAHRENHEIT.
//   - Course hole distances (HoleSpec.distances) are always in YARDS.
//
// Display/input model (user preferences in Settings):
//   - distUnit    : "yd" | "m"   — long distances
//   - puttUnit    : "ft" | "m"   — green / short-range distances
//   - tempUnit    : "F"  | "C"
//
// All user-facing numbers and numeric inputs go through this module so the
// preferences apply everywhere.

import { useLiveQuery } from "dexie-react-hooks";
import { getSettings } from "./db/repo";

export const METERS_PER_YARD = 0.9144;
export const METERS_PER_FOOT = 0.3048;

export type DistUnit = "yd" | "m";
export type PuttUnit = "ft" | "m";
export type TempUnit = "F" | "C";

export const DEFAULT_UNITS: {
  dist: DistUnit;
  putt: PuttUnit;
  temp: TempUnit;
} = { dist: "m", putt: "ft", temp: "C" };

// --- long distance (yards <-> meters) ---
export const ydToM = (y: number): number => y * METERS_PER_YARD;
export const mToYd = (m: number): number => m / METERS_PER_YARD;

/** Storage yards -> display value in user unit. */
export function distFromYards(yards: number, unit: DistUnit): number {
  return unit === "m" ? ydToM(yards) : yards;
}
/** User-entered display value -> storage yards. */
export function distToYards(value: number, unit: DistUnit): number {
  return unit === "m" ? mToYd(value) : value;
}

// --- putt distance (feet <-> meters) ---
export const ftToM = (f: number): number => f * METERS_PER_FOOT;
export const mToFt = (m: number): number => m / METERS_PER_FOOT;

export function puttFromFeet(feet: number, unit: PuttUnit): number {
  return unit === "m" ? ftToM(feet) : feet;
}
export function puttToFeet(value: number, unit: PuttUnit): number {
  return unit === "m" ? mToFt(value) : value;
}

// --- temperature ---
export const fToC = (f: number): number => ((f - 32) * 5) / 9;
export const cToF = (c: number): number => (c * 9) / 5 + 32;

export function tempFromF(f: number, unit: TempUnit): number {
  return unit === "C" ? fToC(f) : f;
}
export function tempToF(value: number, unit: TempUnit): number {
  return unit === "C" ? cToF(value) : value;
}

// --- labels ---
export const distLabel = (u: DistUnit): string => (u === "m" ? "m" : "yd");
export const puttLabel = (u: PuttUnit): string => (u === "m" ? "m" : "ft");
export const tempLabel = (u: TempUnit): string => (u === "C" ? "°C" : "°F");

// --- formatters (number + unit) ---
export function formatDist(yards: number, unit: DistUnit, digits = 0): string {
  return `${distFromYards(yards, unit).toFixed(digits)} ${distLabel(unit)}`;
}
export function formatPutt(
  feet: number,
  unit: PuttUnit,
  digits: number | null = null
): string {
  const d = digits ?? (unit === "m" ? 1 : 0);
  return `${puttFromFeet(feet, unit).toFixed(d)} ${puttLabel(unit)}`;
}
export function formatTemp(
  fahrenheit: number,
  unit: TempUnit,
  digits = 0
): string {
  return `${tempFromF(fahrenheit, unit).toFixed(digits)}${tempLabel(unit)}`;
}

// --- rounding used on input->storage conversions, for round-trip stability ---
export function roundStorageYards(yards: number): number {
  return Math.round(yards);
}
export function roundStorageFeet(feet: number): number {
  return Math.round(feet * 10) / 10;
}
export function roundStorageFahrenheit(f: number): number {
  return Math.round(f);
}

// --- bucket labels (used for stats breakdown tables) ---
/**
 * Format an approach-distance bucket whose `min`/`max` are in yards.
 */
export function approachBucketLabel(
  min: number,
  max: number,
  unit: DistUnit
): string {
  const a = Math.round(distFromYards(min, unit));
  const b = Math.round(distFromYards(max, unit));
  const suffix = ` ${distLabel(unit)}`;
  if (!Number.isFinite(max)) return `${a}+${suffix}`;
  if (min === 0) return `<${b}${suffix}`;
  return `${a}-${b}${suffix}`;
}

/**
 * Format a putt-distance bucket whose `min`/`max` are in feet.
 */
export function puttBucketLabel(
  min: number,
  max: number,
  unit: PuttUnit
): string {
  const digits = unit === "m" ? 1 : 0;
  const a = puttFromFeet(min, unit).toFixed(digits);
  const b = puttFromFeet(max, unit).toFixed(digits);
  const suffix = ` ${puttLabel(unit)}`;
  if (!Number.isFinite(max)) return `${a}+${suffix}`;
  if (min === 0) return `<${b}${suffix}`;
  return `${a}-${b}${suffix}`;
}

// --- shot-unit helpers (for stats engine) ---
/**
 * Convert a Shot's stored distance to yards.
 * Handles all three storage units: "yd" (legacy + default), "m", "ft" (putts).
 */
export function shotToYards(dist: number, unit: "yd" | "m" | "ft"): number {
  if (unit === "m") return mToYd(dist);
  if (unit === "ft") return dist / 3;
  return dist;
}

/** Convert a Shot's stored distance to feet (useful for putt stats). */
export function shotToFeet(dist: number, unit: "yd" | "m" | "ft"): number {
  if (unit === "ft") return dist;
  if (unit === "m") return dist / METERS_PER_FOOT;
  return dist * 3;
}

// --- display helper for round-trip stability ---
/**
 * Convert a stored yards value into the user's display unit with stable
 * integer rounding (so typing "128" m -> saved 140 yd -> displayed 128 m).
 */
export function displayDistValue(yards: number, unit: DistUnit): number {
  return Math.round(distFromYards(yards, unit));
}
export function displayPuttValue(feet: number, unit: PuttUnit): number {
  const v = puttFromFeet(feet, unit);
  return unit === "m" ? Math.round(v * 10) / 10 : Math.round(v);
}
export function displayTempValue(f: number, unit: TempUnit): number {
  return Math.round(tempFromF(f, unit));
}

// --- React hook ---
export type UseUnitsResult = {
  dist: DistUnit;
  putt: PuttUnit;
  temp: TempUnit;
  loaded: boolean;
};

export function useUnits(): UseUnitsResult {
  const s = useLiveQuery(() => getSettings(), [], undefined);
  return {
    dist: s?.units ?? DEFAULT_UNITS.dist,
    putt: s?.puttingUnits ?? DEFAULT_UNITS.putt,
    temp: s?.tempUnits ?? DEFAULT_UNITS.temp,
    loaded: !!s,
  };
}
