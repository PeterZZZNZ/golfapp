"use client";

import * as React from "react";
import type { Course, RoundHole } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { fmtScoreToPar, sum } from "@/lib/util";
import {
  distFromYards,
  distLabel,
  distToYards,
  roundStorageYards,
  useUnits,
} from "@/lib/units";

type Props = {
  course: Course;
  holes: RoundHole[];
  onChange: (holes: RoundHole[]) => void;
  showStandard?: boolean; // adds drive/approach distance + up&down etc
};

export function QuickEntryGrid({ course, holes, onChange, showStandard }: Props) {
  const units = useUnits();
  const setHole = (i: number, patch: Partial<RoundHole>) => {
    onChange(holes.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  };

  const fromYdDisplay = (v: number | undefined): number | "" => {
    if (typeof v !== "number") return "";
    const d = distFromYards(v, units.dist);
    return Math.round(d);
  };

  const toYdStorage = (
    raw: string
  ): number | undefined => {
    if (raw === "") return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return roundStorageYards(distToYards(n, units.dist));
  };

  const totalStrokes = sum(
    holes.map((h) => (typeof h.scoreOverride === "number" ? h.scoreOverride : 0))
  );
  const holesWithScore = holes.filter((h) => typeof h.scoreOverride === "number").length;
  const totalPar = sum(
    course.holes
      .filter((c) => holes.some((h) => h.holeNumber === c.holeNumber && typeof h.scoreOverride === "number"))
      .map((c) => {
        const override = holes.find((h) => h.holeNumber === c.holeNumber)?.parOverride;
        return override ?? c.par;
      })
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm muted flex-wrap">
        <span>
          Through <span className="num font-medium text-[var(--foreground)]">{holesWithScore}</span> holes •{" "}
          <span className="num font-medium text-[var(--foreground)]">{totalStrokes}</span> strokes
        </span>
        {holesWithScore > 0 ? (
          <span className="badge">{fmtScoreToPar(totalStrokes - totalPar)}</span>
        ) : null}
      </div>

      <div className="hscroll card p-0">
        <table className="table">
          <thead>
            <tr>
              <th className="table-sticky">#</th>
              <th>Par</th>
              <th>Score</th>
              <th>Putts</th>
              <th>FIR</th>
              <th>GIR</th>
              {showStandard ? (
                <>
                  <th>Drive ({distLabel(units.dist)})</th>
                  <th>Approach ({distLabel(units.dist)})</th>
                  <th>U&D</th>
                  <th>Sand save</th>
                  <th>3-putt</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {holes.map((h, i) => {
              const spec = course.holes.find((c) => c.holeNumber === h.holeNumber);
              const par = h.parOverride ?? spec?.par ?? 4;
              const isParOverridden = typeof h.parOverride === "number";
              return (
                <tr key={h.holeNumber}>
                  <td className="table-sticky num font-medium">{h.holeNumber}</td>
                  <td className="num">
                    <ParCell
                      par={par}
                      overridden={isParOverridden}
                      onChange={(v) =>
                        setHole(i, { parOverride: v ?? undefined })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="input !py-1 !px-2 w-16 num"
                      value={h.scoreOverride ?? ""}
                      onChange={(e) =>
                        setHole(i, {
                          scoreOverride:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="input !py-1 !px-2 w-14 num"
                      value={h.puttsOverride ?? ""}
                      onChange={(e) =>
                        setHole(i, {
                          puttsOverride:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td>
                    <TriChip
                      value={h.firOverride ?? null}
                      disabled={par === 3}
                      onChange={(v) => setHole(i, { firOverride: v })}
                    />
                  </td>
                  <td>
                    <TriChip
                      value={h.girOverride ?? null}
                      onChange={(v) => setHole(i, { girOverride: v })}
                    />
                  </td>
                  {showStandard ? (
                    <>
                      <td>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="input !py-1 !px-2 w-20 num"
                          value={fromYdDisplay(h.driveDistance)}
                          onChange={(e) =>
                            setHole(i, { driveDistance: toYdStorage(e.target.value) })
                          }
                          disabled={par === 3}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="input !py-1 !px-2 w-20 num"
                          value={fromYdDisplay(h.approachDistance)}
                          onChange={(e) =>
                            setHole(i, { approachDistance: toYdStorage(e.target.value) })
                          }
                        />
                      </td>
                      <td>
                        <BoolPair
                          attempted={!!h.upAndDownAttempted}
                          made={!!h.upAndDownMade}
                          onChange={(a, m) =>
                            setHole(i, { upAndDownAttempted: a, upAndDownMade: m })
                          }
                        />
                      </td>
                      <td>
                        <BoolPair
                          attempted={!!h.sandSaveAttempted}
                          made={!!h.sandSaveMade}
                          onChange={(a, m) =>
                            setHole(i, { sandSaveAttempted: a, sandSaveMade: m })
                          }
                        />
                      </td>
                      <td>
                        <Chip
                          active={!!h.threePutt}
                          onClick={() => setHole(i, { threePutt: !h.threePutt })}
                          className="!py-1"
                        >
                          {h.threePutt ? "Yes" : "—"}
                        </Chip>
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TriChip({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  if (disabled) return <span className="muted">—</span>;
  const next: boolean | null =
    value === null ? true : value === true ? false : null;
  const label = value === null ? "—" : value ? "Yes" : "No";
  return (
    <Chip
      active={value === true}
      onClick={() => onChange(next)}
      className={`!py-1 ${value === false ? "!bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] !text-[var(--danger)] !border-transparent" : ""}`}
    >
      {label}
    </Chip>
  );
}

function BoolPair({
  attempted,
  made,
  onChange,
}: {
  attempted: boolean;
  made: boolean;
  onChange: (a: boolean, m: boolean) => void;
}) {
  const state: "none" | "att" | "made" = !attempted ? "none" : made ? "made" : "att";
  const cycle = () => {
    if (state === "none") onChange(true, false);
    else if (state === "att") onChange(true, true);
    else onChange(false, false);
  };
  const label = state === "none" ? "—" : state === "att" ? "Miss" : "Made";
  const color =
    state === "made"
      ? "chip-active"
      : state === "att"
      ? "!bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] !text-[var(--danger)] !border-transparent"
      : "";
  return (
    <Chip onClick={cycle} className={`!py-1 ${color}`}>
      {label}
    </Chip>
  );
}

/** Click-to-edit par cell; shows accent underline when overridden. */
function ParCell({
  par,
  overridden,
  onChange,
}: {
  par: number;
  overridden: boolean;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const ref = React.useRef<HTMLInputElement>(null);

  const start = () => {
    setDraft(String(par));
    setEditing(true);
    setTimeout(() => ref.current?.select(), 0);
  };

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      onChange(null);
    } else {
      onChange(Math.max(3, Math.min(6, Math.round(n))));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        className="input !py-0.5 !px-1 w-12 num"
        value={draft}
        min={3}
        max={6}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { commit(); (e.target as HTMLElement).blur(); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="hover:opacity-60 transition-opacity"
      title={`Par ${par}${overridden ? " (overridden for this round)" : " — click to override for this round"}`}
      onClick={start}
    >
      <span className={overridden ? "underline decoration-dotted text-[var(--accent)]" : ""}>{par}</span>
    </button>
  );
}
