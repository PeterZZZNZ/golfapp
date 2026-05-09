import type { Course, Round } from "../types";
import { aggregate, holeScore } from "../stats";
import {
  APPROACH_BUCKETS,
  PUTT_BUCKETS,
  approachBreakdown,
  drivingBreakdown,
  puttingBreakdown,
} from "../stats/breakdowns";
import { mean, pct, signed, stdev } from "../util";
import {
  DEFAULT_UNITS,
  approachBucketLabel,
  formatPutt,
  puttBucketLabel,
  puttFromFeet,
  puttLabel,
  type DistUnit,
  type PuttUnit,
} from "../units";

export type InsightSeverity = "high" | "medium" | "low";

export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  summary: string;
  evidence: string[];
  suggestion: string;
  category: "driving" | "approach" | "shortGame" | "putting" | "mental" | "general";
};

const TARGETS = {
  firPct: 55,
  girPct: 45,
  scramblingPct: 50,
  sandSavePct: 35,
  avgPuttsPerRound: 32,
  threePuttsPerRound: 1,
};

export type InsightUnitOpts = {
  dist?: DistUnit;
  putt?: PuttUnit;
};

export function generateInsights(
  rounds: Round[],
  coursesById: Map<string, Course>,
  unitOpts: InsightUnitOpts = {}
): Insight[] {
  if (rounds.length === 0) return [];
  const distUnit: DistUnit = unitOpts.dist ?? DEFAULT_UNITS.dist;
  const puttUnit: PuttUnit = unitOpts.putt ?? DEFAULT_UNITS.putt;
  const agg = aggregate(rounds, coursesById);
  const insights: Insight[] = [];

  // 1) Biggest-opportunity SG
  if (agg.sgPerRound) {
    const categories = [
      { k: "offTee" as const, label: "Off the tee", cat: "driving" as const },
      { k: "approach" as const, label: "Approach", cat: "approach" as const },
      { k: "aroundGreen" as const, label: "Around the green", cat: "shortGame" as const },
      { k: "putting" as const, label: "Putting", cat: "putting" as const },
    ];
    const ranked = categories
      .map((c) => ({ ...c, v: agg.sgPerRound![c.k] }))
      .sort((a, b) => a.v - b.v);
    const worst = ranked[0];
    if (worst.v < -0.3) {
      insights.push({
        id: "sg-weakest",
        severity: worst.v < -1 ? "high" : worst.v < -0.6 ? "medium" : "low",
        title: `${worst.label} is your biggest opportunity`,
        summary: `You're losing ${Math.abs(worst.v).toFixed(2)} strokes per round to baseline in ${worst.label.toLowerCase()}.`,
        evidence: [
          `SG ${worst.label}: ${signed(worst.v)} per round (from ${agg.sgRoundsCount} tracked rounds).`,
          `Other categories — Off tee ${signed(agg.sgPerRound!.offTee)}, Approach ${signed(agg.sgPerRound!.approach)}, Around green ${signed(agg.sgPerRound!.aroundGreen)}, Putting ${signed(agg.sgPerRound!.putting)}.`,
        ],
        suggestion: suggestionFor(worst.cat, distUnit, puttUnit),
        category: worst.cat,
      });
    }
  }

  // 2) Approach distance buckets with bad proximity
  const approach = approachBreakdown(rounds, coursesById);
  for (let i = 0; i < approach.length; i++) {
    const bucket = approach[i];
    const rawBucket = APPROACH_BUCKETS[i];
    const attempts = bucket.fromFairway + bucket.fromRough;
    if (attempts < 4) continue;
    const otherSgs = approach.filter((b) => b !== bucket && b.avgSg !== null).map((b) => b.avgSg!) ;
    const overall = otherSgs.length ? mean(otherSgs) : 0;
    if (bucket.avgSg !== null && bucket.avgSg < -0.2 && bucket.avgSg < overall - 0.15) {
      const displayLabel = rawBucket
        ? approachBucketLabel(rawBucket.min, rawBucket.max, distUnit)
        : bucket.label;
      const stdStr =
        bucket.stdProximity !== null
          ? formatPutt(bucket.stdProximity, puttUnit)
          : "—";
      insights.push({
        id: `approach-${bucket.label}`,
        severity: bucket.avgSg < -0.4 ? "high" : "medium",
        title: `${displayLabel} approach shots are costing strokes`,
        summary: `From ${displayLabel}, your average SG is ${signed(bucket.avgSg)}.`,
        evidence: [
          `${attempts} attempts (${bucket.fromFairway} fairway, ${bucket.fromRough} rough).`,
          bucket.avgProximity !== null
            ? `Average proximity to hole after shot: ${formatPutt(bucket.avgProximity, puttUnit)} (std dev ${stdStr}).`
            : `Proximity not available for this bucket.`,
          bucket.greenHitPct !== null
            ? `Greens hit: ${bucket.greenHitPct.toFixed(0)}%.`
            : "",
        ].filter(Boolean),
        suggestion: `Dedicate a practice block to the ${displayLabel} range — a mix of stock and knock-down shots, then track proximity over 10 reps.`,
        category: "approach",
      });
    }
  }

  // 3) Putting distance trouble
  const putting = puttingBreakdown(rounds, coursesById);
  const shortIdx = PUTT_BUCKETS.findIndex((b) => b.label === "3-5 ft");
  const makeable = shortIdx >= 0 ? putting[shortIdx] : undefined;
  if (makeable && makeable.attempts >= 8 && (makeable.makePct ?? 100) < 80) {
    const rawShort = PUTT_BUCKETS[shortIdx];
    const shortLabel = puttBucketLabel(rawShort.min, rawShort.max, puttUnit);
    const tourRef = `${formatPutt(4, puttUnit)} putt`;
    const drillRef = `${formatPutt(3, puttUnit)} circle drill`;
    insights.push({
      id: "putt-short",
      severity: (makeable.makePct ?? 100) < 65 ? "high" : "medium",
      title: "Short putts are slipping",
      summary: `You're making ${makeable.makePct!.toFixed(0)}% of ${shortLabel} putts.`,
      evidence: [
        `${makeable.made} of ${makeable.attempts} made in this window.`,
        `Tour baseline on a ${tourRef} is ~90%.`,
      ],
      suggestion: `Put 15 minutes on a ${drillRef} before each practice session — one ball, 10 in a row from the same spot before moving.`,
      category: "putting",
    });
  }
  const midIdx = PUTT_BUCKETS.findIndex((b) => b.label === "5-10 ft");
  const midRange = midIdx >= 0 ? putting[midIdx] : undefined;
  if (midRange && midRange.attempts >= 10 && (midRange.makePct ?? 100) < 25) {
    const rawMid = PUTT_BUCKETS[midIdx];
    const midLabel = puttBucketLabel(rawMid.min, rawMid.max, puttUnit);
    insights.push({
      id: "putt-mid",
      severity: "medium",
      title: `Make rate from ${midLabel} is low`,
      summary: `You're making ${midRange.makePct!.toFixed(0)}% from ${midLabel}.`,
      evidence: [
        `${midRange.made} of ${midRange.attempts} converted in this window.`,
      ],
      suggestion: "Work on start-line drills (gate drill) and green-reading routine — make rate here separates 80s from 70s players.",
      category: "putting",
    });
  }

  // 4) 3-putt pattern
  if ((agg.threePuttsPerRound ?? 0) > TARGETS.threePuttsPerRound + 1) {
    insights.push({
      id: "three-putts",
      severity: (agg.threePuttsPerRound ?? 0) > 3 ? "high" : "medium",
      title: `${agg.threePuttsPerRound!.toFixed(1)} three-putts per round`,
      summary: "Reducing 3-putts is a direct stroke savings with minimal physical practice.",
      evidence: [
        `Across ${agg.roundsCount} rounds.`,
        agg.avgPutts !== null
          ? `Avg putts per round: ${agg.avgPutts.toFixed(1)} (target: ${TARGETS.avgPuttsPerRound}).`
          : "",
      ].filter(Boolean),
      suggestion: `Practice lag putting from ${formatPutt(30, puttUnit)}+ — aim for a ${formatPutt(3, puttUnit)} circle every time. Never leave an uphill birdie putt short.`,
      category: "putting",
    });
  }

  // 5) Scrambling weak
  if ((agg.scramblingPct ?? 100) < TARGETS.scramblingPct - 15 && agg.roundsCount >= 3) {
    const chipRef =
      distUnit === "m" ? "20 m" : "20 yd";
    insights.push({
      id: "scrambling",
      severity: "medium",
      title: "Scrambling % is low",
      summary: `You save par only ${agg.scramblingPct!.toFixed(0)}% of the time after missing greens.`,
      evidence: [`${agg.roundsCount} rounds in window.`],
      suggestion: `Practice chip-and-putt combos: 10 balls from ${chipRef}, finish each by putting out. Track up-and-down %.`,
      category: "shortGame",
    });
  }

  // 6) Driving bias
  const drv = drivingBreakdown(rounds, coursesById);
  if (drv.count >= 5) {
    if ((drv.firPct ?? 100) < TARGETS.firPct - 15) {
      const biasLeft = drv.missLeft;
      const biasRight = drv.missRight;
      const total = biasLeft + biasRight;
      let biasNote = "";
      if (total >= 3 && Math.max(biasLeft, biasRight) / total > 0.65) {
        biasNote =
          biasRight > biasLeft
            ? " Your misses are mostly right (push/slice)."
            : " Your misses are mostly left (pull/hook).";
      }
      insights.push({
        id: "fir",
        severity: (drv.firPct ?? 0) < 30 ? "high" : "medium",
        title: "Fairways found is below target",
        summary: `FIR ${drv.firPct!.toFixed(0)}% (target ${TARGETS.firPct}%).${biasNote}`,
        evidence: [
          `${drv.count} driver attempts tracked.`,
          total > 0 ? `Missed left: ${biasLeft}, missed right: ${biasRight}.` : "",
        ].filter(Boolean),
        suggestion:
          biasNote.length > 0
            ? "Work on the dominant miss first — grip check and swing path drill in front of a mirror before range."
            : "Hit a 14-ball fairway challenge: tee up with driver + 3W and track hits. Bring cadence to tempo.",
        category: "driving",
      });
    }
  }

  // (unitless informational helpers — keep silenced so TypeScript treats as used)
  void puttFromFeet;
  void puttLabel;

  // 7) Score variance (mental/consistency)
  const roundsWithScore = rounds.filter((r) => r.holes.some((h) => typeof h.scoreOverride === "number" || h.shots.length > 0));
  if (roundsWithScore.length >= 5) {
    const scoreSummaries = roundsWithScore
      .map((r) => {
        const c = coursesById.get(r.courseId);
        if (!c) return null;
        const totalPar = c.holes.reduce((a, h) => a + h.par, 0);
        const strokes = r.holes.reduce(
          (a, h) => a + (holeScore(h) ?? 0),
          0
        );
        return strokes - totalPar;
      })
      .filter((x): x is number => x !== null);
    if (scoreSummaries.length >= 5) {
      const sd = stdev(scoreSummaries);
      if (sd > 5) {
        insights.push({
          id: "variance",
          severity: "low",
          title: "High round-to-round score variance",
          summary: `Your score-to-par swings by ${sd.toFixed(1)} strokes round-to-round.`,
          evidence: [
            `${scoreSummaries.length} rounds compared.`,
            `Range: ${Math.min(...scoreSummaries)} to ${Math.max(...scoreSummaries)} (vs par).`,
          ],
          suggestion: "Log what happened in the rough rounds (notes page) — mental, sleep, warmup? Patterns emerge quickly.",
          category: "mental",
        });
      }
    }
  }

  // 8) Self-grade / stats mismatch (qualitative tie-in)
  const graded = rounds
    .map((r) => r.postRound?.grades)
    .filter((g): g is NonNullable<typeof g> => !!g);
  if (graded.length >= 3 && agg.sgPerRound) {
    const avgG = {
      driving: mean(graded.map((g) => g.driving ?? NaN).filter((n) => Number.isFinite(n))),
      approach: mean(graded.map((g) => g.approach ?? NaN).filter((n) => Number.isFinite(n))),
      putting: mean(graded.map((g) => g.putting ?? NaN).filter((n) => Number.isFinite(n))),
    };
    const gradeToSg: [number, number, string][] = [
      [avgG.putting, agg.sgPerRound.putting, "Putting"],
      [avgG.approach, agg.sgPerRound.approach, "Approach"],
      [avgG.driving, agg.sgPerRound.offTee, "Driving"],
    ];
    for (const [g, sg, label] of gradeToSg) {
      if (!Number.isFinite(g)) continue;
      if (g <= 2 && sg < 0) {
        insights.push({
          id: `match-${label}`,
          severity: "low",
          title: `Your feel matches the numbers on ${label}`,
          summary: `You grade ${label.toLowerCase()} ${g.toFixed(1)}/5 on average and SG agrees at ${signed(sg)}.`,
          evidence: [
            `${graded.length} rounds have self-grades.`,
            `Average self-grade: ${g.toFixed(1)} / 5.`,
          ],
          suggestion: `Trust the signal — this is a real area to work on, not a feel-based mirage.`,
          category: "mental",
        });
        break;
      }
    }
  }

  // Sort: high -> medium -> low, keep stable within tiers
  const order = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  return insights;
}

function suggestionFor(
  cat: "driving" | "approach" | "shortGame" | "putting",
  distUnit: DistUnit,
  puttUnit: PuttUnit
) {
  const carryTol = distUnit === "m" ? "5 m" : "5 yd";
  const gateRef = formatPutt(3, puttUnit);
  const lagRef = formatPutt(30, puttUnit);
  switch (cat) {
    case "driving":
      return "Driver improvement compounds: 60% tempo reps, fairway-finder shots with 3W as a backup, and track miss direction so a coach can fix a pattern, not a symptom.";
    case "approach":
      return `Iron practice should be distance-first — know your carry for every club within ${carryTol}, and rehearse knockdowns for wind days.`;
    case "shortGame":
      return "Around-the-green saves the most strokes per practice hour for most amateurs. Work low-trajectory bump shots, high flop, and bunker technique in rotation.";
    case "putting":
      return `Build a routine: read → feel → commit. Start every session with a 10-putt gate drill from ${gateRef}, then ${lagRef}+ lag.`;
  }
}

// expose TARGETS if callers want to display them
void pct;
export { TARGETS };
