"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Lightbulb, AlertTriangle, Info, Flag } from "lucide-react";
import { listCourses, listRounds } from "@/lib/db/repo";
import { generateInsights } from "@/lib/insights";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useUnits } from "@/lib/units";

const ICON = {
  high: AlertTriangle,
  medium: Lightbulb,
  low: Info,
};

const COLOR = {
  high: "var(--danger)",
  medium: "var(--accent)",
  low: "var(--muted)",
};

export default function InsightsPage() {
  const rounds = useLiveQuery(() => listRounds(), [], []);
  const courses = useLiveQuery(() => listCourses(), [], []);
  const units = useUnits();

  if (rounds === undefined || courses === undefined)
    return <div className="muted">Loading…</div>;

  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const insights = generateInsights(
    rounds.filter((r) => !r.isDraft),
    coursesById,
    { dist: units.dist, putt: units.putt }
  );

  if (rounds.filter((r) => !r.isDraft).length === 0) {
    return (
      <EmptyState
        icon={<Flag size={36} />}
        title="No insights yet"
        description="Log at least one round and we'll surface improvement opportunities."
        action={
          <Link href="/rounds/new" className="btn btn-primary">
            Log a round
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div>
        <div className="h1">Insights</div>
        <div className="muted text-sm mt-1">
          Data-driven suggestions. Every finding shows the numbers it's based on.
        </div>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardHeader title="No red flags in this window" />
          <div className="muted text-sm">
            We didn't find any category or pattern that's obviously hurting your score. Log more rounds (ideally in Full-Shot mode) to unlock deeper recommendations.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {insights.map((ins) => {
            const Icon = ICON[ins.severity];
            return (
              <Card key={ins.id}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full grid place-items-center shrink-0"
                    style={{
                      background: "color-mix(in srgb, " + COLOR[ins.severity] + " 14%, transparent)",
                      color: COLOR[ins.severity],
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="h2">{ins.title}</div>
                      <span
                        className={
                          ins.severity === "high"
                            ? "badge badge-danger"
                            : ins.severity === "medium"
                            ? "badge"
                            : "badge badge-muted"
                        }
                      >
                        {ins.severity}
                      </span>
                      <span className="badge badge-muted">{ins.category}</span>
                    </div>
                    <div className="mt-2 text-sm">{ins.summary}</div>
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-[var(--accent)] select-none">Evidence</summary>
                      <ul className="mt-2 list-disc pl-5 muted space-y-0.5">
                        {ins.evidence.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </details>
                    <div className="mt-3 text-sm card-2 p-3">
                      <span className="font-medium">Try this:</span> {ins.suggestion}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
