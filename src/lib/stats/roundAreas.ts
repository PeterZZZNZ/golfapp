import type { Course, Round, RoundHole } from "../types";
import { GRADE_LABELS } from "../types";
import { isPhysicalShot } from "../shotMeta";
import { shotToFeet, shotToYards } from "../units";
import { holeScore, summarizeRound } from "./index";

/** Five areas we grade, matching SelfGrade keys. */
export type AreaKey = "driving" | "approach" | "shortGame" | "putting" | "mental";

export const AREA_ORDER: AreaKey[] = [
  "driving",
  "approach",
  "shortGame",
  "putting",
  "mental",
];

export const AREA_LABELS: Record<AreaKey, string> = {
  driving: "Driving",
  approach: "Approach",
  shortGame: "Short game",
  putting: "Putting",
  mental: "Mental",
};

export type Metric = {
  label: string;
  value: string;
  /** Optional numeric for comparisons; undefined for things like "1/3". */
  raw?: number;
};

export type AreaAssessment = {
  key: AreaKey;
  label: string;
  /** Computed 1-5 grade, null if we didn't have enough data to judge. */
  grade: number | null;
  /** One-line reason summarizing the grade. */
  summary: string;
  metrics: Metric[];
};

export type RoundAreaReport = Record<AreaKey, AreaAssessment>;

// --- Grade helpers ---------------------------------------------------------

/** Convert a signed per-shot SG number into a 1-5 grade. */
function gradeFromPerShotSg(perShot: number): number {
  if (perShot >= 0.2) return 5;
  if (perShot >= 0.05) return 4;
  if (perShot >= -0.05) return 3;
  if (perShot >= -0.2) return 2;
  return 1;
}

/** Convert a 0-100 percentage into a 1-5 grade with configurable thresholds
 *  representing the top of each band (descending). */
function gradeFromPct(pct: number, thresholds: [number, number, number, number]): number {
  const [t5, t4, t3, t2] = thresholds;
  if (pct >= t5) return 5;
  if (pct >= t4) return 4;
  if (pct >= t3) return 3;
  if (pct >= t2) return 2;
  return 1;
}

function clampGrade(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function fmtPct(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "—";
  return `${Math.round(p)}%`;
}
function fmtNum(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
function fmtSigned(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const s = n.toFixed(2);
  return n > 0 ? `+${s}` : s;
}

// --- Per-area assessors ----------------------------------------------------

function assessDriving(
  round: Round,
  course: Course,
  s: ReturnType<typeof summarizeRound>
): AreaAssessment {
  const metrics: Metric[] = [];
  const firPct = s.firs.attempts
    ? (s.firs.made / s.firs.attempts) * 100
    : null;
  metrics.push({
    label: "Fairways",
    value: s.firs.attempts ? `${s.firs.made}/${s.firs.attempts} (${fmtPct(firPct)})` : "—",
    raw: firPct ?? undefined,
  });

  // Count tee penalties by looking at teeResult === "penalty" on par-4/5.
  let teeShots = 0;
  let teePenalties = 0;
  for (const h of round.holes) {
    const par = course.holes.find((c) => c.holeNumber === h.holeNumber)?.par ?? 4;
    if (par < 4) continue;
    const phys = h.shots.filter(isPhysicalShot);
    const tee = phys[0];
    if (tee?.lie === "tee") {
      teeShots += 1;
      if (tee.teeResult === "penalty" || tee.teeResult === "ob" || tee.teeResult === "penalty-area") {
        teePenalties += 1;
      }
    }
  }

  if (s.driveDistances.length) {
    const avg = s.driveDistances.reduce((a, b) => a + b, 0) / s.driveDistances.length;
    metrics.push({
      label: "Avg drive",
      value: `${Math.round(avg)} yd`,
      raw: avg,
    });
  }
  if (teeShots > 0) {
    metrics.push({
      label: "Tee penalties",
      value: `${teePenalties}`,
      raw: teePenalties,
    });
  }

  let grade: number | null = null;
  let summary = "";
  const sgOffTee = s.sg?.offTee ?? null;
  if (sgOffTee !== null && teeShots > 0) {
    const perShot = sgOffTee / teeShots;
    metrics.unshift({
      label: "SG off-tee",
      value: `${fmtSigned(sgOffTee)} (${fmtSigned(perShot)}/drive)`,
      raw: sgOffTee,
    });
    grade = gradeFromPerShotSg(perShot);
    summary =
      perShot >= 0.05
        ? "Gained strokes off the tee."
        : perShot <= -0.05
        ? "Lost strokes off the tee."
        : "Neutral off the tee.";
  } else if (firPct !== null) {
    grade = gradeFromPct(firPct, [70, 55, 40, 25]);
    summary = `${fmtPct(firPct)} fairways hit.`;
  } else {
    summary = "Not enough data to grade driving yet.";
  }

  if (grade !== null && teePenalties >= 2) grade = clampGrade(grade - 1);

  return { key: "driving", label: AREA_LABELS.driving, grade, summary, metrics };
}

function assessApproach(
  round: Round,
  course: Course,
  s: ReturnType<typeof summarizeRound>
): AreaAssessment {
  const metrics: Metric[] = [];
  const girPct = s.girs.attempts
    ? (s.girs.made / s.girs.attempts) * 100
    : null;
  metrics.push({
    label: "GIR",
    value: s.girs.attempts ? `${s.girs.made}/${s.girs.attempts} (${fmtPct(girPct)})` : "—",
    raw: girPct ?? undefined,
  });

  // Count "approach" category shots and average proximity (in feet) when they hit green
  let approachShots = 0;
  const proximities: number[] = [];
  for (const h of round.holes) {
    const par = course.holes.find((c) => c.holeNumber === h.holeNumber)?.par ?? 4;
    const phys = h.shots.filter(isPhysicalShot);
    for (let i = 0; i < phys.length; i++) {
      const sh = phys[i];
      if (sh.lie === "green" || sh.lie === "tee") {
        if (!(sh.lie === "tee" && par === 3)) continue;
      }
      // approach = not around-green (within 30y) and not putt
      if (shotToYards(sh.distanceToHoleBefore, sh.unit) <= 30) continue;
      approachShots += 1;
      const next = phys[i + 1];
      if (sh.distanceToHoleAfter === 0) proximities.push(0);
      else if (next && next.lie === "green") {
        proximities.push(shotToFeet(next.distanceToHoleBefore, next.unit));
      }
    }
  }
  if (proximities.length) {
    const avg = proximities.reduce((a, b) => a + b, 0) / proximities.length;
    metrics.push({
      label: "Avg proximity",
      value: `${Math.round(avg)} ft`,
      raw: avg,
    });
  }

  let grade: number | null = null;
  let summary = "";
  const sgApproach = s.sg?.approach ?? null;
  if (sgApproach !== null && approachShots > 0) {
    const perShot = sgApproach / approachShots;
    metrics.unshift({
      label: "SG approach",
      value: `${fmtSigned(sgApproach)} (${fmtSigned(perShot)}/shot)`,
      raw: sgApproach,
    });
    grade = gradeFromPerShotSg(perShot);
    summary =
      perShot >= 0.05
        ? "Iron play was a strength today."
        : perShot <= -0.05
        ? "Approaches cost strokes."
        : "Irons were steady but unremarkable.";
  } else if (girPct !== null) {
    grade = gradeFromPct(girPct, [65, 50, 35, 20]);
    summary = `${fmtPct(girPct)} of greens in regulation.`;
  } else {
    summary = "Not enough data to grade approach yet.";
  }

  return { key: "approach", label: AREA_LABELS.approach, grade, summary, metrics };
}

function assessShortGame(
  round: Round,
  course: Course,
  s: ReturnType<typeof summarizeRound>
): AreaAssessment {
  const metrics: Metric[] = [];
  const scrPct = s.scrambling.attempts
    ? (s.scrambling.made / s.scrambling.attempts) * 100
    : null;
  metrics.push({
    label: "Scrambling",
    value: s.scrambling.attempts
      ? `${s.scrambling.made}/${s.scrambling.attempts} (${fmtPct(scrPct)})`
      : "—",
    raw: scrPct ?? undefined,
  });
  const sandPct = s.sandSaves.attempts
    ? (s.sandSaves.made / s.sandSaves.attempts) * 100
    : null;
  metrics.push({
    label: "Sand saves",
    value: s.sandSaves.attempts
      ? `${s.sandSaves.made}/${s.sandSaves.attempts} (${fmtPct(sandPct)})`
      : "—",
    raw: sandPct ?? undefined,
  });

  // Count around-green shots (non-green, short-yardage or ft-unit non-green)
  let greensideShots = 0;
  for (const h of round.holes) {
    const phys = h.shots.filter(isPhysicalShot);
    for (const sh of phys) {
      if (sh.lie === "green" || sh.lie === "tee") continue;
      if (shotToYards(sh.distanceToHoleBefore, sh.unit) <= 30) greensideShots += 1;
    }
  }

  let grade: number | null = null;
  let summary = "";
  const sgAround = s.sg?.aroundGreen ?? null;
  if (sgAround !== null && greensideShots > 0) {
    const perShot = sgAround / greensideShots;
    metrics.unshift({
      label: "SG around-green",
      value: `${fmtSigned(sgAround)} (${fmtSigned(perShot)}/shot)`,
      raw: sgAround,
    });
    grade = gradeFromPerShotSg(perShot);
    summary =
      perShot >= 0.05
        ? "Short game kept the scorecard clean."
        : perShot <= -0.05
        ? "Short game bled strokes."
        : "Short game roughly par-value.";
  } else if (scrPct !== null && s.scrambling.attempts >= 3) {
    grade = gradeFromPct(scrPct, [60, 45, 30, 15]);
    summary = `Scrambled on ${fmtPct(scrPct)} of missed greens.`;
  } else {
    summary = "Not enough around-green data to grade short game.";
  }

  return { key: "shortGame", label: AREA_LABELS.shortGame, grade, summary, metrics };
}

function assessPutting(
  round: Round,
  course: Course,
  s: ReturnType<typeof summarizeRound>
): AreaAssessment {
  const metrics: Metric[] = [];
  const totalPutts = s.putts.total;
  const measuredHoles = s.putts.measuredHoles;
  const puttsPer18 = measuredHoles > 0 ? (totalPutts / measuredHoles) * 18 : null;
  metrics.push({
    label: "Putts / 18",
    value: puttsPer18 === null ? "—" : fmtNum(puttsPer18, 1),
    raw: puttsPer18 ?? undefined,
  });
  metrics.push({
    label: "3-putts",
    value: `${s.threePutts}`,
    raw: s.threePutts,
  });

  // Count total putts from physical shots to normalize SG / putt.
  let puttStrokes = 0;
  for (const h of round.holes) {
    for (const sh of h.shots) {
      if (!isPhysicalShot(sh)) continue;
      if (sh.shotType === "putt" || (sh.shotType === undefined && sh.lie === "green")) {
        puttStrokes += 1;
      }
    }
  }

  let grade: number | null = null;
  let summary = "";
  const sgPutt = s.sg?.putting ?? null;
  if (sgPutt !== null && puttStrokes > 0) {
    const perShot = sgPutt / puttStrokes;
    metrics.unshift({
      label: "SG putting",
      value: `${fmtSigned(sgPutt)} (${fmtSigned(perShot)}/putt)`,
      raw: sgPutt,
    });
    grade = gradeFromPerShotSg(perShot);
    summary =
      perShot >= 0.05
        ? "Putter was hot."
        : perShot <= -0.05
        ? "Putting cost strokes."
        : "Putting was average.";
  } else if (puttsPer18 !== null) {
    if (puttsPer18 <= 28) grade = 5;
    else if (puttsPer18 <= 30) grade = 4;
    else if (puttsPer18 <= 32) grade = 3;
    else if (puttsPer18 <= 34) grade = 2;
    else grade = 1;
    summary = `${fmtNum(puttsPer18, 1)} putts per 18.`;
  } else {
    summary = "No putt data recorded.";
  }

  if (grade !== null && s.threePutts >= 3) grade = clampGrade(grade - 1);

  return { key: "putting", label: AREA_LABELS.putting, grade, summary, metrics };
}

function countBouncebacks(round: Round, course: Course): {
  bogeyOrWorse: number;
  bounced: number;
  blowups: number; // double-bogey or worse
} {
  const holePars = new Map<number, number>();
  for (const h of course.holes) holePars.set(h.holeNumber, h.par);
  let bogeyOrWorse = 0;
  let bounced = 0;
  let blowups = 0;
  const ordered = [...round.holes].sort((a, b) => a.holeNumber - b.holeNumber);
  for (let i = 0; i < ordered.length; i++) {
    const cur: RoundHole = ordered[i];
    const par = holePars.get(cur.holeNumber) ?? 4;
    const score = holeScore(cur);
    if (score === null) continue;
    if (score - par >= 1) {
      bogeyOrWorse += 1;
      if (score - par >= 2) blowups += 1;
      const next = ordered[i + 1];
      if (next) {
        const nextPar = holePars.get(next.holeNumber) ?? 4;
        const nextScore = holeScore(next);
        if (nextScore !== null && nextScore - nextPar <= -1) bounced += 1;
      }
    }
  }
  return { bogeyOrWorse, bounced, blowups };
}

function assessMental(round: Round, course: Course): AreaAssessment {
  const { bogeyOrWorse, bounced, blowups } = countBouncebacks(round, course);
  const bbRate = bogeyOrWorse > 0 ? (bounced / bogeyOrWorse) * 100 : null;

  const metrics: Metric[] = [
    { label: "Blowups (double+)", value: `${blowups}`, raw: blowups },
    {
      label: "Bogey-or-worse holes",
      value: `${bogeyOrWorse}`,
      raw: bogeyOrWorse,
    },
    {
      label: "Bounce-back",
      value: bbRate === null ? "—" : `${bounced}/${bogeyOrWorse} (${fmtPct(bbRate)})`,
      raw: bbRate ?? undefined,
    },
  ];

  let grade: number;
  if (blowups === 0) grade = 5;
  else if (blowups === 1) grade = 4;
  else if (blowups === 2) grade = 3;
  else if (blowups <= 4) grade = 2;
  else grade = 1;

  if (bbRate !== null) {
    if (bbRate >= 60) grade = clampGrade(grade + 1);
    else if (bbRate <= 20) grade = clampGrade(grade - 1);
  }

  const summary =
    blowups === 0
      ? "No big numbers — steady day."
      : blowups >= 3
      ? `${blowups} blow-up holes unplugged momentum.`
      : bbRate !== null && bbRate >= 60
      ? "Bounced back well after mistakes."
      : `${blowups} big number${blowups === 1 ? "" : "s"} crept in.`;

  return { key: "mental", label: AREA_LABELS.mental, grade, summary, metrics };
}

// --- Public API ------------------------------------------------------------

export function assessRoundAreas(round: Round, course: Course): RoundAreaReport {
  const s = summarizeRound(round, course);
  return {
    driving: assessDriving(round, course, s),
    approach: assessApproach(round, course, s),
    shortGame: assessShortGame(round, course, s),
    putting: assessPutting(round, course, s),
    mental: assessMental(round, course),
  };
}

/** Human readable label for a 1-5 grade. */
export function gradeLabel(grade: number | null | undefined): string {
  if (grade === null || grade === undefined) return "—";
  const g = clampGrade(grade) as 1 | 2 | 3 | 4 | 5;
  return GRADE_LABELS[g];
}

/** Delta between self-assigned and system-computed grade. Positive means the
 * player was more optimistic than the numbers suggest. */
export function gradeDelta(self?: number, system?: number | null): number | null {
  if (typeof self !== "number") return null;
  if (typeof system !== "number") return null;
  return self - system;
}

/** Per-round distance-bucket breakdowns (approach + putt) for just this round,
 * for the round detail page. Uses the same buckets as the global stats. */
export type RoundApproachBucket = {
  label: string;
  count: number;
  greenHits: number;
  avgProximityFt: number | null;
};
export type RoundPuttBucket = {
  label: string;
  attempts: number;
  made: number;
  makePct: number | null;
};

const ROUND_APPROACH_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "<50", min: 0, max: 50 },
  { label: "50-100", min: 50, max: 100 },
  { label: "100-150", min: 100, max: 150 },
  { label: "150-200", min: 150, max: 200 },
  { label: "200+", min: 200, max: Infinity },
];

const ROUND_PUTT_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "<3 ft", min: 0, max: 3 },
  { label: "3-8 ft", min: 3, max: 8 },
  { label: "8-15 ft", min: 8, max: 15 },
  { label: "15-25 ft", min: 15, max: 25 },
  { label: "25+ ft", min: 25, max: Infinity },
];

export function roundDistanceBreakdowns(round: Round, course: Course): {
  approach: RoundApproachBucket[];
  putting: RoundPuttBucket[];
} {
  const appr = ROUND_APPROACH_BUCKETS.map((b) => ({
    ...b,
    count: 0,
    greenHits: 0,
    proximities: [] as number[],
  }));
  const putt = ROUND_PUTT_BUCKETS.map((b) => ({
    ...b,
    attempts: 0,
    made: 0,
  }));

  for (const h of round.holes) {
    const par = course.holes.find((c) => c.holeNumber === h.holeNumber)?.par ?? 4;
    const phys = h.shots.filter(isPhysicalShot);
    for (let i = 0; i < phys.length; i++) {
      const sh = phys[i];
      // Putts → putt buckets
      if (sh.lie === "green" || sh.shotType === "putt") {
        const distFt = shotToFeet(sh.distanceToHoleBefore, sh.unit);
        const b = putt.find((x) => distFt >= x.min && distFt < x.max);
        if (b) {
          b.attempts += 1;
          if (sh.distanceToHoleAfter === 0) b.made += 1;
        }
        continue;
      }
      // Approach buckets: not tee on par>3, not around-green; normalise to yards
      if (sh.lie === "tee" && par > 3) continue;
      const dYards = shotToYards(sh.distanceToHoleBefore, sh.unit);
      if (dYards <= 30) continue; // around-green
      const b = appr.find((x) => dYards >= x.min && dYards < x.max);
      if (!b) continue;
      b.count += 1;
      const next = phys[i + 1];
      if (sh.distanceToHoleAfter === 0) {
        b.greenHits += 1;
        b.proximities.push(0);
      } else if (next && next.lie === "green") {
        b.greenHits += 1;
        b.proximities.push(shotToFeet(next.distanceToHoleBefore, next.unit));
      }
    }
  }

  return {
    approach: appr.map((b) => ({
      label: b.label,
      count: b.count,
      greenHits: b.greenHits,
      avgProximityFt:
        b.proximities.length > 0
          ? b.proximities.reduce((a, n) => a + n, 0) / b.proximities.length
          : null,
    })),
    putting: putt.map((b) => ({
      label: b.label,
      attempts: b.attempts,
      made: b.made,
      makePct: b.attempts ? (b.made / b.attempts) * 100 : null,
    })),
  };
}
