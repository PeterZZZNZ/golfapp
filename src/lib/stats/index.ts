import type { Course, Round, RoundHole, Shot } from "../types";
import { isPhysicalShot } from "../shotMeta";
import { mean, pct, sum } from "../util";
import { shotToFeet, shotToYards } from "../units";
import { expectedStrokes } from "./baseline";

// ---------- Per-hole helpers ----------

/** Physical (non-penalty) shots on a hole, preserving order. */
function physicalShots(h: RoundHole): Shot[] {
  return h.shots.filter(isPhysicalShot);
}

/** Total penalty strokes across all entries (physical + penalty cards). */
function totalPenalties(h: RoundHole): number {
  return h.shots.reduce((a, s) => a + (s.penaltyStrokes ?? 0), 0);
}

export function holeScore(h: RoundHole): number | null {
  if (typeof h.scoreOverride === "number") return h.scoreOverride;
  if (h.shots.length === 0) return null;
  return physicalShots(h).length + totalPenalties(h);
}

export function holePutts(h: RoundHole): number | null {
  if (typeof h.puttsOverride === "number") return h.puttsOverride;
  if (h.shots.length === 0) return null;
  // Count shots tagged as putts OR legacy green-lie physical shots.
  const puttShots = physicalShots(h).filter(
    (s) => s.shotType === "putt" || (s.shotType === undefined && s.lie === "green")
  ).length;
  return puttShots;
}

export function holeFir(h: RoundHole, holePar: number): boolean | null {
  if (holePar === 3) return null; // Not applicable
  if (h.firOverride !== undefined && h.firOverride !== null) return h.firOverride;
  if (h.shots.length === 0) return null;
  // First physical shot is from 'tee'; next physical shot's lie determines fairway hit
  const phys = physicalShots(h);
  const tee = phys[0];
  const second = phys[1];
  if (!tee || tee.lie !== "tee") return null;
  if (!second) return null;
  return second.lie === "fairway";
}

export function holeGir(h: RoundHole, holePar: number): boolean | null {
  if (h.girOverride !== undefined && h.girOverride !== null) return h.girOverride;
  if (h.shots.length === 0) return null;
  // Regulation: (par - 2) physical strokes get on the green
  const regShots = holePar - 2;
  if (regShots < 1) return null;
  const phys = physicalShots(h);
  const shot = phys[regShots - 1];
  if (!shot) return null;
  if (shot.distanceToHoleAfter === 0) return true; // holed in regulation
  const next = phys[regShots];
  return !!next && next.lie === "green";
}

// ---------- Strokes Gained ----------

export type SgCategory =
  | "off-tee"
  | "approach"
  | "around-green"
  | "putting";

export type ShotSg = {
  shotNumber: number;
  category: SgCategory;
  sg: number;
  before: { lie: Shot["lie"]; distance: number; unit: "yd" | "m" | "ft" };
  after: { lie: Shot["lie"] | "hole"; distance: number; unit: "yd" | "m" | "ft" };
};

function categorize(shot: Shot, holePar: number): SgCategory {
  if (shot.lie === "green") return "putting";
  if (shot.lie === "tee" && holePar > 3) return "off-tee";
  // Within 30 yards of the hole (not on green) -> around the green
  if (shotToYards(shot.distanceToHoleBefore, shot.unit) <= 30) return "around-green";
  return "approach";
}

// Compute strokes gained per shot in a hole.
// Requires sequential shots with known lie/distance before AND after (or holed).
export function computeHoleSg(
  hole: RoundHole,
  holePar: number
): ShotSg[] {
  const results: ShotSg[] = [];
  if (hole.shots.length === 0) return results;
  // Only physical strokes get SG entries. Penalty cards are folded into the
  // preceding physical shot's `penaltyStrokes` (whether stored there or on
  // the penalty card itself — we add both safely without double-counting).
  const phys = physicalShots(hole);

  // Map: physical-shot index → total penalty strokes attributed to it.
  // Any penalty card that appears between physical shot i and i+1 is attributed to i.
  const penaltyAttrib = new Array(phys.length).fill(0) as number[];
  let lastPhysIndex = -1;
  for (const s of hole.shots) {
    if (isPhysicalShot(s)) {
      lastPhysIndex += 1;
    } else if (lastPhysIndex >= 0) {
      penaltyAttrib[lastPhysIndex] += s.penaltyStrokes ?? 1;
    }
  }

  for (let i = 0; i < phys.length; i++) {
    const s = phys[i];
    const next = phys[i + 1];

    const before = expectedStrokes(
      s.lie,
      s.lie === "green"
        ? shotToFeet(s.distanceToHoleBefore, s.unit)
        : shotToYards(s.distanceToHoleBefore, s.unit)
    );

    let afterExpected: number;
    let afterInfo: ShotSg["after"];
    if (s.distanceToHoleAfter === 0 || !next) {
      afterExpected = 0;
      afterInfo = { lie: "hole", distance: 0, unit: s.unit };
    } else {
      const nextLie = next.lie;
      const d = next.distanceToHoleBefore;
      const dForLookup =
        nextLie === "green"
          ? shotToFeet(d, next.unit)
          : shotToYards(d, next.unit);
      afterExpected = expectedStrokes(nextLie, dForLookup);
      afterInfo = { lie: nextLie, distance: d, unit: next.unit };
    }

    const penalty = (s.penaltyStrokes ?? 0) + penaltyAttrib[i];
    const sg = before - afterExpected - 1 - penalty;

    results.push({
      shotNumber: s.shotNumber,
      category: categorize(s, holePar),
      sg,
      before: {
        lie: s.lie,
        distance: s.distanceToHoleBefore,
        unit: s.unit,
      },
      after: afterInfo,
    });
  }
  return results;
}

// ---------- Round-level summary ----------

export type RoundSummary = {
  hasFullShots: boolean;
  totalScore: number | null;
  scoreToPar: number | null;
  par: number;
  holes: Array<{
    holeNumber: number;
    par: number;
    score: number | null;
    putts: number | null;
    fir: boolean | null;
    gir: boolean | null;
    sg?: { offTee: number; approach: number; aroundGreen: number; putting: number; total: number };
  }>;
  firs: { made: number; attempts: number };
  girs: { made: number; attempts: number };
  putts: { total: number; measuredHoles: number };
  threePutts: number;
  scrambling: { made: number; attempts: number };
  sandSaves: { made: number; attempts: number };
  driveDistances: number[];
  sg?: { offTee: number; approach: number; aroundGreen: number; putting: number; total: number };
};

export function summarizeRound(round: Round, course: Course): RoundSummary {
  const holePars = new Map<number, number>();
  for (const h of course.holes) holePars.set(h.holeNumber, h.par);

  const holes: RoundSummary["holes"] = [];
  let totalScore = 0;
  let anyScore = false;
  let totalPar = 0;
  let totalPuttsMeasured = 0;
  let puttHoles = 0;
  let threePutts = 0;
  let firMade = 0;
  let firAttempts = 0;
  let girMade = 0;
  let girAttempts = 0;
  let scrMade = 0;
  let scrAtt = 0;
  let sandMade = 0;
  let sandAtt = 0;
  const driveDistances: number[] = [];
  let hasFullShots = false;
  const sgTotals = { offTee: 0, approach: 0, aroundGreen: 0, putting: 0, total: 0 };
  let anySg = false;

  for (const h of round.holes) {
    const par = holePars.get(h.holeNumber) ?? 4;
    totalPar += par;
    const score = holeScore(h);
    const putts = holePutts(h);
    const fir = holeFir(h, par);
    const gir = holeGir(h, par);
    if (score !== null) {
      totalScore += score;
      anyScore = true;
    }
    if (putts !== null) {
      totalPuttsMeasured += putts;
      puttHoles += 1;
      if (putts >= 3) threePutts += 1;
    }
    if (h.threePutt && putts === null) threePutts += 1;
    if (par > 3) {
      if (fir !== null) {
        firAttempts += 1;
        if (fir) firMade += 1;
      }
    }
    if (gir !== null) {
      girAttempts += 1;
      if (gir) girMade += 1;
    }
    // Scrambling: missed GIR but made par or better
    if (gir === false && score !== null && score <= par) {
      scrAtt += 1;
      scrMade += 1;
    } else if (gir === false) {
      scrAtt += 1;
    }
    if (h.upAndDownAttempted) {
      scrAtt += 1;
      if (h.upAndDownMade) scrMade += 1;
    }
    if (h.sandSaveAttempted) {
      sandAtt += 1;
      if (h.sandSaveMade) sandMade += 1;
    }
    // Detect sand-save attempts from shot history
    if (h.shots.length > 0) {
      hasFullShots = true;
      const phys = physicalShots(h);
      // Drive distance: tee shot on par 4/5 where next physical shot exists
      if (par >= 4) {
        const tee = phys[0];
        const second = phys[1];
        if (tee && tee.lie === "tee") {
          if (typeof h.driveDistance === "number") {
            // simple-entry mode: stored in user unit; best-effort yard conversion
            driveDistances.push(shotToYards(h.driveDistance, (h as { driveDistanceUnit?: "yd" | "m" | "ft" }).driveDistanceUnit ?? tee.unit ?? "yd"));
          } else if (second) {
            // full-shot mode: subtract distances, convert to yards
            const teeYards = shotToYards(tee.distanceToHoleBefore, tee.unit ?? "yd");
            const secondYards = shotToYards(second.distanceToHoleBefore, second.unit ?? "yd");
            const est = teeYards - secondYards;
            if (est > 0 && est < 500) driveDistances.push(est);
          }
        }
      }
    } else if (typeof h.driveDistance === "number") {
      driveDistances.push(h.driveDistance);
    }

    let sgSummary:
      | {
          offTee: number;
          approach: number;
          aroundGreen: number;
          putting: number;
          total: number;
        }
      | undefined;
    if (h.shots.length > 0) {
      const shotSg = computeHoleSg(h, par);
      sgSummary = { offTee: 0, approach: 0, aroundGreen: 0, putting: 0, total: 0 };
      for (const sh of shotSg) {
        if (Number.isFinite(sh.sg)) {
          sgSummary.total += sh.sg;
          if (sh.category === "off-tee") sgSummary.offTee += sh.sg;
          else if (sh.category === "approach") sgSummary.approach += sh.sg;
          else if (sh.category === "around-green") sgSummary.aroundGreen += sh.sg;
          else if (sh.category === "putting") sgSummary.putting += sh.sg;
        }
      }
      sgTotals.offTee += sgSummary.offTee;
      sgTotals.approach += sgSummary.approach;
      sgTotals.aroundGreen += sgSummary.aroundGreen;
      sgTotals.putting += sgSummary.putting;
      sgTotals.total += sgSummary.total;
      anySg = true;
    }

    holes.push({
      holeNumber: h.holeNumber,
      par,
      score,
      putts,
      fir,
      gir,
      sg: sgSummary,
    });
  }

  return {
    hasFullShots,
    totalScore: anyScore ? totalScore : null,
    scoreToPar: anyScore ? totalScore - totalPar : null,
    par: totalPar,
    holes,
    firs: { made: firMade, attempts: firAttempts },
    girs: { made: girMade, attempts: girAttempts },
    putts: { total: totalPuttsMeasured, measuredHoles: puttHoles },
    threePutts,
    scrambling: { made: scrMade, attempts: scrAtt },
    sandSaves: { made: sandMade, attempts: sandAtt },
    driveDistances,
    sg: anySg ? sgTotals : undefined,
  };
}

// ---------- Aggregate across rounds ----------

export type AggregateStats = {
  roundsCount: number;
  roundsWithScore: number;
  avgScore: number | null;
  avgScoreToPar: number | null;
  firPct: number | null;
  girPct: number | null;
  avgPutts: number | null;
  threePuttsPerRound: number | null;
  scramblingPct: number | null;
  sandSavePct: number | null;
  avgDriveDistance: number | null;
  sgPerRound?: { offTee: number; approach: number; aroundGreen: number; putting: number; total: number };
  sgRoundsCount: number;
};

export function aggregate(
  rounds: Round[],
  coursesById: Map<string, Course>
): AggregateStats {
  const summaries = rounds
    .map((r) => {
      const c = coursesById.get(r.courseId);
      if (!c) return null;
      return { r, c, s: summarizeRound(r, c) };
    })
    .filter(Boolean) as { r: Round; c: Course; s: RoundSummary }[];

  const withScore = summaries.filter((x) => x.s.totalScore !== null);
  const avgScore = withScore.length
    ? mean(withScore.map((x) => x.s.totalScore!))
    : null;
  const avgScoreToPar = withScore.length
    ? mean(withScore.map((x) => x.s.scoreToPar!))
    : null;

  const firMade = sum(summaries.map((x) => x.s.firs.made));
  const firAtt = sum(summaries.map((x) => x.s.firs.attempts));
  const girMade = sum(summaries.map((x) => x.s.girs.made));
  const girAtt = sum(summaries.map((x) => x.s.girs.attempts));

  const avgPutts =
    summaries.length &&
    summaries.some((x) => x.s.putts.measuredHoles >= 9)
      ? mean(
          summaries
            .filter((x) => x.s.putts.measuredHoles >= 9)
            .map(
              (x) =>
                (x.s.putts.total / x.s.putts.measuredHoles) * 18
            )
        )
      : null;

  const threePuttsPerRound = summaries.length
    ? mean(summaries.map((x) => x.s.threePutts))
    : null;

  const scrMade = sum(summaries.map((x) => x.s.scrambling.made));
  const scrAtt = sum(summaries.map((x) => x.s.scrambling.attempts));
  const sandMade = sum(summaries.map((x) => x.s.sandSaves.made));
  const sandAtt = sum(summaries.map((x) => x.s.sandSaves.attempts));

  const driveDistances = summaries.flatMap((x) => x.s.driveDistances);
  const avgDriveDistance = driveDistances.length ? mean(driveDistances) : null;

  const sgRounds = summaries.filter((x) => x.s.sg);
  let sgPerRound:
    | {
        offTee: number;
        approach: number;
        aroundGreen: number;
        putting: number;
        total: number;
      }
    | undefined;
  if (sgRounds.length) {
    sgPerRound = {
      offTee: mean(sgRounds.map((x) => x.s.sg!.offTee)),
      approach: mean(sgRounds.map((x) => x.s.sg!.approach)),
      aroundGreen: mean(sgRounds.map((x) => x.s.sg!.aroundGreen)),
      putting: mean(sgRounds.map((x) => x.s.sg!.putting)),
      total: mean(sgRounds.map((x) => x.s.sg!.total)),
    };
  }

  return {
    roundsCount: summaries.length,
    roundsWithScore: withScore.length,
    avgScore,
    avgScoreToPar,
    firPct: firAtt ? pct(firMade, firAtt) : null,
    girPct: girAtt ? pct(girMade, girAtt) : null,
    avgPutts,
    threePuttsPerRound,
    scramblingPct: scrAtt ? pct(scrMade, scrAtt) : null,
    sandSavePct: sandAtt ? pct(sandMade, sandAtt) : null,
    avgDriveDistance,
    sgPerRound,
    sgRoundsCount: sgRounds.length,
  };
}
