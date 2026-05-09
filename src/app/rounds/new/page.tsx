"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Check,
  Save,
  Zap,
  Gauge,
  Target,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import {
  getRound,
  getSettings,
  listCourses,
  saveRound,
  saveSettings,
} from "@/lib/db/repo";
import type {
  Course,
  EntryMode,
  Round,
  RoundHighlight,
  RoundHole,
  SelfGrade,
} from "@/lib/types";
import { GRADE_LABELS } from "@/lib/types";
import { todayIso, uid, cn, fmtScoreToPar } from "@/lib/util";
import { CoursePickerModal } from "@/components/CoursePickerModal";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { QuickEntryGrid } from "@/components/round/QuickEntryGrid";
import { FullShotEntry } from "@/components/round/FullShotEntry";
import { summarizeRound } from "@/lib/stats";
import {
  displayTempValue,
  distLabel,
  puttLabel,
  roundStorageFahrenheit,
  tempLabel,
  tempToF,
  useUnits,
} from "@/lib/units";

type Step = "setup" | "entry" | "wrap";

function makeInitialHoles(course: Course, teeName?: string): RoundHole[] {
  return course.holes.map((h) => ({
    holeNumber: h.holeNumber,
    teeName,
    shots: [],
  }));
}

function buildDraft(courseId: string | undefined, preselectedMode: EntryMode = "quick"): Round {
  const now = Date.now();
  return {
    id: uid(),
    courseId: courseId ?? "",
    date: todayIso(),
    entryMode: preselectedMode,
    holes: [],
    isDraft: true,
    createdAt: now,
    updatedAt: now,
  };
}

export default function NewRoundPage() {
  return (
    <Suspense fallback={<div className="muted">Loading…</div>}>
      <NewRoundInner />
    </Suspense>
  );
}

function NewRoundInner() {
  const router = useRouter();
  const search = useSearchParams();
  const units = useUnits();
  const resumeId = search.get("resume");
  const preselectCourseId = search.get("courseId") ?? undefined;

  const courses = useLiveQuery(() => listCourses(), [], []);
  const resumed = useLiveQuery(
    () => (resumeId ? getRound(resumeId) : Promise.resolve(undefined)),
    [resumeId],
    undefined
  );

  const [round, setRound] = React.useState<Round | null>(null);
  const [step, setStep] = React.useState<Step>("setup");
  const [saving, setSaving] = React.useState(false);
  const [coursePickerOpen, setCoursePickerOpen] = React.useState(false);

  // Initialize round once data is ready
  React.useEffect(() => {
    if (round) return;
    if (resumeId && resumed === undefined) return;
    if (resumeId && resumed) {
      setRound(resumed);
      setStep("entry");
      return;
    }
    if (!resumeId) {
      setRound(buildDraft(preselectCourseId));
    }
  }, [round, resumed, resumeId, preselectCourseId]);

  const course = courses?.find((c) => c.id === round?.courseId);

  // Toggle distance unit (yd ↔ m) — updates global settings so the change
  // persists across rounds and matches what's shown in the stats page.
  const toggleDistUnit = async () => {
    const s = await getSettings();
    const next = s.units === "m" ? "yd" : ("m" as const);
    await saveSettings({ ...s, units: next });
  };

  // Sync holes with chosen course
  React.useEffect(() => {
    if (!round) return;
    if (!course) return;
    if (round.holes.length === 0 || round.holes.length !== course.holes.length) {
      setRound({
        ...round,
        holes: makeInitialHoles(course, round.teePlayed),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  // Auto-save draft (debounced) whenever round changes
  const lastSavedRef = React.useRef<number>(0);
  React.useEffect(() => {
    if (!round || !round.courseId) return;
    const handle = window.setTimeout(() => {
      void saveRound({ ...round, isDraft: true });
      lastSavedRef.current = Date.now();
    }, 600);
    return () => window.clearTimeout(handle);
  }, [round]);

  if (!round || courses === undefined) {
    return <div className="muted">Loading…</div>;
  }

  const setField = <K extends keyof Round>(key: K, value: Round[K]) =>
    setRound({ ...round, [key]: value });

  const onFinish = async () => {
    setSaving(true);
    try {
      await saveRound({ ...round, isDraft: false });
      router.push(`/rounds/${round.id}`);
    } finally {
      setSaving(false);
    }
  };

  const onSaveAndExit = async () => {
    setSaving(true);
    try {
      await saveRound({ ...round, isDraft: true });
      router.push(`/rounds`);
    } finally {
      setSaving(false);
    }
  };

  // ---------------- SETUP STEP ----------------
  if (step === "setup") {
    const setupValid =
      !!round.courseId && !!round.date && !!round.entryMode && !!round.teePlayed;
    return (
      <div className="space-y-5 fade-in">
        <Header backHref="/rounds">Start a round</Header>

        <Card>
          <CardHeader title="Course" />
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Course*">
              <button
                type="button"
                className={cn(
                  "select text-left w-full truncate",
                  !course && "text-[var(--muted)]"
                )}
                onClick={() => setCoursePickerOpen(true)}
              >
                {course ? course.name : "Select a course…"}
              </button>
            </Field>
            <Field label="Date*">
              <Input
                type="date"
                value={round.date}
                onChange={(e) => setField("date", e.target.value)}
              />
            </Field>
            <Field label="Title (optional)" className="md:col-span-2">
              <Input
                value={round.title ?? ""}
                onChange={(e) => setField("title", e.target.value || undefined)}
                placeholder="Saturday solo round"
              />
            </Field>
          </div>
        </Card>

        <CoursePickerModal
          open={coursePickerOpen}
          onClose={() => setCoursePickerOpen(false)}
          localCourses={courses ?? []}
          onSelect={(c) => {
            setField("courseId", c.id);
          }}
        />

        {course ? (
          <Card>
            <CardHeader title="Tees" subtitle="Which tees are you playing?" />
            <div className="flex flex-wrap gap-1.5">
              {course.tees.map((t) => (
                <Chip
                  key={t.name}
                  active={round.teePlayed === t.name}
                  onClick={() => setField("teePlayed", t.name)}
                >
                  {t.name}
                </Chip>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="How detailed today?"
            subtitle="You can switch modes per round. More detail = deeper stats."
          />
          <div className="grid md:grid-cols-3 gap-3">
            <ModeCard
              active={round.entryMode === "quick"}
              onClick={() => setField("entryMode", "quick")}
              icon={<Zap size={18} />}
              name="Quick"
              time="~60s"
              unlocks="Score, FIR%, GIR%, putts"
            />
            <ModeCard
              active={round.entryMode === "standard"}
              onClick={() => setField("entryMode", "standard")}
              icon={<Gauge size={18} />}
              name="Standard"
              time="~5 min"
              unlocks="+ drive distance, scrambling, sand saves"
            />
            <ModeCard
              active={round.entryMode === "full-shot"}
              onClick={() => setField("entryMode", "full-shot")}
              icon={<Target size={18} />}
              name="Full shots"
              time="~15 min"
              unlocks="+ Strokes Gained, proximity, every shot"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Conditions (optional)" />
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Weather">
              <Input
                value={round.conditions?.weather ?? ""}
                onChange={(e) =>
                  setField("conditions", {
                    ...round.conditions,
                    weather: e.target.value || undefined,
                  })
                }
                placeholder="Sunny, cloudy…"
              />
            </Field>
            <Field label={`Temp (${tempLabel(units.temp)})`}>
              <Input
                type="number"
                inputMode="numeric"
                value={
                  typeof round.conditions?.tempF === "number"
                    ? displayTempValue(round.conditions.tempF, units.temp)
                    : ""
                }
                onChange={(e) =>
                  setField("conditions", {
                    ...round.conditions,
                    tempF:
                      e.target.value === ""
                        ? undefined
                        : roundStorageFahrenheit(
                            tempToF(Number(e.target.value), units.temp)
                          ),
                  })
                }
              />
            </Field>
            <Field label="Wind (mph)">
              <Input
                type="number"
                inputMode="numeric"
                value={round.conditions?.windMph ?? ""}
                onChange={(e) =>
                  setField("conditions", {
                    ...round.conditions,
                    windMph: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Course firmness">
              <div className="flex gap-1.5">
                {(["firm", "soft", "wet"] as const).map((f) => (
                  <Chip
                    key={f}
                    active={round.conditions?.courseFirmness === f}
                    onClick={() =>
                      setField("conditions", {
                        ...round.conditions,
                        courseFirmness:
                          round.conditions?.courseFirmness === f ? undefined : f,
                      })
                    }
                  >
                    {f}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onSaveAndExit} disabled={saving || !round.courseId}>
            <Save size={14} /> Save & exit
          </Button>
          <Button
            variant="primary"
            disabled={!setupValid}
            onClick={() => setStep("entry")}
          >
            Continue <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    );
  }

  // ---------------- ENTRY STEP ----------------
  if (step === "entry") {
    if (!course) {
      return <div className="muted">Course not found.</div>;
    }
    const onHolesChange = (holes: RoundHole[]) =>
      setRound({ ...round, holes });
    return (
      <div className="space-y-5 fade-in">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Header backHref="/rounds" onBack={() => setStep("setup")}>
            {course.name}
            <span className="muted font-normal text-sm ml-2">
              {round.date} • {round.teePlayed} • {round.entryMode}
            </span>
          </Header>

          {/* Quick unit toggle — persists to global settings */}
          <button
            type="button"
            className="btn btn-secondary !py-1.5 !px-3 text-xs shrink-0 self-end"
            onClick={toggleDistUnit}
            title="Toggle distance unit"
          >
            {distLabel(units.dist)} / {units.dist === "m" ? "yd" : "m"} · {puttLabel(units.putt)}
          </button>
        </div>

        <Card>
          {round.entryMode === "full-shot" ? (
            <FullShotEntry course={course} holes={round.holes} onChange={onHolesChange} />
          ) : (
            <QuickEntryGrid
              course={course}
              holes={round.holes}
              onChange={onHolesChange}
              showStandard={round.entryMode === "standard"}
            />
          )}
        </Card>

        <div className="flex justify-between gap-2">
          <Button variant="secondary" onClick={() => setStep("setup")}>
            <ChevronLeft size={14} /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onSaveAndExit} disabled={saving}>
              <Save size={14} /> Save & exit
            </Button>
            <Button variant="primary" onClick={() => setStep("wrap")}>
              Continue <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- WRAP STEP ----------------
  const summary = course ? summarizeRound(round, course) : null;
  const grades = round.postRound?.grades ?? {};
  const setGrade = (k: keyof SelfGrade, v: number | undefined) =>
    setField("postRound", {
      ...round.postRound,
      grades: { ...grades, [k]: v },
    });

  const bestShots = round.postRound?.bestShots ?? [];
  const worstShots = round.postRound?.worstShots ?? [];
  const setHighlights = (
    kind: "bestShots" | "worstShots",
    next: RoundHighlight[]
  ) =>
    setField("postRound", {
      ...round.postRound,
      [kind]: next.length ? next : undefined,
    });

  return (
    <div className="space-y-5 fade-in">
      <Header backHref="/rounds" onBack={() => setStep("entry")}>
        Wrap up
      </Header>

      {summary ? (
        <Card>
          <CardHeader title="Round summary" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <Tile label="Score" value={summary.totalScore ?? "—"} />
            <Tile
              label="To par"
              value={summary.scoreToPar !== null ? fmtScoreToPar(summary.scoreToPar) : "—"}
            />
            <Tile
              label="FIR"
              value={summary.firs.attempts ? `${summary.firs.made}/${summary.firs.attempts}` : "—"}
            />
            <Tile
              label="GIR"
              value={summary.girs.attempts ? `${summary.girs.made}/${summary.girs.attempts}` : "—"}
            />
            <Tile label="Putts" value={summary.putts.measuredHoles ? summary.putts.total : "—"} />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="How did each area feel?"
          subtitle="Rate 1 = Poor, 5 = Excellent. We'll show you how your read compared to the numbers on the round page."
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {(
            [
              ["driving", "Driving"],
              ["approach", "Approach"],
              ["shortGame", "Short game"],
              ["putting", "Putting"],
              ["mental", "Mental"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <div className="label">{label}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Chip
                    key={n}
                    active={grades[key] === n}
                    onClick={() => setGrade(key, grades[key] === n ? undefined : n)}
                    className="!py-1 !px-2.5 min-w-8 justify-center"
                    title={GRADE_LABELS[n as 1 | 2 | 3 | 4 | 5]}
                  >
                    {n}
                  </Chip>
                ))}
              </div>
              {typeof grades[key] === "number" ? (
                <div className="muted text-xs mt-1">
                  {GRADE_LABELS[grades[key] as 1 | 2 | 3 | 4 | 5]}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Self-reflection"
          subtitle="Quick, honest answers. You'll compare them against the numbers on the round page."
        />
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="What I was proud of">
            <Textarea
              rows={3}
              placeholder="Shots, decisions, or moments that went the way I wanted."
              value={round.postRound?.wentWell ?? ""}
              onChange={(e) =>
                setField("postRound", {
                  ...round.postRound,
                  wentWell: e.target.value || undefined,
                })
              }
            />
          </Field>
          <Field label="What I want to work on">
            <Textarea
              rows={3}
              placeholder="The one or two patterns I want to fix first."
              value={round.postRound?.needsWork ?? ""}
              onChange={(e) =>
                setField("postRound", {
                  ...round.postRound,
                  needsWork: e.target.value || undefined,
                })
              }
            />
          </Field>
          <Field label="What surprised me">
            <Textarea
              rows={3}
              placeholder="Something unexpected — good or bad."
              value={round.postRound?.surprised ?? ""}
              onChange={(e) =>
                setField("postRound", {
                  ...round.postRound,
                  surprised: e.target.value || undefined,
                })
              }
            />
          </Field>
          <Field label="What I learned">
            <Textarea
              rows={3}
              placeholder="A takeaway I can carry to the range or the next round."
              value={round.postRound?.learned ?? ""}
              onChange={(e) =>
                setField("postRound", {
                  ...round.postRound,
                  learned: e.target.value || undefined,
                })
              }
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Shots of the day"
          subtitle="Two best, two worst — the ones you want to remember."
        />
        <div className="grid md:grid-cols-2 gap-4">
          <HighlightList
            title="Two best shots"
            accent="good"
            items={bestShots}
            onChange={(next) => setHighlights("bestShots", next)}
          />
          <HighlightList
            title="Two worst shots"
            accent="bad"
            items={worstShots}
            onChange={(next) => setHighlights("worstShots", next)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Takeaway + goal" />
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Key takeaway">
            <Textarea
              rows={2}
              placeholder="One sentence that sums up the round."
              value={round.postRound?.keyTakeaway ?? ""}
              onChange={(e) =>
                setField("postRound", {
                  ...round.postRound,
                  keyTakeaway: e.target.value || undefined,
                })
              }
            />
          </Field>
          <Field label="Goal for next round / session">
            <Textarea
              rows={2}
              placeholder="A concrete focus, not a feeling."
              value={round.postRound?.goalForNext ?? ""}
              onChange={(e) =>
                setField("postRound", {
                  ...round.postRound,
                  goalForNext: e.target.value || undefined,
                })
              }
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Memorable shots (notebook)"
          subtitle="Want a richer log outside the round? Pin a shot to your notes."
          right={
            <Link
              href={`/notes?roundId=${round.id}`}
              className="btn btn-secondary !py-1.5 text-sm"
            >
              Log a shot
            </Link>
          }
        />
        <div className="muted text-sm">
          Opens the Notes page with this round preselected — use this for shots you want to revisit later across rounds.
        </div>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="secondary" onClick={() => setStep("entry")}>
          <ChevronLeft size={14} /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onSaveAndExit} disabled={saving}>
            <Save size={14} /> Save as draft
          </Button>
          <Button variant="primary" onClick={onFinish} disabled={saving}>
            <Check size={14} /> Finish round
          </Button>
        </div>
      </div>
    </div>
  );
}

function Header({
  children,
  backHref,
  onBack,
}: {
  children: React.ReactNode;
  backHref?: string;
  onBack?: () => void;
}) {
  return (
    <div>
      {onBack ? (
        <button onClick={onBack} className="link inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Back
        </button>
      ) : backHref ? (
        <Link href={backHref} className="link inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Back
        </Link>
      ) : null}
      <div className="h1 mt-1">{children}</div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  name,
  time,
  unlocks,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  name: string;
  time: string;
  unlocks: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "card p-4 text-left transition-colors",
        active
          ? "outline outline-2 outline-[var(--accent)] bg-[var(--accent-soft)]"
          : "hover:bg-[var(--surface-2)]"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(active ? "text-[var(--accent)]" : "text-[var(--muted)]")}>{icon}</span>
        <div className="font-semibold">{name}</div>
        <span className="badge badge-muted ml-auto">{time}</span>
      </div>
      <div className="muted text-xs">{unlocks}</div>
    </button>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card-2 p-3">
      <div className="muted text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-xl font-semibold num mt-1">{value}</div>
    </div>
  );
}

function HighlightList({
  title,
  accent,
  items,
  onChange,
}: {
  title: string;
  accent: "good" | "bad";
  items: RoundHighlight[];
  onChange: (next: RoundHighlight[]) => void;
}) {
  const max = 2;
  const setAt = (idx: number, patch: Partial<RoundHighlight>) => {
    const next = items.slice();
    next[idx] = { ...(next[idx] ?? { description: "" }), ...patch };
    onChange(next);
  };
  const removeAt = (idx: number) => {
    const next = items.slice();
    next.splice(idx, 1);
    onChange(next);
  };
  const add = () => {
    if (items.length >= max) return;
    onChange([...items, { description: "" }]);
  };
  const accentClass = accent === "good" ? "badge" : "badge badge-danger";
  const dotLabel = accent === "good" ? "Best" : "Worst";
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="label">{title}</div>
        {items.length < max ? (
          <button
            type="button"
            onClick={add}
            className="btn btn-secondary !py-1 !px-2 text-xs"
          >
            + Add
          </button>
        ) : null}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <button
            type="button"
            onClick={add}
            className="card-2 p-3 w-full text-left muted text-sm hover:bg-[var(--surface-2)]"
          >
            Add a {accent === "good" ? "best" : "worst"} shot…
          </button>
        ) : null}
        {items.map((h, idx) => (
          <div key={idx} className="card-2 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className={accentClass}>
                {dotLabel} #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="muted text-xs ml-auto hover:text-[var(--danger)]"
              >
                Remove
              </button>
            </div>
            <Textarea
              rows={2}
              placeholder={
                accent === "good"
                  ? "e.g. 7-iron from 165y into 12ft on #12 — pure strike."
                  : "e.g. pulled 5-iron from 190y into water on #7."
              }
              value={h.description}
              onChange={(e) => setAt(idx, { description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Hole #"
                value={h.holeNumber ?? ""}
                onChange={(e) =>
                  setAt(idx, {
                    holeNumber:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Shot #"
                value={h.shotNumber ?? ""}
                onChange={(e) =>
                  setAt(idx, {
                    shotNumber:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
