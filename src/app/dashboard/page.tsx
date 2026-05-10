"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Flag, Plus, Sparkles } from "lucide-react";
import { listRounds, listCourses } from "@/lib/db/repo";
import { aggregate, summarizeRound } from "@/lib/stats";
import { fmtScoreToPar, formatDate, signed } from "@/lib/util";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DashboardPage() {
  const rounds = useLiveQuery(() => listRounds(), [], []);
  const courses = useLiveQuery(() => listCourses(), [], []);

  if (rounds === undefined || courses === undefined) {
    return <div className="muted">Loading…</div>;
  }

  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const last10 = rounds.filter((r) => !r.isDraft).slice(0, 10);
  const agg = aggregate(last10, coursesById);
  const lastRound = last10[0];
  const lastCourse = lastRound ? coursesById.get(lastRound.courseId) : undefined;
  const lastSummary = lastRound && lastCourse ? summarizeRound(lastRound, lastCourse) : null;

  const firstRun = rounds.length === 0 && courses.length === 0;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="h1">Dashboard</div>
          <div className="muted text-sm mt-1">
            {rounds.length === 0
              ? "No rounds logged yet."
              : `Based on your last ${last10.length} round${last10.length === 1 ? "" : "s"}.`}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/rounds/new" className="btn btn-primary">
            <Plus size={16} /> New round
          </Link>
        </div>
      </div>

      {firstRun ? (
        <EmptyState
          icon={<Flag size={36} />}
          title="Welcome to Golf Tracker"
          description="Start by adding your home course, then log a round. Everything is stored locally on this device."
          action={
            <div className="flex gap-2">
              <Link href="/courses/new" className="btn btn-primary">Add a course</Link>
              <Link href="/rounds/new" className="btn btn-secondary">New round</Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Avg score"
              value={agg.avgScore ? agg.avgScore.toFixed(1) : "—"}
              sub={
                agg.avgScoreToPar !== null
                  ? fmtScoreToPar(Math.round(agg.avgScoreToPar * 10) / 10)
                  : undefined
              }
            />
            <StatTile
              label="FIR"
              value={agg.firPct !== null ? `${agg.firPct.toFixed(0)}%` : "—"}
            />
            <StatTile
              label="GIR"
              value={agg.girPct !== null ? `${agg.girPct.toFixed(0)}%` : "—"}
            />
            <StatTile
              label="Putts / round"
              value={agg.avgPutts ? agg.avgPutts.toFixed(1) : "—"}
            />
          </div>

          {agg.sgPerRound ? (
            <Card>
              <CardHeader
                title="Strokes gained (avg per round)"
                subtitle={`From ${agg.sgRoundsCount} round${agg.sgRoundsCount === 1 ? "" : "s"} with full shot data.`}
                right={
                  <Link href="/stats" className="link text-sm inline-flex items-center gap-1">
                    See more <ArrowRight size={14} />
                  </Link>
                }
              />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SgBar label="Off tee" value={agg.sgPerRound.offTee} />
                <SgBar label="Approach" value={agg.sgPerRound.approach} />
                <SgBar label="Around green" value={agg.sgPerRound.aroundGreen} />
                <SgBar label="Putting" value={agg.sgPerRound.putting} />
                <SgBar label="Total" value={agg.sgPerRound.total} emphasized />
              </div>
            </Card>
          ) : null}

          <div className="grid md:grid-cols-2 gap-4">
            {lastRound && lastCourse && lastSummary ? (
              <Card>
                <CardHeader
                  title="Last round"
                  subtitle={`${lastCourse.name} • ${formatDate(lastRound.date)}`}
                  right={
                    <Link href={`/rounds/${lastRound.id}`} className="link text-sm inline-flex items-center gap-1">
                      Open <ArrowRight size={14} />
                    </Link>
                  }
                />
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <div className="text-3xl font-bold num">
                      {lastSummary.totalScore ?? "—"}
                    </div>
                    <div className="muted text-xs">
                      {lastSummary.scoreToPar !== null
                        ? fmtScoreToPar(lastSummary.scoreToPar)
                        : "no score"}
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="FIR" value={lastSummary.firs.attempts ? `${lastSummary.firs.made}/${lastSummary.firs.attempts}` : "—"} />
                    <MiniStat label="GIR" value={lastSummary.girs.attempts ? `${lastSummary.girs.made}/${lastSummary.girs.attempts}` : "—"} />
                    <MiniStat label="Putts" value={lastSummary.putts.measuredHoles ? String(lastSummary.putts.total) : "—"} />
                  </div>
                </div>
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Biggest opportunity" subtitle="Coming from the insights engine." right={<Sparkles size={16} className="text-[var(--accent)]" />} />
              <BiggestOpportunity agg={agg} />
              <Link href="/insights" className="link text-sm inline-flex items-center gap-1 mt-3">
                Open insights <ArrowRight size={14} />
              </Link>
            </Card>
          </div>

          <Card>
            <CardHeader title="Recent rounds" right={<Link href="/rounds" className="link text-sm inline-flex items-center gap-1">All <ArrowRight size={14} /></Link>} />
            {rounds.length === 0 ? (
              <div className="muted text-sm">No rounds yet.</div>
            ) : (
              <div className="hscroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Course</th>
                      <th>Mode</th>
                      <th className="text-right">Score</th>
                      <th className="text-right">To par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.slice(0, 5).map((r) => {
                      const c = coursesById.get(r.courseId);
                      const s = c ? summarizeRound(r, c) : null;
                      return (
                        <tr key={r.id}>
                          <td className="num">{formatDate(r.date)}</td>
                          <td>
                            <Link href={`/rounds/${r.id}`} className="link">
                              {c?.name ?? "—"}
                              {r.isDraft ? <span className="badge badge-warn ml-2">Draft</span> : null}
                            </Link>
                          </td>
                          <td>
                            <span className="badge badge-muted">{r.entryMode}</span>
                          </td>
                          <td className="text-right num">{s?.totalScore ?? "—"}</td>
                          <td className="text-right num">
                            {s?.scoreToPar !== null && s?.scoreToPar !== undefined ? fmtScoreToPar(s.scoreToPar) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="muted text-xs uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold num mt-1">{value}</div>
      {sub ? <div className="muted text-xs mt-0.5 num">{sub}</div> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted text-[10px] uppercase tracking-wider">{label}</div>
      <div className="font-semibold num">{value}</div>
    </div>
  );
}

function SgBar({ label, value, emphasized }: { label: string; value: number; emphasized?: boolean }) {
  const color = value >= 0 ? "var(--accent)" : "var(--danger)";
  const magnitude = Math.min(Math.abs(value) / 2, 1); // 2 strokes = full bar
  return (
    <div className={`card-2 p-3 ${emphasized ? "outline outline-1 outline-[var(--accent)]/30" : ""}`}>
      <div className="muted text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-xl font-semibold num mt-1" style={{ color }}>
        {signed(value)}
      </div>
      <div className="h-1.5 bg-[var(--border)] rounded-full mt-2 overflow-hidden relative">
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            background: color,
            width: `${magnitude * 50}%`,
            left: value >= 0 ? "50%" : `${50 - magnitude * 50}%`,
          }}
        />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--muted-2)]/50" />
      </div>
    </div>
  );
}

function BiggestOpportunity({ agg }: { agg: ReturnType<typeof aggregate> }) {
  if (!agg.sgPerRound) {
    if (agg.roundsCount === 0) {
      return <div className="muted text-sm">Log a round to see personalized insights.</div>;
    }
    const weakest = weakestArea(agg);
    return (
      <div className="text-sm">
        {weakest ? (
          <>Your weakest measured area is <strong>{weakest.label}</strong> at <span className="num">{weakest.value}</span>.</>
        ) : (
          <span className="muted">Add more detail on future rounds (standard or full-shot mode) to unlock deeper insights.</span>
        )}
      </div>
    );
  }
  const categories = [
    { key: "offTee" as const, label: "Off the tee" },
    { key: "approach" as const, label: "Approach" },
    { key: "aroundGreen" as const, label: "Around the green" },
    { key: "putting" as const, label: "Putting" },
  ];
  const worst = categories
    .map((c) => ({ ...c, value: agg.sgPerRound![c.key] }))
    .sort((a, b) => a.value - b.value)[0];
  return (
    <div className="text-sm">
      <strong>{worst.label}</strong> is your lowest SG category at{" "}
      <span className="num" style={{ color: worst.value < 0 ? "var(--danger)" : "var(--accent)" }}>
        {signed(worst.value)}
      </span>{" "}
      strokes per round. Work here to drop your scores fastest.
    </div>
  );
}

function weakestArea(agg: ReturnType<typeof aggregate>) {
  // Fallback when no SG data — pick lowest percentage vs simple targets
  const candidates = [
    agg.firPct !== null ? { label: "Fairways", value: `${agg.firPct.toFixed(0)}%`, score: agg.firPct / 60 } : null,
    agg.girPct !== null ? { label: "Greens in regulation", value: `${agg.girPct.toFixed(0)}%`, score: agg.girPct / 50 } : null,
    agg.avgPutts ? { label: "Putts / round", value: agg.avgPutts.toFixed(1), score: (40 - agg.avgPutts) / 10 } : null,
    agg.scramblingPct !== null ? { label: "Scrambling", value: `${agg.scramblingPct.toFixed(0)}%`, score: agg.scramblingPct / 50 } : null,
  ].filter(Boolean) as { label: string; value: string; score: number }[];
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}
