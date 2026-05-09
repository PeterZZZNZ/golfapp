"use client";

/**
 * Pure presentation component for a round's detail view.
 * Accepts fully-resolved `round`, `course`, and `memorableShots` — no data
 * fetching. Used by both the player's own round page (Dexie) and the coach's
 * player round page (Firestore).
 */
import * as React from "react";
import Link from "next/link";
import { NotebookText } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { computeHoleSg, holeScore, summarizeRound } from "@/lib/stats";
import {
  AREA_ORDER,
  assessRoundAreas,
  gradeLabel,
  roundDistanceBreakdowns,
} from "@/lib/stats/roundAreas";
import { fmtScoreToPar, formatDate, signed } from "@/lib/util";
import { GRADE_LABELS, LIE_LABELS } from "@/lib/types";
import { isPhysicalShot, shotTypeLabel, PENALTY_TYPE_LABELS } from "@/lib/shotMeta";
import type { Course, MemorableShot, Round, RoundHighlight } from "@/lib/types";

export type RoundDetailActions = {
  /** Back link label and href. Defaults to /rounds "Rounds" */
  backHref?: string;
  backLabel?: string;
  /** If provided, an Edit button is rendered. */
  editHref?: string;
  /** If provided, a Delete button is rendered. */
  onDelete?: () => void;
};

export function RoundDetailContent({
  round,
  course,
  memorableShots = [],
  actions = {},
}: {
  round: Round;
  course: Course;
  memorableShots?: MemorableShot[];
  actions?: RoundDetailActions;
}) {
  const {
    backHref = "/rounds",
    backLabel = "Rounds",
    editHref,
    onDelete,
  } = actions;

  const s = summarizeRound(round, course);
  const areaReport = assessRoundAreas(round, course);
  const roundBreakdowns = roundDistanceBreakdowns(round, course);
  const linkedShots = memorableShots.filter((m) => m.roundId === round.id);
  const pr = round.postRound;
  const bestShots = pr?.bestShots ?? [];
  const worstShots = pr?.worstShots ?? [];
  const hasReflectionText =
    !!pr?.wentWell ||
    !!pr?.needsWork ||
    !!pr?.surprised ||
    !!pr?.learned ||
    !!pr?.keyTakeaway ||
    !!pr?.goalForNext ||
    bestShots.length > 0 ||
    worstShots.length > 0;
  const hasAnyGrade =
    !!pr?.grades &&
    (["driving", "approach", "shortGame", "putting", "mental"] as const).some(
      (k) => typeof pr.grades?.[k] === "number"
    );

  return (
    <div className="space-y-5 fade-in">
      <div>
        <Link
          href={backHref}
          className="link inline-flex items-center gap-1 text-sm"
        >
          ← {backLabel}
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-2">
          <div>
            <div className="h1">
              {course.name}
              {round.isDraft ? (
                <span className="badge badge-warn ml-3">Draft</span>
              ) : null}
            </div>
            <div className="muted text-sm mt-1">
              {formatDate(round.date)}
              {round.title ? ` • ${round.title}` : ""}
              {round.teePlayed ? ` • ${round.teePlayed} tees` : ""}
              {` • ${round.entryMode} entry`}
            </div>
          </div>
          {editHref || onDelete ? (
            <div className="flex gap-2">
              {editHref ? (
                <Link href={editHref} className="btn btn-secondary">
                  ✎ Edit
                </Link>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={onDelete}
                >
                  🗑
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="Score" value={s.totalScore ?? "—"} />
        <Tile
          label="To par"
          value={s.scoreToPar !== null ? fmtScoreToPar(s.scoreToPar) : "—"}
        />
        <Tile
          label="FIR"
          value={s.firs.attempts ? `${s.firs.made}/${s.firs.attempts}` : "—"}
        />
        <Tile
          label="GIR"
          value={s.girs.attempts ? `${s.girs.made}/${s.girs.attempts}` : "—"}
        />
        <Tile
          label="Putts"
          value={s.putts.measuredHoles ? s.putts.total : "—"}
        />
      </div>

      {s.sg ? (
        <Card>
          <CardHeader title="Strokes gained (this round)" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <SgTile label="Off tee" v={s.sg.offTee} />
            <SgTile label="Approach" v={s.sg.approach} />
            <SgTile label="Around green" v={s.sg.aroundGreen} />
            <SgTile label="Putting" v={s.sg.putting} />
            <SgTile label="Total" v={s.sg.total} emphasized />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Scorecard" />
        <div className="hscroll">
          <table className="table">
            <thead>
              <tr>
                <th className="table-sticky">Hole</th>
                <th>Par</th>
                <th className="text-right">Score</th>
                <th className="text-right">vs par</th>
                <th className="text-right">Putts</th>
                <th className="text-right">FIR</th>
                <th className="text-right">GIR</th>
                {s.sg ? <th className="text-right">SG</th> : null}
              </tr>
            </thead>
            <tbody>
              {s.holes.map((h) => (
                <tr key={h.holeNumber}>
                  <td className="table-sticky num font-medium">{h.holeNumber}</td>
                  <td className="num">{h.par}</td>
                  <td className="text-right num">{h.score ?? "—"}</td>
                  <td className="text-right num">
                    {h.score !== null ? (
                      <span
                        style={{
                          color:
                            h.score - h.par > 0
                              ? "var(--danger)"
                              : h.score - h.par < 0
                              ? "var(--accent)"
                              : undefined,
                        }}
                      >
                        {fmtScoreToPar(h.score - h.par)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right num">{h.putts ?? "—"}</td>
                  <td className="text-right">{h.fir === null ? "—" : h.fir ? "Y" : "N"}</td>
                  <td className="text-right">{h.gir === null ? "—" : h.gir ? "Y" : "N"}</td>
                  {s.sg ? (
                    <td className="text-right num">
                      {h.sg ? (
                        <span
                          style={{
                            color: h.sg.total < 0 ? "var(--danger)" : "var(--accent)",
                          }}
                        >
                          {signed(h.sg.total)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
              <tr className="font-medium">
                <td className="table-sticky">Total</td>
                <td className="num">{s.par}</td>
                <td className="text-right num">{s.totalScore ?? "—"}</td>
                <td className="text-right num">
                  {s.scoreToPar !== null ? fmtScoreToPar(s.scoreToPar) : "—"}
                </td>
                <td className="text-right num">{s.putts.total}</td>
                <td className="text-right num">
                  {s.firs.attempts ? `${s.firs.made}/${s.firs.attempts}` : "—"}
                </td>
                <td className="text-right num">
                  {s.girs.attempts ? `${s.girs.made}/${s.girs.attempts}` : "—"}
                </td>
                {s.sg ? (
                  <td
                    className="text-right num"
                    style={{
                      color:
                        s.sg.total < 0 ? "var(--danger)" : "var(--accent)",
                    }}
                  >
                    {signed(s.sg.total)}
                  </td>
                ) : null}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {round.entryMode === "full-shot" && s.hasFullShots ? (
        <Card>
          <CardHeader title="Shot by shot" />
          <div className="space-y-3">
            {round.holes
              .filter((h) => h.shots.length > 0)
              .map((h) => {
                const par =
                  course.holes.find((c) => c.holeNumber === h.holeNumber)?.par ?? 4;
                const shotSg = computeHoleSg(h, par);
                const strokes = holeScore(h) ?? 0;
                let physIdx = -1;
                return (
                  <div key={h.holeNumber} className="card-2 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="font-semibold num">Hole {h.holeNumber}</div>
                      <span className="badge badge-muted">Par {par}</span>
                      <span className="badge">
                        {strokes} strokes ({fmtScoreToPar(strokes - par)})
                      </span>
                    </div>
                    <div className="hscroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Type</th>
                            <th>From</th>
                            <th className="text-right">Dist</th>
                            <th>Club</th>
                            <th className="text-right">Left after</th>
                            <th className="text-right">SG</th>
                          </tr>
                        </thead>
                        <tbody>
                          {h.shots.map((shot, i) => {
                            const physical = isPhysicalShot(shot);
                            if (physical) physIdx += 1;
                            const sg = physical ? shotSg[physIdx] : undefined;
                            if (!physical) {
                              return (
                                <tr key={i} className="opacity-80">
                                  <td className="num">—</td>
                                  <td>{shotTypeLabel(shot)}</td>
                                  <td colSpan={3}>
                                    {shot.penaltyType
                                      ? PENALTY_TYPE_LABELS[shot.penaltyType]
                                      : "Penalty"}
                                    {typeof shot.penaltyAfterShotNumber === "number"
                                      ? ` • after shot ${shot.penaltyAfterShotNumber}`
                                      : ""}
                                  </td>
                                  <td className="text-right num">
                                    +{shot.penaltyStrokes ?? 1}
                                  </td>
                                  <td className="text-right num">—</td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={i}>
                                <td className="num">{shot.shotNumber}</td>
                                <td>{shotTypeLabel(shot)}</td>
                                <td>{LIE_LABELS[shot.lie]}</td>
                                <td className="text-right num">
                                  {shot.distanceToHoleBefore} {shot.unit}
                                </td>
                                <td>{shot.club ?? "—"}</td>
                                <td className="text-right num">
                                  {shot.distanceToHoleAfter === 0
                                    ? "holed"
                                    : typeof shot.distanceToHoleAfter === "number"
                                    ? `${shot.distanceToHoleAfter} ${shot.unit}`
                                    : "—"}
                                </td>
                                <td className="text-right num">
                                  {sg ? (
                                    <span
                                      style={{
                                        color:
                                          sg.sg < 0
                                            ? "var(--danger)"
                                            : "var(--accent)",
                                      }}
                                    >
                                      {signed(sg.sg)}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {h.notes ? (
                      <div className="muted text-sm mt-2">{h.notes}</div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Your read vs the numbers"
          subtitle="How you graded each area, alongside the system's grade derived from this round's stats."
        />
        <div className="hscroll">
          <table className="table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Your grade</th>
                <th>System grade</th>
                <th>Delta</th>
                <th>Key numbers</th>
              </tr>
            </thead>
            <tbody>
              {AREA_ORDER.map((key) => {
                const a = areaReport[key];
                const self = pr?.grades?.[key];
                const delta =
                  typeof self === "number" && typeof a.grade === "number"
                    ? self - a.grade
                    : null;
                return (
                  <tr key={key}>
                    <td className="font-medium">{a.label}</td>
                    <td>
                      {typeof self === "number"
                        ? `${self}/5 • ${GRADE_LABELS[self as 1 | 2 | 3 | 4 | 5]}`
                        : "—"}
                    </td>
                    <td>
                      {a.grade === null
                        ? "—"
                        : `${a.grade}/5 • ${gradeLabel(a.grade)}`}
                    </td>
                    <td className="num">
                      {delta === null ? (
                        "—"
                      ) : delta === 0 ? (
                        <span className="muted">match</span>
                      ) : (
                        <span
                          style={{
                            color:
                              delta > 0 ? "var(--danger)" : "var(--accent)",
                          }}
                          title={
                            delta > 0
                              ? "You rated yourself higher than the numbers."
                              : "You rated yourself lower than the numbers."
                          }
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {a.metrics.slice(0, 3).map((m, mi) => (
                          <span key={mi} className="badge badge-muted">
                            {m.label}: {m.value}
                          </span>
                        ))}
                      </div>
                      <div className="muted text-xs mt-1">{a.summary}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!hasAnyGrade ? (
          <div className="muted text-sm mt-2">
            No self-grades saved for this round.
            {editHref ? (
              <>
                {" "}
                <Link href={editHref} className="link">
                  Add them
                </Link>
                .
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      {s.hasFullShots ? (
        <Card>
          <CardHeader
            title="Distance breakdown (this round)"
            subtitle="Approach and putting performance bucketed by distance for just this round."
          />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="label">Approaches</div>
              <div className="hscroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Range (yd)</th>
                      <th className="text-right">Shots</th>
                      <th className="text-right">Green hits</th>
                      <th className="text-right">Avg prox.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundBreakdowns.approach.map((b) => (
                      <tr key={b.label}>
                        <td className="num">{b.label}</td>
                        <td className="text-right num">{b.count}</td>
                        <td className="text-right num">
                          {b.count ? `${b.greenHits}/${b.count}` : "—"}
                        </td>
                        <td className="text-right num">
                          {b.avgProximityFt === null
                            ? "—"
                            : `${Math.round(b.avgProximityFt)} ft`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="label">Putting</div>
              <div className="hscroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Range</th>
                      <th className="text-right">Attempts</th>
                      <th className="text-right">Made</th>
                      <th className="text-right">Make %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundBreakdowns.putting.map((b) => (
                      <tr key={b.label}>
                        <td className="num">{b.label}</td>
                        <td className="text-right num">{b.attempts}</td>
                        <td className="text-right num">{b.made}</td>
                        <td className="text-right num">
                          {b.makePct === null
                            ? "—"
                            : `${Math.round(b.makePct)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {hasReflectionText || hasAnyGrade ? (
        <Card>
          <CardHeader
            title="Self-reflection"
            subtitle="Player's own notes from the wrap-up."
          />
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {pr?.wentWell ? (
              <NotesBlock title="What I was proud of" text={pr.wentWell} />
            ) : null}
            {pr?.needsWork ? (
              <NotesBlock title="What to work on" text={pr.needsWork} />
            ) : null}
            {pr?.surprised ? (
              <NotesBlock title="What surprised me" text={pr.surprised} />
            ) : null}
            {pr?.learned ? (
              <NotesBlock title="What I learned" text={pr.learned} />
            ) : null}
            {pr?.keyTakeaway ? (
              <NotesBlock title="Key takeaway" text={pr.keyTakeaway} />
            ) : null}
            {pr?.goalForNext ? (
              <NotesBlock title="Goal for next round" text={pr.goalForNext} />
            ) : null}
            {bestShots.length > 0 ? (
              <HighlightDisplay
                title="Two best shots"
                items={bestShots}
                accent="good"
              />
            ) : null}
            {worstShots.length > 0 ? (
              <HighlightDisplay
                title="Two worst shots"
                items={worstShots}
                accent="bad"
              />
            ) : null}
          </div>
        </Card>
      ) : null}

      {linkedShots.length > 0 ? (
        <Card>
          <CardHeader
            title="Memorable shots"
            right={
              <Link
                href="/notes"
                className="link text-sm inline-flex items-center gap-1"
              >
                <NotebookText size={14} /> All notes
              </Link>
            }
          />
          <ul className="space-y-2">
            {linkedShots.map((ms) => (
              <li key={ms.id} className="card-2 p-3">
                <div className="flex items-center gap-2 mb-1">
                  {ms.outcome ? (
                    <span
                      className={
                        ms.outcome === "great"
                          ? "badge"
                          : ms.outcome === "bad"
                          ? "badge badge-danger"
                          : "badge badge-warn"
                      }
                    >
                      {ms.outcome}
                    </span>
                  ) : null}
                  {ms.holeNumber ? (
                    <span className="badge badge-muted">
                      Hole {ms.holeNumber}
                    </span>
                  ) : null}
                  {ms.lie ? (
                    <span className="badge badge-muted">
                      {LIE_LABELS[ms.lie]}
                    </span>
                  ) : null}
                </div>
                <div className="text-sm">{ms.description}</div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="muted text-xs uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold num mt-1">{value}</div>
    </div>
  );
}

function SgTile({
  label,
  v,
  emphasized,
}: {
  label: string;
  v: number;
  emphasized?: boolean;
}) {
  const color = v >= 0 ? "var(--accent)" : "var(--danger)";
  return (
    <div
      className={`card-2 p-3 ${emphasized ? "outline outline-1 outline-[var(--accent)]/30" : ""}`}
    >
      <div className="muted text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-xl font-semibold num mt-1" style={{ color }}>
        {signed(v)}
      </div>
    </div>
  );
}

function NotesBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="label">{title}</div>
      <div className="whitespace-pre-wrap text-[var(--foreground)]">{text}</div>
    </div>
  );
}

function HighlightDisplay({
  title,
  items,
  accent,
}: {
  title: string;
  items: RoundHighlight[];
  accent: "good" | "bad";
}) {
  const badgeClass = accent === "good" ? "badge" : "badge badge-danger";
  return (
    <div>
      <div className="label">{title}</div>
      <ul className="space-y-2 mt-1">
        {items.map((h, i) => (
          <li key={i} className="card-2 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={badgeClass}>#{i + 1}</span>
              {typeof h.holeNumber === "number" ? (
                <span className="badge badge-muted">Hole {h.holeNumber}</span>
              ) : null}
              {typeof h.shotNumber === "number" ? (
                <span className="badge badge-muted">Shot {h.shotNumber}</span>
              ) : null}
            </div>
            <div className="whitespace-pre-wrap text-sm">{h.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
