"use client";

import * as React from "react";
import { Trash2, Plus } from "lucide-react";
import type { Course, HoleSpec, TeeBox } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn, sum } from "@/lib/util";
import {
  distFromYards,
  distLabel,
  distToYards,
  roundStorageYards,
  useUnits,
} from "@/lib/units";

type Draft = {
  name: string;
  location: string;
  sourceUrl: string;
  tees: TeeBox[];
  holes: HoleSpec[];
};

export function emptyDraft(holeCount = 18): Draft {
  const tees: TeeBox[] = [{ name: "White" }];
  const holes: HoleSpec[] = Array.from({ length: holeCount }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    distances: { White: 0 },
  }));
  return { name: "", location: "", sourceUrl: "", tees, holes };
}

export function draftFromCourse(c: Course): Draft {
  return {
    name: c.name,
    location: c.location ?? "",
    sourceUrl: c.sourceUrl ?? "",
    tees: c.tees.length ? c.tees : [{ name: "White" }],
    holes: c.holes,
  };
}

export function draftToCourse(d: Draft): Omit<Course, "id" | "createdAt" | "updatedAt"> {
  return {
    name: d.name.trim(),
    location: d.location.trim() || undefined,
    sourceUrl: d.sourceUrl.trim() || undefined,
    tees: d.tees.map((t) => ({
      name: t.name.trim(),
      rating: t.rating ?? undefined,
      slope: t.slope ?? undefined,
      color: t.color?.trim() || undefined,
    })).filter((t) => t.name),
    holes: d.holes.map((h) => ({
      holeNumber: h.holeNumber,
      par: h.par,
      handicapIndex: h.handicapIndex,
      distances: h.distances,
      notes: h.notes?.trim() || undefined,
    })),
  };
}

export function validate(d: Draft): string[] {
  const errs: string[] = [];
  if (!d.name.trim()) errs.push("Course name is required.");
  if (!d.tees.length || !d.tees[0].name.trim()) errs.push("At least one tee is required.");
  if (d.holes.length < 1) errs.push("At least one hole is required.");
  for (const h of d.holes) {
    if (![3, 4, 5, 6].includes(h.par)) {
      errs.push(`Hole ${h.holeNumber}: par must be 3, 4, 5 or 6.`);
    }
  }
  return errs;
}

export function CourseForm({
  initialDraft,
  onSave,
  onCancel,
  saveLabel = "Save course",
}: {
  initialDraft: Draft;
  onSave: (d: Draft) => Promise<void> | void;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const units = useUnits();
  const [draft, setDraft] = React.useState<Draft>(initialDraft);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);

  const yardsForInput = (yards: number): number | "" => {
    if (!Number.isFinite(yards) || yards === 0) return "";
    return Math.round(distFromYards(yards, units.dist));
  };
  const yardsFromInput = (raw: string): number => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return roundStorageYards(distToYards(n, units.dist));
  };

  // Ensure every tee has an entry in every hole's distances
  const syncDistances = (d: Draft): Draft => {
    const teeNames = d.tees.map((t) => t.name);
    const holes = d.holes.map((h) => {
      const next: Record<string, number> = {};
      for (const t of teeNames) next[t] = h.distances[t] ?? 0;
      return { ...h, distances: next };
    });
    return { ...d, holes };
  };

  const update = (fn: (d: Draft) => Draft) => {
    setDraft((prev) => syncDistances(fn(prev)));
  };

  const addTee = () => {
    update((d) => ({
      ...d,
      tees: [...d.tees, { name: `Tee ${d.tees.length + 1}` }],
    }));
  };

  const removeTee = (i: number) => {
    update((d) => {
      if (d.tees.length <= 1) return d;
      const nextTees = d.tees.filter((_, idx) => idx !== i);
      return { ...d, tees: nextTees };
    });
  };

  const setTee = (i: number, patch: Partial<TeeBox>) => {
    update((d) => {
      const oldName = d.tees[i].name;
      const tees = d.tees.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
      // rename across holes
      if (patch.name !== undefined && patch.name !== oldName) {
        const holes = d.holes.map((h) => {
          const { [oldName]: v, ...rest } = h.distances;
          return { ...h, distances: { ...rest, [patch.name!]: v ?? 0 } };
        });
        return { ...d, tees, holes };
      }
      return { ...d, tees };
    });
  };

  const setHole = (i: number, patch: Partial<HoleSpec>) => {
    update((d) => ({
      ...d,
      holes: d.holes.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    }));
  };

  const setHoleDistance = (i: number, teeName: string, value: number) => {
    update((d) => ({
      ...d,
      holes: d.holes.map((h, idx) =>
        idx === i
          ? { ...h, distances: { ...h.distances, [teeName]: value } }
          : h
      ),
    }));
  };

  const addHole = () => {
    update((d) => {
      const n = d.holes.length + 1;
      const dist: Record<string, number> = {};
      for (const t of d.tees) dist[t.name] = 0;
      return {
        ...d,
        holes: [
          ...d.holes,
          { holeNumber: n, par: 4, distances: dist },
        ],
      };
    });
  };

  const removeHole = () => {
    update((d) => ({ ...d, holes: d.holes.slice(0, -1) }));
  };

  const totalPar = sum(draft.holes.map((h) => h.par));
  const totalDistances: Record<string, number> = {};
  for (const t of draft.tees) {
    totalDistances[t.name] = sum(draft.holes.map((h) => h.distances[t.name] ?? 0));
  }

  const handleSave = async () => {
    const errs = validate(draft);
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 fade-in">
      <Card>
        <CardHeader title="Course details" />
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Name*">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Pebble Beach Golf Links"
            />
          </Field>
          <Field label="Location">
            <Input
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder="Pebble Beach, CA"
            />
          </Field>
          <Field label="Source URL" className="md:col-span-2" hint="Optional — track where scorecard data came from.">
            <Input
              value={draft.sourceUrl}
              onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Tee boxes"
          subtitle="Add each set of tees you want to track. Distances below are entered per tee."
          right={
            <Button variant="secondary" onClick={addTee}>
              <Plus size={14} /> Add tee
            </Button>
          }
        />
        <div className="grid md:grid-cols-2 gap-3">
          {draft.tees.map((t, i) => (
            <div key={i} className="card-2 p-3 flex gap-2 items-end">
              <Field label="Name" className="flex-1">
                <Input
                  value={t.name}
                  onChange={(e) => setTee(i, { name: e.target.value })}
                />
              </Field>
              <Field label="Rating" className="w-24">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={t.rating ?? ""}
                  onChange={(e) =>
                    setTee(i, {
                      rating: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Slope" className="w-24">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={t.slope ?? ""}
                  onChange={(e) =>
                    setTee(i, {
                      slope: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Button
                variant="danger"
                onClick={() => removeTee(i)}
                disabled={draft.tees.length <= 1}
                title="Remove tee"
                className="mb-0.5"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Holes"
          subtitle={`${draft.holes.length} holes • par ${totalPar}`}
          right={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={removeHole} disabled={draft.holes.length <= 1}>
                Remove last
              </Button>
              <Button variant="secondary" onClick={addHole}>
                <Plus size={14} /> Add hole
              </Button>
            </div>
          }
        />
        <div className="hscroll">
          <table className="table">
            <thead>
              <tr>
                <th className="table-sticky">Hole</th>
                <th>Par</th>
                <th>HCP</th>
                {draft.tees.map((t) => (
                  <th key={t.name}>
                    {t.name} ({distLabel(units.dist)})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.holes.map((h, i) => (
                <tr key={i}>
                  <td className={cn("table-sticky num font-medium")}>{h.holeNumber}</td>
                  <td>
                    <select
                      className="select !py-1 !px-2 w-16"
                      value={h.par}
                      onChange={(e) => setHole(i, { par: Number(e.target.value) as 3 | 4 | 5 | 6 })}
                    >
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                      <option value={6}>6</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="input !py-1 !px-2 w-16 num"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={18}
                      value={h.handicapIndex ?? ""}
                      onChange={(e) =>
                        setHole(i, {
                          handicapIndex:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  {draft.tees.map((t) => (
                    <td key={t.name}>
                      <input
                        className="input !py-1 !px-2 w-24 num"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={yardsForInput(h.distances[t.name] ?? 0)}
                        onChange={(e) =>
                          setHoleDistance(i, t.name, yardsFromInput(e.target.value))
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="font-medium">
                <td className="table-sticky">Total</td>
                <td className="num">{totalPar}</td>
                <td></td>
                {draft.tees.map((t) => (
                  <td key={t.name} className="num">
                    {Math.round(distFromYards(totalDistances[t.name], units.dist))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {errors.length > 0 ? (
        <div className="card p-4 border-[var(--danger)]/40">
          <div className="text-[var(--danger)] text-sm font-medium mb-1">
            Please fix the following:
          </div>
          <ul className="list-disc pl-5 text-sm text-[var(--danger)] space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-2 justify-end">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        ) : null}
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}
