// Enum arrays, human labels, and next-shot-type suggestions for the
// card-based full shot tracker. All values correspond to types declared in
// `./types.ts` — keep these in sync.

import type {
  ApproachMissType,
  ApproachResult,
  ApproachVector,
  GreensideLie,
  GreensideResult,
  GreensideTechnique,
  Lie,
  MissDirection,
  PenaltyRelief,
  PenaltyType,
  PuttBreak,
  PuttSlope,
  Shot,
  ShotShape,
  ShotType,
  TeeResult,
} from "./types";
import { shotToYards } from "./units";

// ---------- Shot types ----------

export const SHOT_TYPES: ShotType[] = [
  "tee",
  "approach",
  "greenside",
  "putt",
  "penalty",
];

export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  tee: "Tee shot",
  approach: "Approach",
  greenside: "Greenside",
  putt: "Putt",
  penalty: "Penalty",
};

export const SHOT_TYPE_HINTS: Record<ShotType, string> = {
  tee: "Club, result, miss direction, shape",
  approach: "Distance, lie, green hit + position / miss",
  greenside: "Lie, technique, result near the green",
  putt: "Distance, break, slope",
  penalty: "After which shot, penalty type",
};

// ---------- Tee shot ----------

/** Tee results selectable in the new UI. Legacy values ("ob", "penalty-area",
 * "punch-out") are preserved by the `TeeResult` union for back-compat but not
 * offered here — they're all folded into "penalty" / "recovery". */
export const TEE_RESULTS: TeeResult[] = [
  "fairway",
  "rough",
  "bunker",
  "green",
  "recovery",
  "penalty",
];

export const TEE_RESULT_LABELS: Record<TeeResult, string> = {
  fairway: "Fairway",
  rough: "Rough",
  bunker: "Fairway bunker",
  green: "Green",
  recovery: "Trees / recovery",
  penalty: "Penalty",
  // legacy — still used when rendering older rounds
  "penalty-area": "Penalty area",
  ob: "OB",
  "punch-out": "Punch-out",
};

/** Results for which a miss direction makes sense to capture. */
export const TEE_RESULTS_WITH_MISS: TeeResult[] = [
  "rough",
  "bunker",
  "recovery",
  "penalty",
];

/** True iff this tee result implies a penalty stroke is incurred. */
export function teeResultImpliesPenalty(r?: TeeResult): boolean {
  return r === "penalty" || r === "ob" || r === "penalty-area";
}

// ---------- Clubs ----------

/** Canonical club list surfaced in the club dropdown. Users who want a finer
 * distinction (e.g. 4-hybrid vs 4-iron) can still pick the closest choice. */
export const CLUBS: string[] = [
  "Driver",
  "3-wood",
  "5-wood",
  "7-wood",
  "2-hybrid",
  "3-hybrid",
  "4-hybrid",
  "5-hybrid",
  "2-iron",
  "3-iron",
  "4-iron",
  "5-iron",
  "6-iron",
  "7-iron",
  "8-iron",
  "9-iron",
  "PW",
  "GW",
  "SW",
  "LW",
  "Putter",
];

export const MISS_DIRECTIONS: MissDirection[] = [
  "straight",
  "left",
  "right",
  "short",
  "long",
  "left-long",
  "left-short",
  "right-long",
  "right-short",
];

export const MISS_DIRECTION_LABELS: Record<MissDirection, string> = {
  straight: "Straight",
  left: "Left",
  right: "Right",
  short: "Short",
  long: "Long",
  "left-long": "Left + long",
  "left-short": "Left + short",
  "right-long": "Right + long",
  "right-short": "Right + short",
};

export const SHOT_SHAPES: ShotShape[] = [
  "straight",
  "draw",
  "fade",
  "pull",
  "push",
  "hook",
  "slice",
];

export const SHOT_SHAPE_LABELS: Record<ShotShape, string> = {
  straight: "Straight",
  draw: "Draw",
  fade: "Fade",
  pull: "Pull",
  push: "Push",
  hook: "Hook",
  slice: "Slice",
};

// ---------- Approach ----------

export const APPROACH_VECTORS: ApproachVector[] = [
  "pin-high",
  "short",
  "long",
  "left",
  "right",
  "short-left",
  "short-right",
  "long-left",
  "long-right",
];

export const APPROACH_VECTOR_LABELS: Record<ApproachVector, string> = {
  "pin-high": "Pin-high",
  short: "Short",
  long: "Long",
  left: "Left",
  right: "Right",
  "short-left": "Short + left",
  "short-right": "Short + right",
  "long-left": "Long + left",
  "long-right": "Long + right",
};

export const APPROACH_RESULTS: ApproachResult[] = ["hit-green", "missed-green"];

export const APPROACH_RESULT_LABELS: Record<ApproachResult, string> = {
  "hit-green": "Hit green",
  "missed-green": "Missed green",
};

/** Miss-type options surfaced in the multi-select. Legacy values (hit-green,
 * missed-short-side, missed-long-side, flushed) are intentionally excluded. */
export const APPROACH_MISS_TYPES: ApproachMissType[] = [
  "short-sided",
  "long-sided",
  "fat",
  "chunked",
  "thin",
  "bladed",
  "pushed",
  "pulled",
  "hooked",
  "blocked",
];

export const APPROACH_MISS_TYPE_LABELS: Record<ApproachMissType, string> = {
  "short-sided": "Short-sided",
  "long-sided": "Long-sided",
  fat: "Fat",
  chunked: "Chunked",
  thin: "Thin",
  bladed: "Bladed",
  pushed: "Pushed",
  pulled: "Pulled",
  hooked: "Hooked",
  blocked: "Blocked",
  // Legacy display labels (not shown in the picker, but rendered if older
  // data contains these values).
  "hit-green": "Hit green",
  "missed-short-side": "Short-sided",
  "missed-long-side": "Long-sided",
  flushed: "Flushed",
};

/** Lies an approach shot can be played from. */
export const APPROACH_LIES: Lie[] = ["fairway", "rough", "bunker", "recovery"];

// ---------- Greenside ----------

export const GREENSIDE_LIES: GreensideLie[] = [
  "fringe",
  "rough",
  "deep-rough",
  "fairway",
  "bunker",
  "hardpan",
  "pine-straw",
];

export const GREENSIDE_LIE_LABELS: Record<GreensideLie, string> = {
  fringe: "Fringe",
  rough: "Rough",
  "deep-rough": "Deep rough",
  fairway: "Tight fairway",
  bunker: "Greenside bunker",
  hardpan: "Hardpan",
  "pine-straw": "Pine straw",
};

export const GREENSIDE_TECHNIQUES: GreensideTechnique[] = [
  "chip",
  "pitch",
  "flop",
  "bump-and-run",
  "putt-from-off",
  "bunker-splash",
  "bunker-explosion",
];

export const GREENSIDE_TECHNIQUE_LABELS: Record<GreensideTechnique, string> = {
  chip: "Chip",
  pitch: "Pitch",
  flop: "Flop",
  "bump-and-run": "Bump-and-run",
  "putt-from-off": "Putt from off",
  "bunker-splash": "Bunker splash",
  "bunker-explosion": "Bunker explosion",
};

export const GREENSIDE_RESULTS: GreensideResult[] = [
  "holed",
  "hit-green",
  "missed-green",
  "skulled",
  "chunked",
];

export const GREENSIDE_RESULT_LABELS: Record<GreensideResult, string> = {
  holed: "Holed",
  "hit-green": "Hit green",
  "missed-green": "Missed green",
  skulled: "Skulled",
  chunked: "Chunked",
};

// ---------- Putt ----------

export const PUTT_BREAKS: PuttBreak[] = [
  "straight",
  "left-to-right",
  "right-to-left",
  "double-breaker",
];

export const PUTT_BREAK_LABELS: Record<PuttBreak, string> = {
  straight: "Straight",
  "left-to-right": "Left-to-right",
  "right-to-left": "Right-to-left",
  "double-breaker": "Double-breaker",
};

export const PUTT_SLOPES: PuttSlope[] = [
  "uphill",
  "downhill",
  "flat",
  "sidehill",
];

export const PUTT_SLOPE_LABELS: Record<PuttSlope, string> = {
  uphill: "Uphill",
  downhill: "Downhill",
  flat: "Flat",
  sidehill: "Sidehill",
};

// ---------- Penalty ----------

export const PENALTY_TYPES: PenaltyType[] = [
  "water",
  "lateral",
  "ob",
  "lost-ball",
  "unplayable",
  "provisional",
  "wrong-green",
  "cart-path",
  "embedded",
  "other",
];

export const PENALTY_TYPE_LABELS: Record<PenaltyType, string> = {
  water: "Water hazard",
  lateral: "Lateral hazard",
  ob: "Out of bounds",
  "lost-ball": "Lost ball",
  unplayable: "Unplayable",
  provisional: "Provisional",
  "wrong-green": "Wrong green",
  "cart-path": "Cart path relief",
  embedded: "Embedded ball",
  other: "Other",
};

export const PENALTY_RELIEFS: PenaltyRelief[] = [
  "stroke-and-distance",
  "lateral",
  "back-on-line",
  "drop-from-shoulder",
];

export const PENALTY_RELIEF_LABELS: Record<PenaltyRelief, string> = {
  "stroke-and-distance": "Stroke-and-distance",
  lateral: "Lateral drop",
  "back-on-line": "Back-on-line",
  "drop-from-shoulder": "Free drop",
};

/** Default penalty stroke count for a given type.
 * Under the current Rules of Golf, all of these are 1 stroke. Kept as a
 * function so we can evolve per-type behavior without changing call sites. */
export function defaultPenaltyStrokes(t: PenaltyType): number {
  switch (t) {
    default:
      return 1;
  }
}

// ---------- Stats helpers ----------

/** True iff this entry represents a physical stroke (counts toward shots.length). */
export function isPhysicalShot(s: Shot): boolean {
  return s.shotType !== "penalty";
}

/** Human-readable card title shown in the list. */
export function shotTypeLabel(s: Shot): string {
  const t = s.shotType ?? inferShotType(s);
  return SHOT_TYPE_LABELS[t];
}

/** Infer a shotType for legacy shots that don't have one. */
export function inferShotType(s: Shot): ShotType {
  if (s.shotType) return s.shotType;
  if (s.lie === "tee") return "tee";
  if (s.lie === "green") return "putt";
  // Greenside if within 30 yards and not on the fairway/tee
  if (shotToYards(s.distanceToHoleBefore, s.unit) <= 30) return "greenside";
  return "approach";
}

// ---------- Next-shot suggestion ----------

export type NextShotContext = {
  holePar: number;
  prevShot?: Shot;
  /** All shots on the hole up to this point, in order (used to reason across penalty cards). */
  allShots?: Shot[];
  prevShotIndex: number;
  totalShotsSoFar: number;
};

/**
 * Suggest the most likely card type for the next shot given the previous one.
 * Used to pre-select in the "Add shot" menu — the user can always override.
 */
export function suggestNextShotType(ctx: NextShotContext): ShotType {
  const { prevShot, prevShotIndex, allShots } = ctx;
  if (!prevShot) return "tee";

  // Penalty card: look at the physical shot before the penalty. If that was
  // a tee shot with stroke-and-distance-style penalty, next physical shot is
  // a re-tee. Otherwise suggest approach from drop area.
  if (prevShot.shotType === "penalty") {
    const priorPhysical = [...(allShots ?? [])]
      .slice(0, prevShotIndex)
      .reverse()
      .find((s) => s.shotType !== "penalty");
    if (
      priorPhysical?.shotType === "tee" &&
      (prevShot.penaltyRelief === "stroke-and-distance" ||
        prevShot.penaltyType === "ob" ||
        prevShot.penaltyType === "lost-ball" ||
        prevShot.penaltyType === "provisional")
    ) {
      return "tee";
    }
    return "approach";
  }

  // If the previous shot ended on the green → putt.
  const nextLie = inferNextLie(prevShot);
  if (nextLie === "green") return "putt";

  // If holed, nothing more needed — suggest putt as a no-op default.
  if (prevShot.distanceToHoleAfter === 0) return "putt";

  // First physical shot on the hole after the tee shot for par-4/5 → approach.
  if (prevShotIndex === 0 && prevShot.shotType === "tee") {
    // If tee shot already landed near the green, prefer greenside
    if (isShortGame(prevShot)) return "greenside";
    return "approach";
  }

  // If previous shot left us close to the green, suggest greenside.
  if (isShortGame(prevShot)) return "greenside";

  return "approach";
}

function isShortGame(s: Shot): boolean {
  const dAfter = s.distanceToHoleAfter;
  if (typeof dAfter !== "number") return false;
  return dAfter > 0 && shotToYards(dAfter, s.unit) <= 30;
}

/** Best-guess lie for the next shot based on the previous card's declared result. */
export function inferNextLie(prev: Shot): Lie {
  if (prev.shotType === "tee") {
    switch (prev.teeResult) {
      case "fairway":
        return "fairway";
      case "rough":
      case "punch-out":
        return "rough";
      case "bunker":
        return "bunker";
      case "green":
        return "green";
      case "penalty":
      case "penalty-area":
      case "ob":
        return "recovery";
      case "recovery":
        return "recovery";
      default:
        return "fairway";
    }
  }
  if (prev.shotType === "approach") {
    // Prefer the explicit result field; fall back to legacy miss-type data.
    if (prev.approachResult === "hit-green") return "green";
    if (prev.approachResult === "missed-green") return "rough";
    if (prev.approachMissType === "hit-green") return "green";
    // A layup stays in the fairway unless declared otherwise.
    if (prev.isLayup) return "fairway";
    return "rough";
  }
  if (prev.shotType === "greenside") {
    if (prev.greensideResult === "hit-green" || prev.greensideResult === "holed")
      return "green";
    return (prev.greensideLie as Lie) || "rough";
  }
  if (prev.shotType === "putt") return "green";
  return prev.lie;
}

/** Convert a shotType into the canonical `Lie` used by the SG baseline. */
export function lieForShotType(
  type: ShotType,
  chosen?: Lie | GreensideLie
): Lie {
  if (type === "tee") return "tee";
  if (type === "putt") return "green";
  if (type === "penalty") return "fairway"; // unused — penalties skip SG
  if (type === "approach") {
    if (!chosen) return "fairway";
    return (chosen as Lie) ?? "fairway";
  }
  if (type === "greenside") {
    // Collapse greenside-specific lies down to a base Lie for SG lookup.
    switch (chosen) {
      case "bunker":
        return "bunker";
      case "fairway":
      case "fringe":
        return "fairway";
      case "hardpan":
      case "pine-straw":
      case "rough":
      case "deep-rough":
        return "rough";
      default:
        return "rough";
    }
  }
  return "fairway";
}
