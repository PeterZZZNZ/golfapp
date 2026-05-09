"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { listCourses, listRounds } from "@/lib/db/repo";
import { aggregate } from "@/lib/stats";
import type { Course, Round } from "@/lib/types";
import {
  APPROACH_BUCKETS,
  PUTT_BUCKETS,
  approachBreakdown,
  drivingBreakdown,
  puttingBreakdown,
  trendsOverRounds,
} from "@/lib/stats/breakdowns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { cn, formatDate, signed } from "@/lib/util";
import {
  approachBucketLabel,
  formatDist,
  formatPutt,
  puttBucketLabel,
  puttLabel,
  useUnits,
  type DistUnit,
  type PuttUnit,
} from "@/lib/units";

type Tab = "overview" | "sg" | "approach" | "short" | "putting" | "driving";

type DatePreset = "30d" | "90d" | "ytd" | "12mo" | "all";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns [fromIso, toIso] for a given preset. `toIso` is always today. */
function presetRange(preset: DatePreset): { from: string; to: string } | null {
  if (preset === "all") return null;
  const now = new Date();
  const to = toIsoDate(now);
  if (preset === "ytd") {
    return { from: `${now.getFullYear()}-01-01`, to };
  }
  const start = new Date(now);
  if (preset === "30d") start.setDate(start.getDate() - 30);
  else if (preset === "90d") start.setDate(start.getDate() - 90);
  else if (preset === "12mo") start.setFullYear(start.getFullYear() - 1);
  return { from: toIsoDate(start), to };
}

export default function StatsPage() {
  const rounds = useLiveQuery(() => listRounds(), [], []);
  const courses = useLiveQuery(() => listCourses(), [], []);
  const units = useUnits();
  const [tab, setTab] = React.useState<Tab>("overview");
  const [window, setWindow] = React.useState<number | "all">(20);
  const [courseFilter, setCourseFilter] = React.useState<string | "all">("all");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");

  if (rounds === undefined || courses === undefined)
    return <div className="muted">Loading…</div>;

  const nonDraft = rounds.filter((r) => !r.isDraft);
  const dateFiltered = nonDraft.filter((r) => {
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    return true;
  });
  const filtered = dateFiltered
    .filter((r) => courseFilter === "all" || r.courseId === courseFilter)
    .slice(0, window === "all" ? undefined : window);

  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const agg = aggregate(filtered, coursesById);

  // Detect which preset (if any) matches the current date range, so we can
  // highlight it. A custom range leaves all presets inactive.
  const activePreset: DatePreset | null = (() => {
    if (!fromDate && !toDate) return "all";
    const presets: DatePreset[] = ["30d", "90d", "ytd", "12mo"];
    for (const p of presets) {
      const r = presetRange(p);
      if (r && r.from === fromDate && r.to === toDate) return p;
    }
    return null;
  })();

  const applyPreset = (p: DatePreset) => {
    const r = presetRange(p);
    if (!r) {
      setFromDate("");
      setToDate("");
    } else {
      setFromDate(r.from);
      setToDate(r.to);
    }
  };

  if (nonDraft.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={36} />}
        title="Nothing to chart yet"
        description="Log at least one round to see your stats here."
        action={<Link href="/rounds/new" className="btn btn-primary">Log a round</Link>}
      />
    );
  }

  // Human-readable range label for the header subtitle.
  const rangeLabel: string | null = (() => {
    if (fromDate && toDate) return `${formatDate(fromDate)} → ${formatDate(toDate)}`;
    if (fromDate) return `from ${formatDate(fromDate)}`;
    if (toDate) return `through ${formatDate(toDate)}`;
    return null;
  })();

  return (
    <div className="space-y-5 fade-in">
      <div>
        <div className="h1">Stats</div>
        <div className="muted text-sm mt-1">
          Based on {filtered.length} round{filtered.length === 1 ? "" : "s"}
          {rangeLabel ? ` • ${rangeLabel}` : ""}
          {courseFilter !== "all"
            ? ` • ${courses.find((c) => c.id === courseFilter)?.name ?? ""}`
            : ""}
          .
        </div>
      </div>

      <Card className="!p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-xs muted uppercase tracking-wider mr-1">
            Date range
          </div>
          {(
            [
              ["30d", "30 days"],
              ["90d", "90 days"],
              ["ytd", "YTD"],
              ["12mo", "12 months"],
              ["all", "All time"],
            ] as [DatePreset, string][]
          ).map(([k, label]) => (
            <Chip
              key={k}
              active={activePreset === k}
              onClick={() => applyPreset(k)}
            >
              {label}
            </Chip>
          ))}
          <div className="flex items-center gap-1.5 ml-1">
            <Input
              type="date"
              className="!py-1.5 w-[155px]"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
            />
            <span className="muted text-sm">→</span>
            <Input
              type="date"
              className="!py-1.5 w-[155px]"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
            />
            {fromDate || toDate ? (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="btn btn-ghost !py-1 !px-2 text-xs"
                title="Clear date range"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-xs muted uppercase tracking-wider mr-1">
            Window
          </div>
          {[5, 10, 20, "all" as const].map((w) => (
            <Chip key={String(w)} active={window === w} onClick={() => setWindow(w)}>
              {w === "all" ? "All" : `Last ${w}`}
            </Chip>
          ))}
          <div className="w-px h-5 bg-[var(--border)] mx-2" />
          <div className="text-xs muted uppercase tracking-wider mr-1">Course</div>
          <select
            className="select !py-1.5 w-auto"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="muted text-xs">
          {dateFiltered.length === 0
            ? "No rounds match this date range."
            : `${filtered.length} of ${dateFiltered.length} round${
                dateFiltered.length === 1 ? "" : "s"
              } shown after window + course filters.`}
        </div>
      </Card>

      <div className="card p-1 inline-flex gap-1 flex-wrap">
        {(
          [
            ["overview", "Overview"],
            ["sg", "Strokes Gained"],
            ["approach", "Approach"],
            ["short", "Short Game"],
            ["putting", "Putting"],
            ["driving", "Driving"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "btn !py-1.5 !px-3 text-sm",
              tab === k ? "btn-primary" : "btn-ghost"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <OverviewTab rounds={filtered} coursesById={coursesById} agg={agg} distUnit={units.dist} />
      ) : tab === "sg" ? (
        <SgTab agg={agg} rounds={filtered} coursesById={coursesById} />
      ) : tab === "approach" ? (
        <ApproachTab rounds={filtered} coursesById={coursesById} distUnit={units.dist} puttUnit={units.putt} />
      ) : tab === "short" ? (
        <ShortGameTab agg={agg} />
      ) : tab === "putting" ? (
        <PuttingTab rounds={filtered} coursesById={coursesById} puttUnit={units.putt} />
      ) : (
        <DrivingTab rounds={filtered} coursesById={coursesById} distUnit={units.dist} />
      )}
    </div>
  );
}

function OverviewTab({
  rounds,
  coursesById,
  agg,
  distUnit,
}: {
  rounds: Round[];
  coursesById: Map<string, Course>;
  distUnit: DistUnit;
  agg: ReturnType<typeof aggregate>;
}) {
  const trend = trendsOverRounds(rounds, coursesById);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile
          label="Avg score"
          value={agg.avgScore ? agg.avgScore.toFixed(1) : "—"}
          sub={
            agg.avgScoreToPar !== null
              ? `${agg.avgScoreToPar > 0 ? "+" : ""}${agg.avgScoreToPar.toFixed(1)}`
              : undefined
          }
        />
        <Tile label="FIR" value={agg.firPct !== null ? `${agg.firPct.toFixed(0)}%` : "—"} />
        <Tile label="GIR" value={agg.girPct !== null ? `${agg.girPct.toFixed(0)}%` : "—"} />
        <Tile label="Putts / round" value={agg.avgPutts ? agg.avgPutts.toFixed(1) : "—"} />
        <Tile
          label="Scrambling"
          value={agg.scramblingPct !== null ? `${agg.scramblingPct.toFixed(0)}%` : "—"}
        />
        <Tile
          label="Sand saves"
          value={agg.sandSavePct !== null ? `${agg.sandSavePct.toFixed(0)}%` : "—"}
        />
        <Tile
          label="Avg drive"
          value={
            agg.avgDriveDistance
              ? formatDist(agg.avgDriveDistance, distUnit)
              : "—"
          }
        />
        <Tile
          label="3-putts / round"
          value={agg.threePuttsPerRound !== null ? agg.threePuttsPerRound.toFixed(1) : "—"}
        />
      </div>

      {trend.length > 1 && trend.some((p) => p.scoreToPar !== null) ? (
        <Card>
          <CardHeader title="Score trend" subtitle="Lower is better." />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={0} stroke="var(--muted-2)" />
                <Line
                  type="monotone"
                  dataKey="scoreToPar"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                  name="Score to par"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function SgTab({
  agg,
  rounds,
  coursesById,
}: {
  agg: ReturnType<typeof aggregate>;
  rounds: Round[];
  coursesById: Map<string, Course>;
}) {
  const trend = trendsOverRounds(rounds, coursesById);
  if (!agg.sgPerRound) {
    return (
      <Card>
        <CardHeader title="Strokes gained" />
        <div className="muted text-sm">
          No rounds with full shot tracking in this window. Log a round in Full-Shot mode to unlock.
        </div>
      </Card>
    );
  }
  const rows = [
    { k: "offTee" as const, label: "Off the tee" },
    { k: "approach" as const, label: "Approach" },
    { k: "aroundGreen" as const, label: "Around the green" },
    { k: "putting" as const, label: "Putting" },
    { k: "total" as const, label: "Total" },
  ];
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={`SG per round (avg of ${agg.sgRoundsCount})`}
          subtitle="vs an implicit tour baseline, bundled with the app."
        />
        <div className="hscroll">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">SG / round</th>
                <th className="text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = agg.sgPerRound![r.k];
                return (
                  <tr key={r.k} className={r.k === "total" ? "font-medium" : ""}>
                    <td>{r.label}</td>
                    <td
                      className="text-right num"
                      style={{ color: v < 0 ? "var(--danger)" : "var(--accent)" }}
                    >
                      {signed(v)}
                    </td>
                    <td className="text-right">
                      <span
                        className={
                          v >= 0.5
                            ? "badge"
                            : v >= 0
                            ? "badge badge-muted"
                            : v >= -1
                            ? "badge badge-warn"
                            : "badge badge-danger"
                        }
                      >
                        {v >= 0.5
                          ? "strong"
                          : v >= 0
                          ? "neutral"
                          : v >= -1
                          ? "room to grow"
                          : "biggest opportunity"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {trend.filter((t) => t.sgTotal !== null).length > 1 ? (
        <Card>
          <CardHeader title="SG total trend" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.filter((t) => t.sgTotal !== null)}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={0} stroke="var(--muted-2)" />
                <Line
                  type="monotone"
                  dataKey="sgTotal"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ApproachTab({
  rounds,
  coursesById,
  distUnit,
  puttUnit,
}: {
  rounds: Round[];
  coursesById: Map<string, Course>;
  distUnit: DistUnit;
  puttUnit: PuttUnit;
}) {
  const data = approachBreakdown(rounds, coursesById);
  const hasAny = data.some((d) => d.fromFairway + d.fromRough > 0);
  if (!hasAny) {
    return (
      <Card>
        <CardHeader title="Approach" />
        <div className="muted text-sm">
          Log shots with full tracking to see approach proximity and green-in-one-shot rates by distance.
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="Approach by distance"
        subtitle={`Proximity is measured in ${puttLabel(puttUnit)} from the hole after the shot.`}
      />
      <div className="hscroll">
        <table className="table">
          <thead>
            <tr>
              <th>Distance</th>
              <th className="text-right">Attempts</th>
              <th className="text-right">From FW</th>
              <th className="text-right">From rough</th>
              <th className="text-right">Green hit %</th>
              <th className="text-right">Avg proximity</th>
              <th className="text-right">Std dev</th>
              <th className="text-right">Avg SG</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const b = APPROACH_BUCKETS[i];
              const label = b
                ? approachBucketLabel(b.min, b.max, distUnit)
                : r.label;
              return (
              <tr key={r.label}>
                <td className="font-medium">{label}</td>
                <td className="text-right num">{r.fromFairway + r.fromRough}</td>
                <td className="text-right num">{r.fromFairway}</td>
                <td className="text-right num">{r.fromRough}</td>
                <td className="text-right num">
                  {r.greenHitPct !== null ? `${r.greenHitPct.toFixed(0)}%` : "—"}
                </td>
                <td className="text-right num">
                  {r.avgProximity !== null
                    ? formatPutt(r.avgProximity, puttUnit)
                    : "—"}
                </td>
                <td className="text-right num">
                  {r.stdProximity !== null ? r.stdProximity.toFixed(1) : "—"}
                </td>
                <td
                  className="text-right num"
                  style={{
                    color:
                      r.avgSg !== null
                        ? r.avgSg < 0
                          ? "var(--danger)"
                          : "var(--accent)"
                        : undefined,
                  }}
                >
                  {r.avgSg !== null ? signed(r.avgSg) : "—"}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ShortGameTab({ agg }: { agg: ReturnType<typeof aggregate> }) {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Tile
        label="Scrambling"
        value={agg.scramblingPct !== null ? `${agg.scramblingPct.toFixed(0)}%` : "—"}
        sub="Par or better after missing GIR"
      />
      <Tile
        label="Sand saves"
        value={agg.sandSavePct !== null ? `${agg.sandSavePct.toFixed(0)}%` : "—"}
        sub="Up & down from bunker"
      />
      <Tile
        label="3-putts / round"
        value={agg.threePuttsPerRound !== null ? agg.threePuttsPerRound.toFixed(1) : "—"}
      />
    </div>
  );
}

function PuttingTab({
  rounds,
  coursesById,
  puttUnit,
}: {
  rounds: Round[];
  coursesById: Map<string, Course>;
  puttUnit: PuttUnit;
}) {
  const data = puttingBreakdown(rounds, coursesById);
  const hasAny = data.some((d) => d.attempts > 0);
  if (!hasAny) {
    return (
      <Card>
        <CardHeader title="Putting" />
        <div className="muted text-sm">
          Log a round in Full-Shot mode to see make rates by distance.
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Make rate by distance" />
      <div className="hscroll">
        <table className="table">
          <thead>
            <tr>
              <th>Distance</th>
              <th className="text-right">Attempts</th>
              <th className="text-right">Made</th>
              <th className="text-right">Make %</th>
              <th className="text-right">Avg SG</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const b = PUTT_BUCKETS[i];
              const label = b ? puttBucketLabel(b.min, b.max, puttUnit) : r.label;
              return (
              <tr key={r.label}>
                <td className="font-medium">{label}</td>
                <td className="text-right num">{r.attempts}</td>
                <td className="text-right num">{r.made}</td>
                <td className="text-right num">
                  {r.makePct !== null ? `${r.makePct.toFixed(0)}%` : "—"}
                </td>
                <td
                  className="text-right num"
                  style={{
                    color:
                      r.avgSg !== null
                        ? r.avgSg < 0
                          ? "var(--danger)"
                          : "var(--accent)"
                        : undefined,
                  }}
                >
                  {r.avgSg !== null ? signed(r.avgSg) : "—"}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DrivingTab({
  rounds,
  coursesById,
  distUnit,
}: {
  rounds: Round[];
  coursesById: Map<string, Course>;
  distUnit: DistUnit;
}) {
  const d = drivingBreakdown(rounds, coursesById);
  if (d.count === 0) {
    return (
      <Card>
        <CardHeader title="Driving" />
        <div className="muted text-sm">
          No tee shots tracked in this window.
        </div>
      </Card>
    );
  }
  return (
    <div className="grid md:grid-cols-4 gap-3">
      <Tile
        label="Avg distance"
        value={d.avgDistance !== null ? formatDist(d.avgDistance, distUnit) : "—"}
      />
      <Tile label="FIR" value={d.firPct !== null ? `${d.firPct.toFixed(0)}%` : "—"} />
      <Tile label="Miss left" value={d.missLeft} />
      <Tile label="Miss right" value={d.missRight} />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="muted text-xs uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold num mt-1">{value}</div>
      {sub ? <div className="muted text-xs mt-0.5">{sub}</div> : null}
    </div>
  );
}
