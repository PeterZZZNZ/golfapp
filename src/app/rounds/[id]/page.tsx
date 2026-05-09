"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import {
  deleteRound,
  getCourse,
  getRound,
  listMemorableShots,
} from "@/lib/db/repo";
import { RoundDetailContent } from "@/components/round/RoundDetailContent";

export default function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = React.use(params);
  const round = useLiveQuery(() => getRound(id), [id], undefined);
  const course = useLiveQuery(
    () => (round ? getCourse(round.courseId) : Promise.resolve(undefined)),
    [round?.courseId],
    undefined
  );
  const shots = useLiveQuery(() => listMemorableShots(), [], []);

  if (round === undefined || course === undefined)
    return <div className="muted">Loading…</div>;
  if (!round)
    return (
      <div>
        <Link href="/rounds" className="link inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Rounds
        </Link>
        <div className="mt-3 muted">Round not found.</div>
      </div>
    );
  if (!course)
    return (
      <div>
        <Link href="/rounds" className="link inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Rounds
        </Link>
        <div className="mt-3 muted">Course for this round was deleted.</div>
      </div>
    );

  return (
    <RoundDetailContent
      round={round}
      course={course}
      memorableShots={shots ?? []}
      actions={{
        backHref: "/rounds",
        backLabel: "Rounds",
        editHref: `/rounds/new?resume=${round.id}`,
        onDelete: async () => {
          if (!confirm("Delete this round?")) return;
          await deleteRound(round.id);
          router.push("/rounds");
        },
      }}
    />
  );
}
