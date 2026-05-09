"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Dumbbell, Trash2 } from "lucide-react";
import {
  deletePracticeSession,
  listCourses,
  listPracticeSessions,
  listRounds,
  savePracticeSession,
} from "@/lib/db/repo";
import type { PracticeFocus, PracticeSession } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, mean, sum, todayIso } from "@/lib/util";
import { aggregate } from "@/lib/stats";
import { signed } from "@/lib/util";

const FOCI: { k: PracticeFocus; label: string }[] = [
  { k: "driving", label: "Driving" },
  { k: "iron", label: "Irons" },
  { k: "wedge", label: "Wedges" },
  { k: "chip", label: "Chipping" },
  { k: "putt", label: "Putting" },
  { k: "mental", label: "Mental" },
];

export default function PracticePage() {
  const sessions = useLiveQuery(() => listPracticeSessions(), [], []);
  const rounds = useLiveQuery(() => listRounds(), [], []);
  const courses = useLiveQuery(() => listCourses(), [], []);

  const [show, setShow] = React.useState(false);
  const [draft, setDraft] = React.useState<Partial<PracticeSession>>({
    date: todayIso(),
    focus: [],
    drills: "",
  });

  if (sessions === undefined) return <div className="muted">Loading…</div>;

  const toggleFocus = (f: PracticeFocus) => {
    const s = new Set(draft.focus ?? []);
    if (s.has(f)) s.delete(f);
    else s.add(f);
    setDraft({ ...draft, focus: Array.from(s) });
  };

  const save = async () => {
    if (!draft.drills?.trim() && (draft.focus?.length ?? 0) === 0) return;
    await savePracticeSession({
      date: draft.date ?? todayIso(),
      focus: draft.focus ?? [],
      drills: draft.drills ?? "",
      minutes: draft.minutes,
      notes: draft.notes,
    });
    setShow(false);
    setDraft({ date: todayIso(), focus: [], drills: "" });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this practice session?")) return;
    await deletePracticeSession(id);
  };

  const coursesById = new Map((courses ?? []).map((c) => [c.id, c]));
  const agg = aggregate(rounds?.filter((r) => !r.isDraft) ?? [], coursesById);

  // practice vs performance mismatch
  const practiceCount = countByFocus(sessions);
  const practiceHours = hoursByFocus(sessions);
  const mismatches = findMismatches(practiceHours, agg);

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="h1">Practice</div>
          <div className="muted text-sm mt-1">
            Log what you worked on — we'll cross-reference with your stats.
          </div>
        </div>
        <Button variant="primary" onClick={() => setShow((v) => !v)}>
          <Plus size={16} /> New session
        </Button>
      </div>

      {show ? (
        <Card>
          <CardHeader title="New practice session" />
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Date">
              <Input
                type="date"
                value={draft.date ?? todayIso()}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </Field>
            <Field label="Minutes">
              <Input
                type="number"
                inputMode="numeric"
                value={draft.minutes ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    minutes: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
            <div />
            <Field label="Focus" className="md:col-span-3">
              <div className="flex flex-wrap gap-1.5">
                {FOCI.map((f) => (
                  <Chip
                    key={f.k}
                    active={(draft.focus ?? []).includes(f.k)}
                    onClick={() => toggleFocus(f.k)}
                  >
                    {f.label}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Drills / structure*" className="md:col-span-3">
              <Textarea
                rows={4}
                value={draft.drills ?? ""}
                onChange={(e) => setDraft({ ...draft, drills: e.target.value })}
                placeholder="20 min 3-ft gate drill, 20 min 15-ft lag, 10 min center-tee wedges…"
              />
            </Field>
            <Field label="Notes (optional)" className="md:col-span-3">
              <Textarea
                rows={3}
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => setShow(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save session</Button>
          </div>
        </Card>
      ) : null}

      {mismatches.length > 0 ? (
        <Card>
          <CardHeader title="Practice vs performance" subtitle="Where are you spending time vs where you're losing strokes?" />
          <ul className="space-y-2">
            {mismatches.map((m) => (
              <li key={m.area} className="card-2 p-3 text-sm">
                <strong>{m.area}:</strong> {m.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {sessions.length > 0 ? (
        <Card>
          <CardHeader title="Hours logged by focus" subtitle={`${sessions.length} sessions`} />
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {FOCI.map((f) => (
              <div key={f.k} className="card-2 p-3 text-center">
                <div className="muted text-[10px] uppercase tracking-wider">{f.label}</div>
                <div className="text-xl font-semibold num">
                  {practiceHours[f.k].toFixed(1)}h
                </div>
                <div className="muted text-[10px]">
                  {practiceCount[f.k]} session{practiceCount[f.k] === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={36} />}
          title="No sessions yet"
          description="Log a practice session to start tracking what you're working on."
          action={
            <Button variant="primary" onClick={() => setShow(true)}>
              <Plus size={14} /> New session
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader title="All sessions" />
          <div className="hscroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Focus</th>
                  <th>Drills</th>
                  <th className="text-right">Min</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="num whitespace-nowrap">{formatDate(s.date)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {s.focus.map((f) => (
                          <span key={f} className="badge badge-muted">
                            {FOCI.find((x) => x.k === f)?.label ?? f}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-pre-wrap max-w-md">{s.drills}</td>
                    <td className="text-right num">{s.minutes ?? "—"}</td>
                    <td className="text-right">
                      <Button variant="ghost" onClick={() => remove(s.id)} title="Delete">
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function countByFocus(sessions: PracticeSession[]): Record<PracticeFocus, number> {
  const out: Record<PracticeFocus, number> = {
    driving: 0,
    iron: 0,
    wedge: 0,
    chip: 0,
    putt: 0,
    mental: 0,
  };
  for (const s of sessions) for (const f of s.focus) out[f] = (out[f] ?? 0) + 1;
  return out;
}

function hoursByFocus(sessions: PracticeSession[]): Record<PracticeFocus, number> {
  const out: Record<PracticeFocus, number> = {
    driving: 0,
    iron: 0,
    wedge: 0,
    chip: 0,
    putt: 0,
    mental: 0,
  };
  for (const s of sessions) {
    const mins = s.minutes ?? 0;
    const per = s.focus.length ? mins / s.focus.length : 0;
    for (const f of s.focus) out[f] += per / 60;
  }
  return out;
}

function findMismatches(
  hours: Record<PracticeFocus, number>,
  agg: ReturnType<typeof aggregate>
): { area: string; message: string }[] {
  const out: { area: string; message: string }[] = [];
  const totalHours = sum(Object.values(hours));
  if (!agg.sgPerRound || totalHours < 1) return out;
  const sgMap = {
    driving: agg.sgPerRound.offTee,
    iron: agg.sgPerRound.approach,
    wedge: agg.sgPerRound.aroundGreen,
    chip: agg.sgPerRound.aroundGreen,
    putt: agg.sgPerRound.putting,
    mental: 0,
  };
  const avgSg = mean([
    agg.sgPerRound.offTee,
    agg.sgPerRound.approach,
    agg.sgPerRound.aroundGreen,
    agg.sgPerRound.putting,
  ]);
  for (const f of Object.keys(sgMap) as (keyof typeof sgMap)[]) {
    const pct = hours[f] / totalHours;
    const sg = sgMap[f];
    if (pct > 0.3 && sg > avgSg + 0.3) {
      out.push({
        area: labelFor(f),
        message: `You're spending ${Math.round(pct * 100)}% of practice hours here, and it's already your strongest area (${signed(sg)} SG). Consider reallocating some time.`,
      });
    }
    if (pct < 0.1 && sg < -0.5 && sg < avgSg - 0.3) {
      out.push({
        area: labelFor(f),
        message: `This is your weakest category (${signed(sg)} SG) but you've logged only ${Math.round(pct * 100)}% of practice hours here.`,
      });
    }
  }
  return out;
}

function labelFor(f: PracticeFocus): string {
  return FOCI.find((x) => x.k === f)?.label ?? f;
}
