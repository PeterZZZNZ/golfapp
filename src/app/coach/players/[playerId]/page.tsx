"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAuth } from "@/lib/firebase/auth";
import { roleAllowsCoach, getUserProfile } from "@/lib/firebase/profiles";
import { listPairingsForCoach } from "@/lib/firebase/pairing";
import { listRoundsForPlayer } from "@/lib/firebase/sync";
import type { Pairing, UserProfile } from "@/lib/firebase/types";
import type { Round } from "@/lib/types";
import { formatDate, fmtScoreToPar } from "@/lib/util";
import { summarizeRound } from "@/lib/stats";
import type { Course } from "@/lib/types";
import { getCourseForPlayer } from "@/lib/firebase/sync";

export default function CoachPlayerPage() {
  const auth = useAuth();
  const params = useParams<{ playerId: string }>();
  const playerId = params?.playerId;

  if (auth.status === "loading") return <div className="muted">Loading…</div>;
  if (auth.status === "anon") {
    return (
      <Card>
        <CardHeader title="Sign in to continue" />
        <Link href="/auth" className="btn btn-primary">
          Sign in
        </Link>
      </Card>
    );
  }
  if (!roleAllowsCoach(auth.profile?.role)) {
    return (
      <Card>
        <CardHeader title="Coach mode is off" subtitle="Switch role on your account." />
        <Link href="/account" className="btn btn-primary">
          Go to account
        </Link>
      </Card>
    );
  }
  if (!playerId) return <div className="muted">No player specified.</div>;

  return (
    <CoachPlayerContent
      key={`${auth.user.uid}__${playerId}`}
      coachUid={auth.user.uid}
      playerId={playerId}
    />
  );
}

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ok";
      pairing: Pairing;
      profile: UserProfile | null;
      rounds: Round[];
      courseMap: Record<string, Course>;
    }
  | { kind: "forbidden" };

function CoachPlayerContent({
  coachUid,
  playerId,
}: {
  coachUid: string;
  playerId: string;
}) {
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pairings = await listPairingsForCoach(coachUid);
        const link = pairings.find((p) => p.playerId === playerId) ?? null;
        if (!link) {
          if (!cancelled) setState({ kind: "forbidden" });
          return;
        }
        const [profile, rounds] = await Promise.all([
          getUserProfile(playerId),
          listRoundsForPlayer(coachUid, playerId),
        ]);
        if (cancelled) return;

        // Batch-load unique courses referenced by these rounds.
        const courseIds = [...new Set(rounds.map((r) => r.courseId))];
        const courseEntries = await Promise.all(
          courseIds.map(async (cid) => {
            const c = await getCourseForPlayer(coachUid, playerId, cid);
            return [cid, c] as const;
          })
        );
        const courseMap: Record<string, Course> = {};
        for (const [id, c] of courseEntries) {
          if (c) courseMap[id] = c;
        }

        if (!cancelled) {
          setState({ kind: "ok", pairing: link, profile, rounds, courseMap });
        }
      } catch {
        if (!cancelled) setState({ kind: "forbidden" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachUid, playerId]);

  if (state.kind === "loading") return <div className="muted">Loading…</div>;
  if (state.kind === "forbidden") {
    return (
      <Card>
        <CardHeader
          title="Player not found"
          subtitle="You aren't paired with this player."
        />
        <Link href="/coach" className="btn btn-secondary">
          Back to dashboard
        </Link>
      </Card>
    );
  }

  const { profile, pairing, rounds, courseMap } = state;
  const nonDraft = rounds.filter((r) => !r.isDraft);

  return (
    <div className="space-y-5 fade-in">
      <div>
        <div className="muted text-sm">
          <Link href="/coach" className="link">
            ← Coach dashboard
          </Link>
        </div>
        <div className="h1 mt-1">
          {profile?.displayName ?? pairing.playerDisplayName ?? "Player"}
        </div>
        <div className="muted text-sm mt-1">
          {profile?.email ?? ""}
          {profile?.handicap != null ? ` • HCP ${profile.handicap}` : ""}
          {profile?.location ? ` • ${profile.location}` : ""}
          {` • Paired ${pairing.pairedAt.toDate().toLocaleDateString()}`}
        </div>
      </div>

      {nonDraft.length === 0 ? (
        <Card>
          <CardHeader
            title="No rounds yet"
            subtitle="This player hasn't completed any rounds yet, or their data hasn't synced."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Rounds"
            subtitle={`${nonDraft.length} completed round${nonDraft.length === 1 ? "" : "s"}`}
          />
          <ul className="space-y-2">
            {nonDraft.map((r) => {
              const course = courseMap[r.courseId];
              const summary = course ? summarizeRound(r, course) : null;
              return (
                <li key={r.id}>
                  <Link
                    href={`/coach/players/${playerId}/rounds/${r.id}`}
                    className="card-2 px-3 py-2 flex items-center justify-between gap-3 hover:bg-[var(--surface-2)] transition-colors block"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {course?.name ?? r.courseId}
                        {r.title ? ` — ${r.title}` : ""}
                      </div>
                      <div className="muted text-xs mt-0.5">
                        {formatDate(r.date)}
                        {r.teePlayed ? ` • ${r.teePlayed} tees` : ""}
                        {` • ${r.entryMode}`}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {summary?.totalScore !== null && summary !== null ? (
                        <span className="badge badge-muted num">
                          {summary.totalScore}
                          {summary.scoreToPar !== null
                            ? ` (${fmtScoreToPar(summary.scoreToPar)})`
                            : ""}
                        </span>
                      ) : null}
                      <span className="muted text-sm">→</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
