"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Pencil, Trash2, ExternalLink, Plus } from "lucide-react";
import { deleteCourse, getCourse, listRounds } from "@/lib/db/repo";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { sum } from "@/lib/util";
import { distFromYards, distLabel, useUnits } from "@/lib/units";
import { useAuth } from "@/lib/firebase/auth";
import {
  isPublished,
  publishCourse,
  unpublishCourse,
} from "@/lib/firebase/sync";

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const units = useUnits();
  const auth = useAuth();
  const { id } = React.use(params);
  const course = useLiveQuery(() => getCourse(id), [id], undefined);
  const rounds = useLiveQuery(() => listRounds(), [], []);
  const [published, setPublished] = React.useState<boolean | null>(null);
  const [publishBusy, setPublishBusy] = React.useState(false);

  React.useEffect(() => {
    if (auth.status !== "authed" || !id) return;
    let cancelled = false;
    isPublished(id)
      .then((v) => { if (!cancelled) setPublished(v); })
      .catch(() => { if (!cancelled) setPublished(false); });
    return () => { cancelled = true; };
  }, [auth.status, id]);

  if (course === undefined) return <div className="muted">Loading…</div>;
  if (!course) {
    return (
      <div>
        <Link href="/courses" className="link inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="mt-4 muted">Course not found.</div>
      </div>
    );
  }

  const totalPar = sum(course.holes.map((h) => h.par));
  const roundsForCourse = (rounds ?? []).filter((r) => r.courseId === course.id);

  const onDelete = async () => {
    if (!confirm("Delete this course? This cannot be undone. Rounds that reference it will stay but may not render fully.")) {
      return;
    }
    await deleteCourse(course.id);
    router.push("/courses");
  };

  return (
    <div className="space-y-5 fade-in">
      <div>
        <Link href="/courses" className="link inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Courses
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-2">
          <div>
            <div className="h1">{course.name}</div>
            <div className="muted text-sm mt-1 flex items-center gap-2">
              {course.location ? <span>{course.location}</span> : null}
              {course.location && course.sourceUrl ? <span>•</span> : null}
              {course.sourceUrl ? (
                <a
                  href={course.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link inline-flex items-center gap-1"
                >
                  Source <ExternalLink size={12} />
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {auth.status === "authed" && published !== null ? (
              <Button
                variant="secondary"
                disabled={publishBusy}
                onClick={async () => {
                  if (!course) return;
                  setPublishBusy(true);
                  try {
                    if (published) {
                      if (!confirm("Remove this course from the community library?")) return;
                      await unpublishCourse(course.id);
                      setPublished(false);
                    } else {
                      await publishCourse({
                        course,
                        contributorName:
                          auth.profile?.displayName ??
                          auth.user.displayName ??
                          "Anonymous",
                      });
                      setPublished(true);
                    }
                  } catch {
                    // ignore
                  } finally {
                    setPublishBusy(false);
                  }
                }}
              >
                {publishBusy
                  ? "…"
                  : published
                  ? "✓ In library"
                  : "Publish to library"}
              </Button>
            ) : null}
            <Link href={`/courses/${course.id}/edit`} className="btn btn-secondary">
              <Pencil size={14} /> Edit
            </Link>
            <Link href={`/rounds/new?courseId=${course.id}`} className="btn btn-primary">
              <Plus size={14} /> New round
            </Link>
            <Button variant="danger" onClick={onDelete}>
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Holes" value={course.holes.length} />
        <Tile label="Par" value={totalPar} />
        <Tile label="Tees" value={course.tees.length} />
        <Tile label="Rounds logged" value={roundsForCourse.length} />
      </div>

      <Card>
        <CardHeader title="Scorecard" />
        <div className="hscroll">
          <table className="table">
            <thead>
              <tr>
                <th className="table-sticky">Hole</th>
                <th>Par</th>
                <th>HCP</th>
                {course.tees.map((t) => (
                  <th key={t.name}>
                    {t.name} ({distLabel(units.dist)})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {course.holes.map((h) => (
                <tr key={h.holeNumber}>
                  <td className="table-sticky num font-medium">{h.holeNumber}</td>
                  <td className="num">{h.par}</td>
                  <td className="num">{h.handicapIndex ?? "—"}</td>
                  {course.tees.map((t) => {
                    const y = h.distances[t.name];
                    return (
                      <td key={t.name} className="num">
                        {typeof y === "number" && y > 0
                          ? Math.round(distFromYards(y, units.dist))
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="font-medium">
                <td className="table-sticky">Total</td>
                <td className="num">{totalPar}</td>
                <td></td>
                {course.tees.map((t) => (
                  <td key={t.name} className="num">
                    {Math.round(
                      distFromYards(
                        sum(course.holes.map((h) => h.distances[t.name] ?? 0)),
                        units.dist
                      )
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
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
