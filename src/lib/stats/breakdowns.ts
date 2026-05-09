import type { Course, Round, Shot } from "../types";
import { isPhysicalShot } from "../shotMeta";
import { shotToFeet, shotToYards } from "../units";
import { computeHoleSg, summarizeRound } from "./index";
import { mean, stdev } from "../util";

function onlyPhysical(shots: Shot[]): Shot[] {
  return shots.filter(isPhysicalShot);
}

// Distance buckets used across breakdowns (yards, or feet for putting)
export const APPROACH_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "<50", min: 0, max: 50 },
  { label: "50-75", min: 50, max: 75 },
  { label: "75-100", min: 75, max: 100 },
  { label: "100-125", min: 100, max: 125 },
  { label: "125-150", min: 125, max: 150 },
  { label: "150-175", min: 150, max: 175 },
  { label: "175-200", min: 175, max: 200 },
  { label: "200+", min: 200, max: Infinity },
];

export const PUTT_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "<3 ft", min: 0, max: 3 },
  { label: "3-5 ft", min: 3, max: 5 },
  { label: "5-10 ft", min: 5, max: 10 },
  { label: "10-15 ft", min: 10, max: 15 },
  { label: "15-25 ft", min: 15, max: 25 },
  { label: "25+ ft", min: 25, max: Infinity },
];

export type ApproachRow = {
  label: string;
  count: number;
  avgProximity: number | null; // feet (proximity after shot)
  stdProximity: number | null;
  greenHitPct: number | null; // landed on green
  // fromFairway vs fromRough counts
  fromFairway: number;
  fromRough: number;
  avgSg: number | null;
};

// Approach breakdown: non-putt shots ending on green-or-not, from fairway/rough.
export function approachBreakdown(
  rounds: Round[],
  coursesById: Map<string, Course>
): ApproachRow[] {
  const buckets = APPROACH_BUCKETS.map((b) => ({
    ...b,
    proximities: [] as number[],
    greenCount: 0,
    fromFairway: 0,
    fromRough: 0,
    sg: [] as number[],
  }));

  for (const r of rounds) {
    const c = coursesById.get(r.courseId);
    if (!c) continue;
    for (const h of r.holes) {
      if (h.shots.length === 0) continue;
      const par = c.holes.find((x) => x.holeNumber === h.holeNumber)?.par ?? 4;
      const shotSg = computeHoleSg(h, par);
      const phys = onlyPhysical(h.shots);
      for (let i = 0; i < phys.length; i++) {
        const s = phys[i];
        const next = phys[i + 1];
        // Only consider approach-like shots: not putts, not tee on par >3
        if (s.lie === "green") continue;
        if (s.lie === "tee" && par > 3) continue;
        // categorize by distance-to-hole before (normalised to yards)
        const d = shotToYards(s.distanceToHoleBefore, s.unit);
        if (d <= 30) continue; // around-green, not an approach
        const b = buckets.find((x) => d >= x.min && d < x.max);
        if (!b) continue;
        if (s.lie === "fairway") b.fromFairway += 1;
        else if (s.lie === "rough") b.fromRough += 1;
        // End position
        let proxFt: number | null = null;
        let onGreen = false;
        if (s.distanceToHoleAfter === 0) {
          proxFt = 0;
          onGreen = true;
        } else if (next) {
          if (next.lie === "green") {
            onGreen = true;
            proxFt = shotToFeet(next.distanceToHoleBefore, next.unit);
          } else if (next.unit === "ft") {
            onGreen = true;
            proxFt = next.distanceToHoleBefore;
          }
        }
        if (proxFt !== null) b.proximities.push(proxFt);
        if (onGreen) b.greenCount += 1;
        if (shotSg[i] && Number.isFinite(shotSg[i].sg)) b.sg.push(shotSg[i].sg);
      }
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    count: b.proximities.length + (b.greenCount === 0 && b.fromFairway + b.fromRough === 0 ? 0 : 0),
    avgProximity: b.proximities.length ? mean(b.proximities) : null,
    stdProximity: b.proximities.length > 1 ? stdev(b.proximities) : null,
    greenHitPct:
      b.fromFairway + b.fromRough > 0
        ? (b.greenCount / (b.fromFairway + b.fromRough)) * 100
        : null,
    fromFairway: b.fromFairway,
    fromRough: b.fromRough,
    avgSg: b.sg.length ? mean(b.sg) : null,
  }));
}

export type PuttRow = {
  label: string;
  attempts: number;
  made: number;
  makePct: number | null;
  avgSg: number | null;
};

export function puttingBreakdown(
  rounds: Round[],
  coursesById: Map<string, Course>
): PuttRow[] {
  const buckets = PUTT_BUCKETS.map((b) => ({
    ...b,
    attempts: 0,
    made: 0,
    sg: [] as number[],
  }));
  for (const r of rounds) {
    const c = coursesById.get(r.courseId);
    if (!c) continue;
    for (const h of r.holes) {
      if (h.shots.length === 0) continue;
      const par = c.holes.find((x) => x.holeNumber === h.holeNumber)?.par ?? 4;
      const shotSg = computeHoleSg(h, par);
      const phys = onlyPhysical(h.shots);
      for (let i = 0; i < phys.length; i++) {
        const s = phys[i];
        if (s.lie !== "green") continue;
        const distFt = shotToFeet(s.distanceToHoleBefore, s.unit);
        const b = buckets.find((x) => distFt >= x.min && distFt < x.max);
        if (!b) continue;
        b.attempts += 1;
        if (s.distanceToHoleAfter === 0) b.made += 1;
        if (shotSg[i] && Number.isFinite(shotSg[i].sg)) b.sg.push(shotSg[i].sg);
      }
    }
  }
  return buckets.map((b) => ({
    label: b.label,
    attempts: b.attempts,
    made: b.made,
    makePct: b.attempts ? (b.made / b.attempts) * 100 : null,
    avgSg: b.sg.length ? mean(b.sg) : null,
  }));
}

export type DriveRow = {
  label: string;
  count: number;
  avgDistance: number | null;
  firPct: number | null;
  missLeft: number;
  missRight: number;
};

export function drivingBreakdown(
  rounds: Round[],
  coursesById: Map<string, Course>
): DriveRow {
  const distances: number[] = [];
  let hits = 0;
  let attempts = 0;
  let left = 0;
  let right = 0;
  for (const r of rounds) {
    const c = coursesById.get(r.courseId);
    if (!c) continue;
    for (const h of r.holes) {
      const par = c.holes.find((x) => x.holeNumber === h.holeNumber)?.par ?? 4;
      if (par < 4) continue;
      if (h.shots.length > 0) {
        const phys = onlyPhysical(h.shots);
        const tee = phys[0];
        const next = phys[1];
        if (tee?.lie === "tee") {
          attempts += 1;
          if (next?.lie === "fairway") hits += 1;
          if (typeof h.driveDistance === "number") distances.push(h.driveDistance);
          else if (next) {
            const est = tee.distanceToHoleBefore - next.distanceToHoleBefore;
            if (est > 0 && est < 400) distances.push(est);
          }
          // Prefer structured missDirection; fall back to legacy tags.
          const md = tee.missDirection;
          if (md === "left" || md === "left-long" || md === "left-short") left += 1;
          else if (md === "right" || md === "right-long" || md === "right-short") right += 1;
          else if (tee.tags?.some((t) => /left|pull|hook/i.test(t))) left += 1;
          else if (tee.tags?.some((t) => /right|push|slice|block/i.test(t))) right += 1;
        }
      } else if (typeof h.driveDistance === "number") {
        distances.push(h.driveDistance);
        attempts += 1;
        if (h.firOverride === true) hits += 1;
      } else if (h.firOverride !== undefined && h.firOverride !== null) {
        attempts += 1;
        if (h.firOverride) hits += 1;
      }
    }
  }
  return {
    label: "Driver / tee shots",
    count: attempts,
    avgDistance: distances.length ? mean(distances) : null,
    firPct: attempts ? (hits / attempts) * 100 : null,
    missLeft: left,
    missRight: right,
  };
}

export type TrendPoint = {
  roundId: string;
  date: string;
  score: number | null;
  scoreToPar: number | null;
  sgTotal: number | null;
};

export function trendsOverRounds(
  rounds: Round[],
  coursesById: Map<string, Course>
): TrendPoint[] {
  const sorted = [...rounds].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((r) => {
    const c = coursesById.get(r.courseId);
    if (!c) {
      return {
        roundId: r.id,
        date: r.date,
        score: null,
        scoreToPar: null,
        sgTotal: null,
      };
    }
    const s = summarizeRound(r, c);
    return {
      roundId: r.id,
      date: r.date,
      score: s.totalScore,
      scoreToPar: s.scoreToPar,
      sgTotal: s.sg?.total ?? null,
    };
  });
}
