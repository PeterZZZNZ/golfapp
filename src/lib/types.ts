// Core domain types for the Golf Improvement Tracker.
// Keep these framework-free so they port to React Native later.

export type Lie =
  | "tee"
  | "fairway"
  | "rough"
  | "bunker"
  | "green"
  | "trees"
  | "hazard"
  | "recovery";

export const LIES: Lie[] = [
  "tee",
  "fairway",
  "rough",
  "bunker",
  "green",
  "trees",
  "hazard",
  "recovery",
];

export const LIE_LABELS: Record<Lie, string> = {
  tee: "Tee",
  fairway: "Fairway",
  rough: "Rough",
  bunker: "Bunker",
  green: "Green",
  trees: "Trees",
  hazard: "Hazard",
  recovery: "Recovery",
};

export type Unit = "yd" | "m" | "ft";

export type TeeBox = {
  name: string;
  rating?: number;
  slope?: number;
  color?: string;
};

export type HoleSpec = {
  holeNumber: number; // 1..18 (or arbitrary)
  par: 3 | 4 | 5 | 6;
  handicapIndex?: number; // stroke index
  distances: Record<string, number>; // teeName -> yards
  notes?: string;
};

export type Course = {
  id: string;
  name: string;
  location?: string;
  sourceUrl?: string;
  tees: TeeBox[];
  holes: HoleSpec[];
  createdAt: number;
  updatedAt: number;
};

export type ShotTag =
  | "push"
  | "pull"
  | "fat"
  | "thin"
  | "flyer"
  | "block"
  | "hook"
  | "slice"
  | "breaking-left"
  | "breaking-right"
  | "uphill"
  | "downhill"
  | "into-wind"
  | "down-wind"
  | string;

/** A strongly-typed card classification for the shot. Legacy (undefined) shots
 * are treated as physical strokes and categorized from `lie` for stats. */
export type ShotType = "tee" | "approach" | "greenside" | "putt" | "penalty";

// --- Tee shot fields ---
export type TeeResult =
  | "fairway"
  | "rough"
  | "bunker"
  | "green" // par-3 only, really
  | "penalty" // consolidated: covers OB, water, lost-ball, etc.
  | "recovery"
  // Legacy values kept for back-compat with existing data; not exposed in the new UI.
  | "penalty-area"
  | "ob"
  | "punch-out";

export type MissDirection =
  | "left"
  | "right"
  | "short"
  | "long"
  | "left-long"
  | "left-short"
  | "right-long"
  | "right-short"
  | "straight";

export type ShotShape =
  | "straight"
  | "draw"
  | "fade"
  | "pull"
  | "push"
  | "hook"
  | "slice";

// --- Approach fields ---
/** Did the ball finish on the green, or not? */
export type ApproachResult = "hit-green" | "missed-green";

/** Exact vector relative to the pin. When `approachResult === "hit-green"`
 * this describes where on the green; when `"missed-green"` it describes the
 * direction of the miss. */
export type ApproachVector =
  | "pin-high"
  | "short"
  | "long"
  | "left"
  | "right"
  | "short-left"
  | "short-right"
  | "long-left"
  | "long-right";

/** Descriptors for a missed green, selected as a multi-select list. */
export type ApproachMissType =
  | "short-sided"
  | "long-sided"
  | "fat"
  | "thin"
  | "chunked"
  | "bladed"
  | "pushed"
  | "pulled"
  | "hooked"
  | "blocked"
  // Legacy values kept for back-compat with existing data; not exposed in the new UI.
  | "hit-green"
  | "missed-short-side"
  | "missed-long-side"
  | "flushed";

// --- Greenside fields ---
export type GreensideLie =
  | "fringe"
  | "rough"
  | "deep-rough"
  | "fairway"
  | "bunker"
  | "hardpan"
  | "pine-straw";

export type GreensideTechnique =
  | "chip"
  | "pitch"
  | "flop"
  | "bump-and-run"
  | "putt-from-off"
  | "bunker-splash"
  | "bunker-explosion";

export type GreensideResult =
  | "holed"
  | "hit-green"
  | "missed-green"
  | "skulled"
  | "chunked";

// --- Putt fields ---
export type PuttBreak =
  | "straight"
  | "left-to-right"
  | "right-to-left"
  | "double-breaker";

export type PuttSlope = "uphill" | "downhill" | "flat" | "sidehill";

// --- Penalty fields (a penalty entry is NOT a physical stroke) ---
export type PenaltyType =
  | "water"
  | "lateral"
  | "ob"
  | "lost-ball"
  | "unplayable"
  | "provisional"
  | "wrong-green"
  | "cart-path"
  | "embedded"
  | "other";

export type PenaltyRelief =
  | "stroke-and-distance"
  | "lateral"
  | "back-on-line"
  | "drop-from-shoulder";

export type Shot = {
  shotNumber: number;
  /** Card classification. Undefined on legacy data (treated as physical for stats). */
  shotType?: ShotType;
  lie: Lie;
  distanceToHoleBefore: number;
  unit: Unit;
  club?: string;
  distanceToHoleAfter?: number; // 0 if holed
  /** Penalty strokes this entry contributes. For penalty cards this is the only stroke impact. */
  penaltyStrokes?: number;
  tags?: ShotTag[];
  notes?: string;

  // --- Tee-shot fields ---
  teeResult?: TeeResult;
  missDirection?: MissDirection;
  shotShape?: ShotShape;

  // --- Approach fields ---
  /** Did the approach end on the green, or did it miss? */
  approachResult?: ApproachResult;
  /** Position on the green (if hit) or miss direction (if missed). */
  approachVector?: ApproachVector;
  /** Multi-select descriptors for a missed approach (fat, short-sided, etc.). */
  approachMissTypes?: ApproachMissType[];
  /** @deprecated Single-select miss type from the old UI. Prefer `approachMissTypes`. */
  approachMissType?: ApproachMissType;
  isLayup?: boolean;

  // --- Greenside fields ---
  greensideLie?: GreensideLie;
  greensideTechnique?: GreensideTechnique;
  greensideResult?: GreensideResult;

  // --- Putt fields ---
  puttBreak?: PuttBreak;
  puttSlope?: PuttSlope;
  puttMade?: boolean;

  // --- Penalty fields ---
  penaltyType?: PenaltyType;
  penaltyRelief?: PenaltyRelief;
  /** Which shot number this penalty follows, for clarity in the timeline. */
  penaltyAfterShotNumber?: number;
};

export type RoundHole = {
  holeNumber: number;
  teeName?: string;
  shots: Shot[];
  scoreOverride?: number;
  puttsOverride?: number;
  firOverride?: boolean | null;
  girOverride?: boolean | null;
  driveDistance?: number;
  approachDistance?: number;
  upAndDownAttempted?: boolean;
  upAndDownMade?: boolean;
  sandSaveAttempted?: boolean;
  sandSaveMade?: boolean;
  threePutt?: boolean;
  notes?: string;
  /** Per-round par override (does not modify the course permanently). */
  parOverride?: number;
  /**
   * Per-round tee distance override in yards (does not modify the course).
   * Useful when playing from a temporary tee or unusual pin position.
   */
  distanceOverrideYards?: number;
};

export type SelfGrade = {
  driving?: number; // 1..5
  approach?: number;
  shortGame?: number;
  putting?: number;
  mental?: number;
};

/** Common labels for a 1–5 self grade; kept here so UI + stats engine agree. */
export const GRADE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Poor",
  2: "Fair",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

/** A specific shot the player flagged as a highlight or lowlight of the round. */
export type RoundHighlight = {
  description: string;
  holeNumber?: number;
  shotNumber?: number;
};

/** Post-round reflection sheet — all fields optional. */
export type PostRound = {
  grades?: SelfGrade;
  /** Free text answer to "What went well / what I was proud of". */
  wentWell?: string;
  /** Free text answer to "What needs work / what to work on next". */
  needsWork?: string;
  /** Free text answer to "What surprised me". */
  surprised?: string;
  /** Free text answer to "What I learned today". */
  learned?: string;
  /** Single-sentence headline takeaway. */
  keyTakeaway?: string;
  /** Explicit goal for the next round / practice session. */
  goalForNext?: string;
  /** Up to two standout shots the player wants to remember. */
  bestShots?: RoundHighlight[];
  /** Up to two shots the player wants to learn from. */
  worstShots?: RoundHighlight[];
};

export type Conditions = {
  weather?: string;
  tempF?: number;
  windMph?: number;
  windDir?: string;
  courseFirmness?: "firm" | "soft" | "wet";
};

export type EntryMode = "quick" | "standard" | "full-shot";

export type Round = {
  id: string;
  courseId: string;
  date: string; // ISO yyyy-mm-dd
  title?: string;
  conditions?: Conditions;
  teePlayed?: string;
  entryMode: EntryMode;
  holes: RoundHole[];
  postRound?: PostRound;
  memorableShotIds?: string[];
  isDraft?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type MemorableShot = {
  id: string;
  roundId?: string;
  holeNumber?: number;
  date: string;
  description: string;
  lie?: Lie;
  outcome?: "great" | "bad" | "learning";
  tags?: string[];
  createdAt: number;
};

export type PracticeFocus = "driving" | "iron" | "wedge" | "putt" | "chip" | "mental";

export type PracticeSession = {
  id: string;
  date: string;
  focus: PracticeFocus[];
  drills: string;
  minutes?: number;
  notes?: string;
  createdAt: number;
};

export type AiProvider = "openai" | "anthropic" | "openrouter";

export type AiSettings = {
  provider?: AiProvider;
  apiKey?: string;
  /** Model override for scorecard vision. Uses server default when absent. */
  model?: string;
  /** Model override for bulk analytics / insights. Uses server default when absent. */
  bulkModel?: string;
  /** Model override for coaching chat. Uses server default when absent. */
  chatModel?: string;
};

export type Settings = {
  units: "yd" | "m";
  puttingUnits: "ft" | "m";
  tempUnits: "F" | "C";
  defaultTee?: string;
  handedness?: "right" | "left";
  handicap?: number;
  ai?: AiSettings;
};

export type ParsedCourseCandidate = {
  confidence: number;
  source: "table" | "list" | "custom";
  holes: HoleSpec[];
  teeNames: string[];
  rawHtml?: string;
  note?: string;
};
