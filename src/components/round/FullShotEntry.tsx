"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  Flag,
  AlertTriangle,
} from "lucide-react";
import type {
  ApproachMissType,
  ApproachResult,
  Course,
  Lie,
  RoundHole,
  Shot,
  ShotType,
} from "@/lib/types";
import { LIE_LABELS } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { fmtScoreToPar } from "@/lib/util";
import {
  distFromYards,
  distLabel,
  distToYards,
  formatDist,
  mToYd,
  puttFromFeet,
  puttLabel,
  puttToFeet,
  roundStorageFeet,
  roundStorageYards,
  shotToFeet,
  shotToYards,
  useUnits,
  ydToM,
  type DistUnit,
  type PuttUnit,
} from "@/lib/units";
import {
  APPROACH_LIES,
  APPROACH_MISS_TYPES,
  APPROACH_MISS_TYPE_LABELS,
  APPROACH_RESULTS,
  APPROACH_RESULT_LABELS,
  APPROACH_VECTORS,
  APPROACH_VECTOR_LABELS,
  CLUBS,
  GREENSIDE_LIES,
  GREENSIDE_LIE_LABELS,
  GREENSIDE_RESULTS,
  GREENSIDE_RESULT_LABELS,
  GREENSIDE_TECHNIQUES,
  GREENSIDE_TECHNIQUE_LABELS,
  MISS_DIRECTIONS,
  MISS_DIRECTION_LABELS,
  PENALTY_TYPES,
  PENALTY_TYPE_LABELS,
  PENALTY_RELIEFS,
  PENALTY_RELIEF_LABELS,
  PUTT_BREAKS,
  PUTT_BREAK_LABELS,
  PUTT_SLOPES,
  PUTT_SLOPE_LABELS,
  SHOT_TYPES,
  SHOT_TYPE_HINTS,
  SHOT_TYPE_LABELS,
  SHOT_SHAPES,
  SHOT_SHAPE_LABELS,
  TEE_RESULTS,
  TEE_RESULT_LABELS,
  TEE_RESULTS_WITH_MISS,
  defaultPenaltyStrokes,
  inferShotType,
  isPhysicalShot,
  lieForShotType,
  suggestNextShotType,
  teeResultImpliesPenalty,
} from "@/lib/shotMeta";

type Props = {
  course: Course;
  holes: RoundHole[];
  onChange: (holes: RoundHole[]) => void;
};

export function FullShotEntry({ course, holes, onChange }: Props) {
  const units = useUnits();
  const [holeIdx, setHoleIdx] = React.useState(0);

  const hole = holes[holeIdx];
  const spec = course.holes.find((c) => c.holeNumber === hole?.holeNumber);
  // Use per-round overrides when set, otherwise fall back to course data.
  const par = hole?.parOverride ?? spec?.par ?? 4;
  const baseYardage = hole?.teeName
    ? spec?.distances[hole.teeName] ?? 0
    : (spec && Object.values(spec.distances)[0]) || 0;
  const yardage = hole?.distanceOverrideYards ?? baseYardage;

  // Re-number physical shots whenever the list changes. Also derives
  // `puttMade` / `distanceToHoleAfter` for putts: the last physical shot on
  // the hole is assumed holed when it's a putt. Any earlier putt that was
  // previously auto-flagged holed gets reset when another shot is added.
  const renumber = React.useCallback((shots: Shot[]): Shot[] => {
    let n = 0;
    let lastPhysIdx = -1;
    shots.forEach((s, i) => {
      if (isPhysicalShot(s)) lastPhysIdx = i;
    });
    return shots.map((s, i) => {
      if (isPhysicalShot(s)) {
        n += 1;
        const base: Shot = { ...s, shotNumber: n };
        if (base.shotType === "putt") {
          if (i === lastPhysIdx) {
            base.distanceToHoleAfter = 0;
            base.puttMade = true;
          } else {
            base.puttMade = false;
            if (base.distanceToHoleAfter === 0) {
              base.distanceToHoleAfter = undefined;
            }
          }
        }
        return base;
      }
      return { ...s, shotNumber: 0 };
    });
  }, []);

  const setHoleShots = React.useCallback(
    (shotsIn: Shot[]) => {
      const shots = renumber(shotsIn);
      const phys = shots.filter(isPhysicalShot).length;
      const penalties = shots.reduce((a, s) => a + (s.penaltyStrokes ?? 0), 0);
      const strokes = phys + penalties;
      onChange(
        holes.map((h, i) =>
          i === holeIdx
            ? {
                ...h,
                shots,
                scoreOverride: phys ? strokes : undefined,
              }
            : h
        )
      );
    },
    [holes, holeIdx, onChange, renumber]
  );

  const addShotOfType = (type: ShotType) => {
    if (!hole) return;
    const shots = hole.shots ?? [];
    const last = shots[shots.length - 1];
    const lastPhys = [...shots].reverse().find(isPhysicalShot);

    if (type === "penalty") {
      const stub: Shot = {
        shotNumber: 0,
        shotType: "penalty",
        lie: last?.lie ?? "fairway",
        distanceToHoleBefore: last?.distanceToHoleBefore ?? 0,
        unit: last?.unit ?? units.dist,
        penaltyStrokes: 1,
        penaltyType: "water",
        penaltyAfterShotNumber: lastPhys?.shotNumber ?? 1,
      };
      setHoleShots([...shots, stub]);
      return;
    }

    // Physical shot defaults — store in the user's preferred unit so the
    // database value matches what the user typed (no hidden conversion).
    let lie: Lie = "fairway";
    let unit: "yd" | "m" | "ft" = units.dist; // default long-distance unit
    let distanceToHoleBefore = 0;

    if (type === "tee") {
      lie = "tee";
      unit = units.dist;
      // Convert the hole yardage from yards (HoleSpec) to the storage unit.
      distanceToHoleBefore =
        units.dist === "m" ? Math.round(ydToM(yardage) * 10) / 10 : yardage;
    } else if (type === "putt") {
      lie = "green";
      unit = units.putt === "m" ? "m" : "ft";
    } else if (type === "greenside") {
      lie = "rough";
      unit = units.dist;
    } else if (type === "approach") {
      lie = "fairway";
      unit = units.dist;
    }

    const newShot: Shot = {
      shotNumber: 0,
      shotType: type,
      lie,
      distanceToHoleBefore,
      unit,
    };
    setHoleShots([...shots, newShot]);
  };

  const setShot = (si: number, patch: Partial<Shot>) => {
    if (!hole) return;
    const shots = hole.shots.map((s, i) => (i === si ? { ...s, ...patch } : s));
    setHoleShots(shots);
  };

  /**
   * Update a shot and, if it's a tee shot whose `teeResult` just flipped to
   * "penalty", auto-insert a Penalty card immediately after it (unless one
   * already exists right after). If the user flips away from "penalty", the
   * auto-inserted card stays put — deleting must be explicit so we never
   * destroy user-entered detail.
   */
  const setShotWithPenaltyAutomation = (si: number, patch: Partial<Shot>) => {
    if (!hole) return;
    const existing = hole.shots[si];
    const newly =
      patch.teeResult !== undefined &&
      patch.teeResult !== existing?.teeResult &&
      teeResultImpliesPenalty(patch.teeResult);
    let shots = hole.shots.map((s, i) => (i === si ? { ...s, ...patch } : s));

    if (newly) {
      const next = shots[si + 1];
      const alreadyHasPenalty = next?.shotType === "penalty";
      if (!alreadyHasPenalty) {
        const cur = shots[si];
        const penaltyStub: Shot = {
          shotNumber: 0,
          shotType: "penalty",
          lie: cur.lie,
          distanceToHoleBefore: cur.distanceToHoleBefore,
          unit: cur.unit,
          penaltyStrokes: 1,
          penaltyType: "ob",
          penaltyRelief: "stroke-and-distance",
          penaltyAfterShotNumber: cur.shotNumber || 1,
        };
        shots = [...shots.slice(0, si + 1), penaltyStub, ...shots.slice(si + 1)];
      }
    }
    setHoleShots(shots);
  };

  const removeShot = (si: number) => {
    if (!hole) return;
    setHoleShots(hole.shots.filter((_, i) => i !== si));
  };

  const copyLastHoleTee = () => {
    if (!hole || holeIdx === 0) return;
    const prev = holes[holeIdx - 1];
    if (!prev || prev.shots.length === 0) return;
    const teeShot = prev.shots.find(
      (s) => (s.shotType ?? inferShotType(s)) === "tee"
    );
    if (!teeShot) return;
    setHoleShots([
      {
        shotNumber: 1,
        shotType: "tee",
        lie: "tee",
        distanceToHoleBefore: yardage,
        unit: "yd",
        club: teeShot.club,
        shotShape: teeShot.shotShape,
      },
    ]);
  };

  const markHoled = (si: number) => {
    if (!hole) return;
    const shots = hole.shots.slice(0, si + 1).map((s, i) => {
      if (i !== si) return s;
      const patch: Partial<Shot> = { distanceToHoleAfter: 0 };
      // An approach that's holed implicitly hit the green, so clear any
      // stale "missed" data that would otherwise linger.
      if (s.shotType === "approach") {
        patch.approachResult = "hit-green";
        patch.approachMissTypes = undefined;
      }
      return { ...s, ...patch };
    });
    setHoleShots(shots);
  };

  if (!hole) return null;

  const physCount = hole.shots.filter(isPhysicalShot).length;
  const penalties = hole.shots.reduce(
    (a, s) => a + (s.penaltyStrokes ?? 0),
    0
  );
  const strokes = physCount + penalties;
  const scoreDelta = physCount ? strokes - par : 0;

  const lastShot = hole.shots[hole.shots.length - 1];
  const suggested: ShotType = suggestNextShotType({
    holePar: par,
    prevShot: lastShot,
    allShots: hole.shots,
    prevShotIndex: hole.shots.length - 1,
    totalShotsSoFar: hole.shots.length,
  });

  return (
    <div className="space-y-4">
      {/* Hole header + nav */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setHoleIdx((i) => Math.max(0, i - 1))}
            disabled={holeIdx === 0}
          >
            <ChevronLeft size={14} />
          </Button>
          <div className="text-center">
            <div className="text-xs muted uppercase tracking-wider">Hole</div>
            <div className="text-2xl font-semibold num">
              {hole.holeNumber}{" "}
              <HoleOverrideField
                value={par}
                isOverridden={typeof hole.parOverride === "number"}
                label="par"
                min={3}
                max={6}
                className="text-sm font-normal"
                prefix="Par "
                onChange={(v) =>
                  onChange(
                    holes.map((h, i) =>
                      i === holeIdx
                        ? { ...h, parOverride: v ?? undefined }
                        : h
                    )
                  )
                }
              />
            </div>
            <HoleOverrideField
              value={Math.round(distFromYards(yardage, units.dist))}
              isOverridden={typeof hole.distanceOverrideYards === "number"}
              label="distance"
              min={0}
              max={9999}
              className="muted text-xs num"
              suffix={` ${units.dist}${hole.teeName ? ` • ${hole.teeName}` : ""}`}
              onChange={(v) =>
                onChange(
                  holes.map((h, i) =>
                    i === holeIdx
                      ? {
                          ...h,
                          distanceOverrideYards:
                            v != null
                              ? units.dist === "m"
                                ? Math.round(v / 0.9144)
                                : v
                              : undefined,
                        }
                      : h
                  )
                )
              }
            />
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              setHoleIdx((i) => Math.min(holes.length - 1, i + 1))
            }
            disabled={holeIdx >= holes.length - 1}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
        <div className="text-right">
          <div className="text-xs muted uppercase tracking-wider">
            Hole score
          </div>
          <div className="text-2xl font-semibold num">
            {physCount ? strokes : "—"}
            {physCount ? (
              <span
                className="text-sm ml-2"
                style={{
                  color:
                    scoreDelta > 0
                      ? "var(--danger)"
                      : scoreDelta < 0
                        ? "var(--accent)"
                        : "var(--muted)",
                }}
              >
                {fmtScoreToPar(scoreDelta)}
              </span>
            ) : null}
            {penalties > 0 ? (
              <span className="text-xs muted ml-2">
                (incl. +{penalties} pen.)
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Quick hole nav */}
      <div className="flex flex-wrap gap-1">
        {holes.map((h, i) => {
          const hp =
            course.holes.find((c) => c.holeNumber === h.holeNumber)?.par ?? 4;
          const active = i === holeIdx;
          const phys = h.shots.filter(isPhysicalShot).length;
          const pen = h.shots.reduce((a, s) => a + (s.penaltyStrokes ?? 0), 0);
          const hasShots = phys > 0;
          const delta = hasShots ? phys + pen - hp : null;
          return (
            <button
              key={h.holeNumber}
              onClick={() => setHoleIdx(i)}
              className={`w-9 h-9 rounded-lg text-xs font-medium num flex flex-col items-center justify-center border transition-colors ${
                active
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : hasShots
                    ? "bg-[var(--surface-2)] border-[var(--border)]"
                    : "bg-[var(--surface)] border-[var(--border)] muted"
              }`}
              title={`Hole ${h.holeNumber} par ${hp}`}
            >
              <span>{h.holeNumber}</span>
              {delta !== null ? (
                <span className="text-[9px] opacity-80">
                  {fmtScoreToPar(delta)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Shot cards */}
      <div className="space-y-2">
        {hole.shots.map((shot, si) => {
          const type = shot.shotType ?? inferShotType(shot);
          const isLastPhysical =
            isPhysicalShot(shot) &&
            !hole.shots.slice(si + 1).some(isPhysicalShot);
          const common = {
            shot,
            onChange: (p: Partial<Shot>) => setShot(si, p),
            onRemove: () => removeShot(si),
            distUnit: units.dist,
            puttUnit: units.putt,
          };
          if (type === "tee") {
            return (
              <TeeShotCard
                key={si}
                {...common}
                onChange={(p) => setShotWithPenaltyAutomation(si, p)}
                isLastPhysical={isLastPhysical}
                onHoled={() => markHoled(si)}
              />
            );
          }
          if (type === "approach") {
            return (
              <ApproachShotCard
                key={si}
                {...common}
                isLastPhysical={isLastPhysical}
                onHoled={() => markHoled(si)}
              />
            );
          }
          if (type === "greenside") {
            return (
              <GreensideShotCard
                key={si}
                {...common}
                isLastPhysical={isLastPhysical}
                onHoled={() => markHoled(si)}
              />
            );
          }
          if (type === "putt") {
            return (
              <PuttShotCard
                key={si}
                {...common}
                isLastPhysical={isLastPhysical}
                onHoled={() => markHoled(si)}
              />
            );
          }
          return <PenaltyCard key={si} {...common} />;
        })}

        <AddShotBar
          suggested={suggested}
          onAdd={addShotOfType}
          hasShots={hole.shots.length > 0}
          canCopyTee={hole.shots.length === 0 && holeIdx > 0}
          onCopyTee={copyLastHoleTee}
        />
      </div>
    </div>
  );
}

// =====================================================================
// Add-shot menu
// =====================================================================

function AddShotBar({
  suggested,
  onAdd,
  hasShots,
  canCopyTee,
  onCopyTee,
}: {
  suggested: ShotType;
  onAdd: (t: ShotType) => void;
  hasShots: boolean;
  canCopyTee: boolean;
  onCopyTee: () => void;
}) {
  return (
    <div className="card-2 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium muted uppercase tracking-wider">
          Add shot
        </div>
        <div className="text-[11px] muted">
          Suggested: {SHOT_TYPE_LABELS[suggested]}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SHOT_TYPES.map((t) => (
          <Chip
            key={t}
            active={t === suggested}
            onClick={() => onAdd(t)}
            title={SHOT_TYPE_HINTS[t]}
          >
            <Plus size={12} /> {SHOT_TYPE_LABELS[t]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="primary" onClick={() => onAdd(suggested)}>
          <Plus size={14} />{" "}
          {hasShots ? "Add suggested" : "Add tee shot"}
        </Button>
        {canCopyTee ? (
          <Button variant="secondary" onClick={onCopyTee}>
            <Copy size={14} /> Copy previous tee shot
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// =====================================================================
// Shared helpers
// =====================================================================

type CommonCardProps = {
  shot: Shot;
  onChange: (p: Partial<Shot>) => void;
  onRemove: () => void;
  distUnit: DistUnit;
  puttUnit: PuttUnit;
};

function CardHeader({
  shot,
  onRemove,
  rightBadge,
}: {
  shot: Shot;
  onRemove: () => void;
  rightBadge?: React.ReactNode;
}) {
  const label = SHOT_TYPE_LABELS[shot.shotType ?? inferShotType(shot)];
  const num = isPhysicalShot(shot) ? shot.shotNumber : "P";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full grid place-items-center text-sm font-semibold num ${
            isPhysicalShot(shot)
              ? "bg-[var(--surface-2)]"
              : "bg-[var(--danger)]/15 text-[var(--danger)]"
          }`}
        >
          {num}
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          {!isPhysicalShot(shot) ? (
            <div className="text-[11px] muted">Not a stroke position</div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {rightBadge}
        <Button variant="ghost" onClick={onRemove} title="Remove">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

/**
 * Distance input. Previously this round-tripped the value through storage
 * units on every keystroke (display→user units→yards→display), which caused
 * the number to jitter by the conversion factor as you typed and effectively
 * locked the cursor. We now keep local text state while focused and only
 * commit to the `distanceToHoleBefore` storage value on blur / Enter.
 */
function DistanceField({
  shot,
  distUnit,
  puttUnit,
  onChange,
  label = "Distance to hole",
  allowUnitToggle = false,
}: CommonCardProps & { label?: string; allowUnitToggle?: boolean }) {
  const storageUnit = shot.unit;
  const displayUnit: string =
    storageUnit === "ft" ? puttLabel(puttUnit) : distLabel(distUnit);

  const toDisplayText = React.useCallback(
    (storageVal: number): string => {
      if (!storageVal) return "";
      let v: number;
      if (storageUnit === "ft") {
        v = puttFromFeet(storageVal, puttUnit);
      } else if (storageUnit === "m") {
        // Stored in meters — convert only if display unit differs.
        v = distUnit === "m" ? storageVal : mToYd(storageVal);
      } else {
        // Stored in yards (legacy) — convert to display unit.
        v = distFromYards(storageVal, distUnit);
      }
      return String(Number(v.toFixed(1)));
    },
    [storageUnit, puttUnit, distUnit]
  );

  // While focused / editing, we keep the user's raw text in `draft`. When not
  // focused, we derive the display straight from the storage value so any
  // outside update flows in without a setState-in-effect.
  const [draft, setDraft] = React.useState<string | null>(null);
  const computed = toDisplayText(shot.distanceToHoleBefore);
  const text = draft ?? computed;

  const commit = React.useCallback(() => {
    const value = draft ?? "";
    if (value.trim() === "") {
      if (shot.distanceToHoleBefore !== 0) {
        onChange({ distanceToHoleBefore: 0 });
      }
      setDraft(null);
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(null); // snap back to computed display
      return;
    }
    let storage: number;
    if (storageUnit === "ft") {
      storage = roundStorageFeet(puttToFeet(n, puttUnit));
    } else if (storageUnit === "m") {
      // Input is in distUnit; convert to meters for storage.
      storage = Math.round((distUnit === "m" ? n : ydToM(n)) * 10) / 10;
    } else {
      // Legacy or yards-preferred user.
      storage = roundStorageYards(distToYards(n, distUnit));
    }
    if (storage !== shot.distanceToHoleBefore) {
      onChange({ distanceToHoleBefore: storage });
    }
    // Clear draft so the display re-derives from the (possibly rounded) storage value.
    setDraft(null);
  }, [draft, shot.distanceToHoleBefore, storageUnit, puttUnit, distUnit, onChange]);

  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={storageUnit === "ft" && puttUnit === "m" ? "0.1" : "1"}
          min={0}
          className="input num"
          value={text}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setDraft((d) => d ?? computed)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <span className="muted text-sm">{displayUnit}</span>
        {allowUnitToggle ? (
          <div className="flex gap-1 ml-1">
            <Chip
              active={shot.unit !== "ft"}
              onClick={() => {
                if (shot.unit === "ft") {
                  // Convert from feet to user's long-distance unit
                  const yards = shot.distanceToHoleBefore / 3;
                  onChange({
                    unit: distUnit,
                    distanceToHoleBefore:
                      distUnit === "m"
                        ? Math.round(ydToM(yards) * 10) / 10
                        : Math.round(yards),
                  });
                }
              }}
              title="Long range"
            >
              {distLabel(distUnit)}
            </Chip>
            <Chip
              active={shot.unit === "ft"}
              onClick={() => {
                if (shot.unit !== "ft") {
                  // Convert from long-distance unit to feet
                  const yards = shotToYards(shot.distanceToHoleBefore, shot.unit);
                  onChange({
                    unit: "ft",
                    distanceToHoleBefore: Math.round(yards * 3),
                  });
                }
              }}
              title="Putt distance"
            >
              {puttLabel(puttUnit)}
            </Chip>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClubField({
  shot,
  onChange,
  label = "Club",
}: Pick<CommonCardProps, "shot" | "onChange"> & {
  label?: string;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <Select
        value={shot.club ?? ""}
        onChange={(e) =>
          onChange({ club: e.target.value ? e.target.value : undefined })
        }
      >
        <option value="">—</option>
        {CLUBS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </div>
  );
}

function HoledOutButton({
  isLast,
  onHoled,
}: {
  isLast: boolean;
  onHoled: () => void;
}) {
  if (!isLast) return null;
  return (
    <div className="flex justify-end pt-1">
      <Button variant="primary" onClick={onHoled}>
        <Flag size={14} /> Holed out
      </Button>
    </div>
  );
}

/**
 * Generic enum select. We type it loosely since we have ~10 distinct enums
 * all with `Record<Enum, string>` label maps and `Enum[]` value arrays.
 */
function EnumSelect<T extends string>({
  value,
  onChange,
  options,
  labels,
  placeholder = "—",
  disabled = false,
}: {
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  options: readonly T[];
  labels: Record<T, string>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : (v as T));
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o]}
        </option>
      ))}
    </Select>
  );
}

// =====================================================================
// Tee shot card
// =====================================================================

function TeeShotCard({
  shot,
  onChange,
  onRemove,
  distUnit,
  puttUnit,
  isLastPhysical,
  onHoled,
}: CommonCardProps & {
  isLastPhysical: boolean;
  onHoled: () => void;
}) {
  const showMiss =
    shot.teeResult !== undefined &&
    TEE_RESULTS_WITH_MISS.includes(shot.teeResult);
  const showShape = shot.teeResult !== undefined;

  return (
    <div className="card p-4 space-y-3">
      <CardHeader shot={shot} onRemove={onRemove} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DistanceField
          shot={shot}
          onChange={onChange}
          onRemove={onRemove}
          distUnit={distUnit}
          puttUnit={puttUnit}
          label="Tee-to-hole distance"
        />
        <ClubField shot={shot} onChange={onChange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="label">Result</div>
          <EnumSelect
            value={shot.teeResult}
            onChange={(v) => onChange({ teeResult: v })}
            options={TEE_RESULTS}
            labels={TEE_RESULT_LABELS}
            placeholder="Pick a result"
          />
        </div>

        {showMiss ? (
          <div>
            <div className="label">Miss direction</div>
            <EnumSelect
              value={shot.missDirection}
              onChange={(v) => onChange({ missDirection: v })}
              options={MISS_DIRECTIONS}
              labels={MISS_DIRECTION_LABELS}
            />
          </div>
        ) : null}
      </div>

      {showShape ? (
        <div>
          <div className="label">Shape</div>
          <EnumSelect
            value={shot.shotShape}
            onChange={(v) => onChange({ shotShape: v })}
            options={SHOT_SHAPES}
            labels={SHOT_SHAPE_LABELS}
          />
        </div>
      ) : null}

      <HoledOutButton isLast={isLastPhysical} onHoled={onHoled} />
    </div>
  );
}

// =====================================================================
// Approach shot card
// =====================================================================

function ApproachShotCard({
  shot,
  onChange,
  onRemove,
  distUnit,
  puttUnit,
  isLastPhysical,
  onHoled,
}: CommonCardProps & {
  isLastPhysical: boolean;
  onHoled: () => void;
}) {
  const isLayup = !!shot.isLayup;

  // ── Full-approach result state ──────────────────────────────────────────
  // Treat as "hit" whenever the user explicitly chose it OR the shot was holed.
  const approachResult: ApproachResult | undefined =
    shot.approachResult ??
    (shot.distanceToHoleAfter === 0 ? "hit-green" : undefined);
  const isMissed = approachResult === "missed-green";
  const isHit = approachResult === "hit-green";

  const setApproachResult = (next: ApproachResult) => {
    if (next === "hit-green") {
      onChange({ approachResult: "hit-green", approachMissTypes: undefined });
    } else {
      const patch: Partial<Shot> = { approachResult: "missed-green" };
      if (shot.distanceToHoleAfter === 0) patch.distanceToHoleAfter = undefined;
      onChange(patch);
    }
  };

  const missTypes = shot.approachMissTypes ?? [];
  const toggleMissType = (t: ApproachMissType) => {
    const has = missTypes.includes(t);
    const next = has ? missTypes.filter((x) => x !== t) : [...missTypes, t];
    onChange({ approachMissTypes: next.length ? next : undefined });
  };

  // ── Lay-up result state (reuses teeResult + missDirection) ─────────────
  const layupShowMiss =
    shot.teeResult !== undefined &&
    TEE_RESULTS_WITH_MISS.includes(shot.teeResult);

  // ── Intent toggle: clear the opposing result fields on switch ──────────
  const setLayup = (next: boolean) => {
    if (next) {
      // Switching to lay-up: clear approach-specific fields
      onChange({
        isLayup: true,
        approachResult: undefined,
        approachVector: undefined,
        approachMissTypes: undefined,
      });
    } else {
      // Switching to full approach: clear tee-result fields
      onChange({
        isLayup: false,
        teeResult: undefined,
        missDirection: undefined,
      });
    }
  };

  return (
    <div className="card p-4 space-y-3">
      <CardHeader
        shot={shot}
        onRemove={onRemove}
        rightBadge={
          isLayup ? <span className="badge">Lay-up</span> : null
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DistanceField
          shot={shot}
          onChange={onChange}
          onRemove={onRemove}
          distUnit={distUnit}
          puttUnit={puttUnit}
          label="Distance to hole"
        />
        <ClubField shot={shot} onChange={onChange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="label">Lie</div>
          <Select
            value={shot.lie}
            onChange={(e) => onChange({ lie: e.target.value as Lie })}
          >
            {APPROACH_LIES.map((lie) => (
              <option key={lie} value={lie}>
                {LIE_LABELS[lie]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="label">Shot intent</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!isLayup} onClick={() => setLayup(false)}>
              Full approach
            </Chip>
            <Chip
              active={isLayup}
              onClick={() => setLayup(true)}
              title="Mark as an intentional lay-up"
            >
              Lay-up
            </Chip>
          </div>
        </div>
      </div>

      {isLayup ? (
        /* ── Lay-up results: same options as a tee shot ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label">Result</div>
            <EnumSelect
              value={shot.teeResult}
              onChange={(v) => onChange({ teeResult: v, missDirection: undefined })}
              options={TEE_RESULTS}
              labels={TEE_RESULT_LABELS}
              placeholder="Pick a result"
            />
          </div>

          {layupShowMiss && (
            <div>
              <div className="label">Miss direction</div>
              <EnumSelect
                value={shot.missDirection}
                onChange={(v) => onChange({ missDirection: v })}
                options={MISS_DIRECTIONS}
                labels={MISS_DIRECTION_LABELS}
              />
            </div>
          )}
        </div>
      ) : (
        /* ── Full-approach results ── */
        <>
          <div>
            <div className="label">Result</div>
            <div className="flex flex-wrap gap-1.5">
              {APPROACH_RESULTS.map((r) => (
                <Chip
                  key={r}
                  active={approachResult === r}
                  onClick={() => setApproachResult(r)}
                >
                  {APPROACH_RESULT_LABELS[r]}
                </Chip>
              ))}
            </div>
          </div>

          {(isHit || isMissed) && (
            <div>
              <div className="label">
                {isHit
                  ? "Position on green (relative to pin)"
                  : "Miss direction"}
              </div>
              <EnumSelect
                value={shot.approachVector}
                onChange={(v) => onChange({ approachVector: v })}
                options={APPROACH_VECTORS}
                labels={APPROACH_VECTOR_LABELS}
              />
            </div>
          )}

          {isMissed && (
            <div>
              <div className="label">Miss type (select any that apply)</div>
              <div className="flex flex-wrap gap-1.5">
                {APPROACH_MISS_TYPES.map((t) => (
                  <Chip
                    key={t}
                    active={missTypes.includes(t)}
                    onClick={() => toggleMissType(t)}
                  >
                    {APPROACH_MISS_TYPE_LABELS[t]}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <HoledOutButton isLast={isLastPhysical} onHoled={onHoled} />
    </div>
  );
}

// =====================================================================
// Greenside shot card
// =====================================================================

function GreensideShotCard({
  shot,
  onChange,
  onRemove,
  distUnit,
  puttUnit,
  isLastPhysical,
  onHoled,
}: CommonCardProps & {
  isLastPhysical: boolean;
  onHoled: () => void;
}) {
  return (
    <div className="card p-4 space-y-3">
      <CardHeader shot={shot} onRemove={onRemove} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DistanceField
          shot={shot}
          onChange={onChange}
          onRemove={onRemove}
          distUnit={distUnit}
          puttUnit={puttUnit}
          label="Distance to hole"
          allowUnitToggle
        />
        <ClubField shot={shot} onChange={onChange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="label">Lie</div>
          <EnumSelect
            value={shot.greensideLie}
            onChange={(v) =>
              onChange({
                greensideLie: v,
                lie: v ? lieForShotType("greenside", v) : shot.lie,
              })
            }
            options={GREENSIDE_LIES}
            labels={GREENSIDE_LIE_LABELS}
          />
        </div>
        <div>
          <div className="label">Technique</div>
          <EnumSelect
            value={shot.greensideTechnique}
            onChange={(v) => onChange({ greensideTechnique: v })}
            options={GREENSIDE_TECHNIQUES}
            labels={GREENSIDE_TECHNIQUE_LABELS}
          />
        </div>
      </div>

      <div>
        <div className="label">Result</div>
        <EnumSelect
          value={shot.greensideResult}
          onChange={(v) =>
            onChange({
              greensideResult: v,
              ...(v === "holed" ? { distanceToHoleAfter: 0 } : {}),
            })
          }
          options={GREENSIDE_RESULTS}
          labels={GREENSIDE_RESULT_LABELS}
        />
      </div>

      <HoledOutButton isLast={isLastPhysical} onHoled={onHoled} />
    </div>
  );
}

// =====================================================================
// Putt card
// =====================================================================

function PuttShotCard({
  shot,
  onChange,
  onRemove,
  distUnit,
  puttUnit,
  isLastPhysical,
}: CommonCardProps & {
  isLastPhysical: boolean;
  /** Unused — putts are auto-holed when they're the last physical shot. */
  onHoled?: () => void;
}) {
  React.useEffect(() => {
    if (shot.unit !== "ft") onChange({ unit: "ft", lie: "green" });
    else if (shot.lie !== "green") onChange({ lie: "green" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot.unit, shot.lie]);

  // If this putt is the last physical shot on the hole, assume it was holed.
  const wasHoled = isLastPhysical;

  return (
    <div className="card p-4 space-y-3">
      <CardHeader
        shot={shot}
        onRemove={onRemove}
        rightBadge={
          wasHoled ? (
            <span className="badge" title="No following putt — assumed holed.">
              Holed
            </span>
          ) : (
            <span className="badge badge-muted" title="A later putt exists on this hole.">
              Missed
            </span>
          )
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DistanceField
          shot={shot}
          onChange={onChange}
          onRemove={onRemove}
          distUnit={distUnit}
          puttUnit={puttUnit}
          label="Putt length"
        />
        <div>
          <div className="label">Break</div>
          <EnumSelect
            value={shot.puttBreak}
            onChange={(v) => onChange({ puttBreak: v })}
            options={PUTT_BREAKS}
            labels={PUTT_BREAK_LABELS}
          />
        </div>
      </div>

      <div>
        <div className="label">Slope</div>
        <EnumSelect
          value={shot.puttSlope}
          onChange={(v) => onChange({ puttSlope: v })}
          options={PUTT_SLOPES}
          labels={PUTT_SLOPE_LABELS}
        />
      </div>

      {wasHoled ? (
        <div className="muted text-xs">
          Holed — if you missed this putt, add another putt card below.
        </div>
      ) : null}
    </div>
  );
}

// =====================================================================
// Penalty card
// =====================================================================

function PenaltyCard({ shot, onChange, onRemove }: CommonCardProps) {
  return (
    <div className="card p-4 space-y-3 border-[var(--danger)]/40">
      <CardHeader
        shot={shot}
        onRemove={onRemove}
        rightBadge={
          <span className="badge">+{shot.penaltyStrokes ?? 1} stroke</span>
        }
      />
      <div className="text-xs muted flex items-start gap-1.5">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        <span>
          A penalty entry adds strokes to the hole but isn&apos;t counted as
          a physical stroke (no distance, lie, or SG attribution).
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="label">After which shot</div>
          <input
            type="number"
            inputMode="numeric"
            className="input num"
            min={1}
            value={shot.penaltyAfterShotNumber ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange({ penaltyAfterShotNumber: undefined });
                return;
              }
              const n = Number(raw);
              if (Number.isFinite(n) && n >= 1) {
                onChange({ penaltyAfterShotNumber: Math.round(n) });
              }
            }}
          />
        </div>
        <div>
          <div className="label">Penalty strokes</div>
          <div className="flex gap-1.5">
            {[1, 2].map((n) => (
              <Chip
                key={n}
                active={(shot.penaltyStrokes ?? 1) === n}
                onClick={() => onChange({ penaltyStrokes: n })}
              >
                +{n}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="label">Type</div>
          <EnumSelect
            value={shot.penaltyType}
            onChange={(v) =>
              onChange({
                penaltyType: v,
                penaltyStrokes:
                  shot.penaltyStrokes ??
                  (v ? defaultPenaltyStrokes(v) : undefined),
              })
            }
            options={PENALTY_TYPES}
            labels={PENALTY_TYPE_LABELS}
          />
        </div>
        <div>
          <div className="label">Relief taken</div>
          <EnumSelect
            value={shot.penaltyRelief}
            onChange={(v) => onChange({ penaltyRelief: v })}
            options={PENALTY_RELIEFS}
            labels={PENALTY_RELIEF_LABELS}
          />
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Inline hole-override field (par / distance)
// =====================================================================

/**
 * Shows a static value that turns into a small number input on click.
 * A subtle accent-coloured underline shows when the value is overridden.
 * Blur or Enter commits; Escape cancels.
 */
function HoleOverrideField({
  value,
  isOverridden,
  label,
  min,
  max,
  prefix = "",
  suffix = "",
  className = "",
  onChange,
}: {
  value: number;
  isOverridden: boolean;
  label: string;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      onChange(null); // clear override → revert to course default
    } else {
      onChange(Math.round(Math.max(min, Math.min(max, n))));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        className={`input !py-0.5 !px-1 w-16 num inline-block ${className}`}
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { commit(); (e.target as HTMLElement).blur(); }
          if (e.key === "Escape") { setEditing(false); }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={`${className} hover:opacity-70 transition-opacity cursor-pointer`}
      title={`Click to override ${label} for this round${isOverridden ? " (currently overridden)" : ""}`}
      onClick={startEdit}
    >
      {prefix}
      <span className={isOverridden ? "underline decoration-dotted text-[var(--accent)]" : ""}>
        {value}
      </span>
      {suffix}
    </button>
  );
}
