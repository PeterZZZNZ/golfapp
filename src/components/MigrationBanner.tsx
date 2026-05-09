"use client";

/**
 * Shown once per uid, on first sign-in, if the user has local data that
 * hasn't been uploaded to Firestore yet. After upload it auto-dismisses.
 *
 * Placement: rendered inside <Shell> so it appears on every page during the
 * migration run.
 */
import * as React from "react";
import { useAuth } from "@/lib/firebase/auth";
import {
  hasLocalMigrated,
  migrateLocalToCloud,
} from "@/lib/firebase/sync";
import { listCourses, listRounds } from "@/lib/db/repo";

type State =
  | { phase: "idle" }
  | { phase: "migrating"; done: number; total: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

export function MigrationBanner() {
  const auth = useAuth();
  const [state, setState] = React.useState<State>({ phase: "idle" });

  React.useEffect(() => {
    if (auth.status !== "authed") return;
    const uid = auth.user.uid;
    let cancelled = false;

    (async () => {
      try {
        const already = await hasLocalMigrated(uid);
        if (already || cancelled) return;

        const [rounds, courses] = await Promise.all([
          listRounds(),
          listCourses(),
        ]);

        const total = rounds.length + courses.length;
        if (total === 0) {
          // Nothing to migrate; just stamp the flag.
          await migrateLocalToCloud({ uid, rounds: [], courses: [] });
          return;
        }

        if (cancelled) return;
        setState({ phase: "migrating", done: 0, total });

        await migrateLocalToCloud({
          uid,
          rounds,
          courses,
          onProgress: (done, t) => {
            if (!cancelled) setState({ phase: "migrating", done, total: t });
          },
        });

        if (!cancelled) {
          setState({ phase: "done" });
          setTimeout(() => {
            if (!cancelled) setState({ phase: "idle" });
          }, 4000);
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            phase: "error",
            message:
              err instanceof Error ? err.message : "Migration failed.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.user?.uid]);

  if (state.phase === "idle") return null;

  const bgClass =
    state.phase === "error"
      ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] border-[var(--danger)]"
      : state.phase === "done"
        ? "bg-[var(--accent-soft)] border-[var(--accent)]"
        : "bg-[var(--surface-2)] border-[var(--border)]";

  return (
    <div
      className={`border-b px-4 py-2 text-sm flex items-center justify-between gap-4 ${bgClass}`}
    >
      {state.phase === "migrating" ? (
        <span>
          ☁️ Uploading your local data to the cloud…{" "}
          <span className="num">
            {state.done}/{state.total}
          </span>
        </span>
      ) : state.phase === "done" ? (
        <span className="text-[var(--accent)] font-medium">
          ✓ All your data is now synced to the cloud.
        </span>
      ) : (
        <span className="text-[var(--danger)]">
          Cloud upload failed: {state.message}
        </span>
      )}
      {state.phase === "error" ? (
        <button
          type="button"
          className="muted text-xs underline"
          onClick={() => setState({ phase: "idle" })}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
