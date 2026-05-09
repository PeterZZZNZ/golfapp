"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, NotebookText, Filter } from "lucide-react";
import {
  deleteMemorableShot,
  getRound,
  listCourses,
  listMemorableShots,
  listRounds,
  saveMemorableShot,
} from "@/lib/db/repo";
import type { Lie, MemorableShot } from "@/lib/types";
import { LIES, LIE_LABELS } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, todayIso } from "@/lib/util";

export default function NotesPage() {
  return (
    <React.Suspense fallback={<div className="muted">Loading…</div>}>
      <NotesInner />
    </React.Suspense>
  );
}

function NotesInner() {
  const search = useSearchParams();
  const prefilledRoundId = search.get("roundId") ?? undefined;
  const prefilledHole = search.get("hole");

  const shots = useLiveQuery(() => listMemorableShots(), [], []);
  const rounds = useLiveQuery(() => listRounds(), [], []);
  const courses = useLiveQuery(() => listCourses(), [], []);

  const [showForm, setShowForm] = React.useState(!!prefilledRoundId);
  const [filter, setFilter] = React.useState<"all" | "great" | "bad" | "learning">("all");

  const [draft, setDraft] = React.useState<Partial<MemorableShot>>({
    date: todayIso(),
    roundId: prefilledRoundId,
    holeNumber: prefilledHole ? Number(prefilledHole) : undefined,
  });

  // Prefill with round date if roundId provided
  React.useEffect(() => {
    if (!prefilledRoundId) return;
    void getRound(prefilledRoundId).then((r) => {
      if (r) setDraft((d) => ({ ...d, date: r.date, roundId: r.id }));
    });
  }, [prefilledRoundId]);

  if (shots === undefined) return <div className="muted">Loading…</div>;

  const filtered = shots.filter((s) => filter === "all" || s.outcome === filter);

  const saveIt = async () => {
    if (!draft.description?.trim()) return;
    await saveMemorableShot({
      description: draft.description.trim(),
      date: draft.date ?? todayIso(),
      roundId: draft.roundId,
      holeNumber: draft.holeNumber,
      lie: draft.lie,
      outcome: draft.outcome,
      tags: draft.tags,
    });
    setShowForm(false);
    setDraft({ date: todayIso() });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await deleteMemorableShot(id);
  };

  const courseName = (roundId?: string) => {
    if (!roundId) return null;
    const r = rounds?.find((x) => x.id === roundId);
    if (!r) return null;
    return courses?.find((c) => c.id === r.courseId)?.name ?? null;
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="h1">Notes</div>
          <div className="muted text-sm mt-1">
            Memorable shots and observations — add qualitative context to the numbers.
          </div>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> New note
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardHeader title="New note" />
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Date">
              <Input
                type="date"
                value={draft.date ?? todayIso()}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </Field>
            <Field label="Round (optional)">
              <select
                className="select"
                value={draft.roundId ?? ""}
                onChange={(e) => setDraft({ ...draft, roundId: e.target.value || undefined })}
              >
                <option value="">—</option>
                {(rounds ?? []).map((r) => {
                  const cn = courses?.find((c) => c.id === r.courseId)?.name ?? "(course)";
                  return (
                    <option key={r.id} value={r.id}>
                      {r.date} • {cn}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Hole # (optional)">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={18}
                value={draft.holeNumber ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    holeNumber: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Lie (optional)" className="md:col-span-3">
              <div className="flex flex-wrap gap-1.5">
                <Chip
                  active={!draft.lie}
                  onClick={() => setDraft({ ...draft, lie: undefined })}
                >
                  —
                </Chip>
                {LIES.map((lie) => (
                  <Chip
                    key={lie}
                    active={draft.lie === lie}
                    onClick={() => setDraft({ ...draft, lie: lie as Lie })}
                  >
                    {LIE_LABELS[lie]}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Outcome" className="md:col-span-3">
              <div className="flex gap-1.5 flex-wrap">
                {(["great", "learning", "bad"] as const).map((o) => (
                  <Chip
                    key={o}
                    active={draft.outcome === o}
                    onClick={() =>
                      setDraft({ ...draft, outcome: draft.outcome === o ? undefined : o })
                    }
                  >
                    {o}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Description*" className="md:col-span-3">
              <Textarea
                rows={4}
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Flushed a 7-iron from 165 out of a flyer lie, ended pin high…"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveIt} disabled={!draft.description?.trim()}>
              Save note
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex items-center gap-2">
        <Filter size={14} className="muted" />
        <span className="text-xs muted uppercase tracking-wider">Filter</span>
        {(["all", "great", "learning", "bad"] as const).map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<NotebookText size={36} />}
          title="No notes yet"
          description="Log memorable shots, breakthroughs, or things to remember."
          action={<Button variant="primary" onClick={() => setShowForm(true)}><Plus size={14} /> New note</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium">{formatDate(n.date)}</span>
                    {n.outcome ? (
                      <span
                        className={
                          n.outcome === "great"
                            ? "badge"
                            : n.outcome === "bad"
                            ? "badge badge-danger"
                            : "badge badge-warn"
                        }
                      >
                        {n.outcome}
                      </span>
                    ) : null}
                    {n.lie ? <span className="badge badge-muted">{LIE_LABELS[n.lie]}</span> : null}
                    {n.holeNumber ? <span className="badge badge-muted">Hole {n.holeNumber}</span> : null}
                    {courseName(n.roundId) ? (
                      <Link href={`/rounds/${n.roundId}`} className="link text-sm">
                        {courseName(n.roundId)}
                      </Link>
                    ) : null}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{n.description}</div>
                </div>
                <Button variant="ghost" onClick={() => remove(n.id)} title="Delete">
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
