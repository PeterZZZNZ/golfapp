"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAuth } from "@/lib/firebase/auth";
import { roleAllowsCoach } from "@/lib/firebase/profiles";
import {
  getCourseForPlayer,
  getRoundForPlayer,
} from "@/lib/firebase/sync";
import { RoundDetailContent } from "@/components/round/RoundDetailContent";
import type { Course, Round } from "@/lib/types";

export default function CoachRoundDetailPage() {
  const auth = useAuth();
  const params = useParams<{ playerId: string; roundId: string }>();
  const playerId = params?.playerId;
  const roundId = params?.roundId;

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
        <CardHeader title="Coach mode is off" />
        <Link href="/account" className="btn btn-primary">
          Account
        </Link>
      </Card>
    );
  }
  if (!playerId || !roundId) return <div className="muted">Invalid URL.</div>;

  return (
    <CoachRoundDetailContent
      key={`${auth.user.uid}__${playerId}__${roundId}`}
      coachUid={auth.user.uid}
      playerId={playerId}
      roundId={roundId}
    />
  );
}

type State =
  | { kind: "loading" }
  | { kind: "ok"; round: Round; course: Course }
  | { kind: "error"; message: string };

function CoachRoundDetailContent({
  coachUid,
  playerId,
  roundId,
}: {
  coachUid: string;
  playerId: string;
  roundId: string;
}) {
  const [state, setState] = React.useState<State>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const round = await getRoundForPlayer(coachUid, playerId, roundId);
        if (!round) {
          if (!cancelled) setState({ kind: "error", message: "Round not found." });
          return;
        }
        const course = await getCourseForPlayer(coachUid, playerId, round.courseId);
        if (!course) {
          if (!cancelled)
            setState({ kind: "error", message: "Course data unavailable." });
          return;
        }
        if (!cancelled) setState({ kind: "ok", round, course });
      } catch (err) {
        if (!cancelled)
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Failed to load.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachUid, playerId, roundId]);

  if (state.kind === "loading") return <div className="muted">Loading…</div>;
  if (state.kind === "error") {
    return (
      <div>
        <Link
          href={`/coach/players/${playerId}`}
          className="link text-sm inline-flex items-center gap-1"
        >
          ← Player
        </Link>
        <div className="mt-3 muted">{state.message}</div>
      </div>
    );
  }

  return (
    <RoundDetailContent
      round={state.round}
      course={state.course}
      memorableShots={[]}
      actions={{
        backHref: `/coach/players/${playerId}`,
        backLabel: "Player",
        // Coaches can view but not edit/delete in phase 2.
      }}
    />
  );
}
