"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Flag } from "lucide-react";
import { listCourses, listRounds } from "@/lib/db/repo";
import { summarizeRound } from "@/lib/stats";
import { fmtScoreToPar, formatDate } from "@/lib/util";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function RoundsPage() {
  const rounds = useLiveQuery(() => listRounds(), [], undefined);
  const courses = useLiveQuery(() => listCourses(), [], []);

  const coursesById = new Map((courses ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="h1">Rounds</div>
          <div className="muted text-sm mt-1">Every round you've logged.</div>
        </div>
        <Link href="/rounds/new" className="btn btn-primary">
          <Plus size={16} /> New round
        </Link>
      </div>

      {rounds === undefined ? (
        <div className="muted">Loading…</div>
      ) : rounds.length === 0 ? (
        <EmptyState
          icon={<Flag size={36} />}
          title="No rounds yet"
          description="Log your first round to start tracking improvement."
          action={
            <Link href="/rounds/new" className="btn btn-primary">
              Log your first round
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader title={`${rounds.length} round${rounds.length === 1 ? "" : "s"}`} />
          <div className="hscroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Course</th>
                  <th>Title</th>
                  <th>Mode</th>
                  <th className="text-right">Score</th>
                  <th className="text-right">To par</th>
                  <th className="text-right">FIR</th>
                  <th className="text-right">GIR</th>
                  <th className="text-right">Putts</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => {
                  const c = coursesById.get(r.courseId);
                  const s = c ? summarizeRound(r, c) : null;
                  return (
                    <tr key={r.id}>
                      <td className="num">{formatDate(r.date)}</td>
                      <td>
                        <Link href={`/rounds/${r.id}`} className="link">
                          {c?.name ?? "(missing course)"}
                        </Link>
                        {r.isDraft ? <span className="badge badge-warn ml-2">Draft</span> : null}
                      </td>
                      <td className="muted">{r.title ?? "—"}</td>
                      <td>
                        <span className="badge badge-muted">{r.entryMode}</span>
                      </td>
                      <td className="text-right num">{s?.totalScore ?? "—"}</td>
                      <td className="text-right num">
                        {s?.scoreToPar !== null && s?.scoreToPar !== undefined
                          ? fmtScoreToPar(s.scoreToPar)
                          : "—"}
                      </td>
                      <td className="text-right num">
                        {s?.firs.attempts ? `${s.firs.made}/${s.firs.attempts}` : "—"}
                      </td>
                      <td className="text-right num">
                        {s?.girs.attempts ? `${s.girs.made}/${s.girs.attempts}` : "—"}
                      </td>
                      <td className="text-right num">
                        {s?.putts.measuredHoles ? s.putts.total : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
