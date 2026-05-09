"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/firebase/auth";
import { roleAllowsCoach } from "@/lib/firebase/profiles";
import {
  deletePairingCode,
  generatePairingCode,
  loadPairedPlayers,
  revokePairing,
} from "@/lib/firebase/pairing";
import {
  PAIRING_CODE_TTL_MS,
  type PairingCode,
} from "@/lib/firebase/types";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/lib/firebase/types";

export default function CoachDashboardPage() {
  const auth = useAuth();
  const isCoach = roleAllowsCoach(auth.profile?.role);

  if (auth.status === "loading") {
    return <div className="muted">Loading…</div>;
  }
  if (auth.status === "anon") {
    return (
      <div className="max-w-md mx-auto py-6">
        <Card>
          <CardHeader
            title="Sign in to access the coach dashboard"
            subtitle="Coaches manage their players from this page."
          />
          <Link href="/auth?next=/coach" className="btn btn-primary w-full">
            Sign in
          </Link>
        </Card>
      </div>
    );
  }
  if (!isCoach) {
    return (
      <div className="max-w-md mx-auto py-6">
        <Card>
          <CardHeader
            title="Coach mode is off"
            subtitle="Switch your role to “Coach” or “Both” on your account."
          />
          <Link href="/account" className="btn btn-primary w-full">
            Go to account
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <CoachDashboardInner
      key={auth.user.uid}
      user={auth.user}
      profile={auth.profile}
    />
  );
}

function CoachDashboardInner({
  user,
  profile,
}: {
  user: User;
  profile: UserProfile | null;
}) {
  const [activeCode, setActiveCode] = React.useState<PairingCode | null>(null);
  const [now, setNow] = React.useState<number>(() => Date.now());
  const [codeMsg, setCodeMsg] = React.useState<string | null>(null);
  const [codeBusy, setCodeBusy] = React.useState(false);

  const [players, setPlayers] = React.useState<
    Awaited<ReturnType<typeof loadPairedPlayers>>
  >([]);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [playersLoaded, setPlayersLoaded] = React.useState(false);

  // Tick once a second while a code is active. Inside the interval callback
  // we both update `now` (drives the countdown) and clear the code on expiry
  // — neither is a sync setState in the effect body.
  React.useEffect(() => {
    if (!activeCode) return;
    const expiresAt = activeCode.expiresAt.toMillis();
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= expiresAt) setActiveCode(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCode]);

  // Load paired players. Only async work happens here; setState lives inside
  // the .then() callback so the rule is satisfied.
  React.useEffect(() => {
    let cancelled = false;
    loadPairedPlayers(user.uid)
      .then((list) => {
        if (cancelled) return;
        setPlayers(list);
        setPlayersLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setPlayersLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user.uid, refreshKey]);

  async function generate() {
    setCodeBusy(true);
    setCodeMsg(null);
    try {
      const code = await generatePairingCode({
        coachId: user.uid,
        coachDisplayName: profile?.displayName ?? user.displayName ?? "Coach",
      });
      setActiveCode(code);
    } catch (err) {
      setCodeMsg(err instanceof Error ? err.message : "Could not create a code.");
    } finally {
      setCodeBusy(false);
    }
  }

  async function cancelCode() {
    if (!activeCode) return;
    try {
      await deletePairingCode(activeCode.code);
    } catch {
      // Security rules may forbid delete after redemption — that's fine.
    }
    setActiveCode(null);
  }

  const remainingMs = activeCode
    ? Math.max(0, activeCode.expiresAt.toMillis() - now)
    : 0;
  const remainingMin = Math.floor(remainingMs / 60000);
  const remainingSec = Math.floor((remainingMs % 60000) / 1000);

  return (
    <div className="space-y-5 fade-in">
      <div>
        <div className="h1">Coach dashboard</div>
        <div className="muted text-sm mt-1">
          Pair with your players and track their progress.
        </div>
      </div>

      <Card className="space-y-3">
        <CardHeader
          title="Pair a new player"
          subtitle="Generate a 6-character code and share it with them. It's good for 10 minutes."
        />

        {activeCode ? (
          <div className="space-y-2">
            <div
              className="card-2 px-4 py-5 text-center font-mono"
              style={{
                fontSize: "2rem",
                letterSpacing: "0.4em",
              }}
            >
              {activeCode.code}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="muted">
                Expires in{" "}
                <span className="num">
                  {remainingMin.toString().padStart(2, "0")}:
                  {remainingSec.toString().padStart(2, "0")}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(activeCode.code)
                      .then(() => setCodeMsg("Copied to clipboard."));
                  }}
                >
                  Copy
                </Button>
                <Button variant="danger" onClick={cancelCode}>
                  Cancel code
                </Button>
              </div>
            </div>
            <div className="muted text-xs">
              Tell your player to go to <span className="kbd">/pair</span> and
              enter this code.
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={generate} disabled={codeBusy}>
              {codeBusy ? "Generating…" : "Generate pairing code"}
            </Button>
            <span className="muted text-sm">
              Single-use • {Math.round(PAIRING_CODE_TTL_MS / 60000)} minute
              expiry
            </span>
          </div>
        )}

        {codeMsg ? (
          <div className="muted text-sm">{codeMsg}</div>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <CardHeader
          title="Your players"
          subtitle={
            !playersLoaded
              ? "Loading…"
              : `${players.length} paired player${players.length === 1 ? "" : "s"}`
          }
          right={
            <Button
              variant="ghost"
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              Refresh
            </Button>
          }
        />

        {playersLoaded && players.length === 0 ? (
          <div className="muted text-sm">
            No players paired yet. Generate a code above and share it with a
            player to get started.
          </div>
        ) : (
          <ul className="space-y-2">
            {players.map(({ pairing, profile: pp }) => (
              <li
                key={pairing.id}
                className="card-2 px-3 py-2 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-medium">
                    {pp?.displayName ??
                      pairing.playerDisplayName ??
                      "Player"}
                  </div>
                  <div className="muted text-xs">
                    {pp?.email ? `${pp.email} • ` : ""}
                    Paired{" "}
                    {pairing.pairedAt.toDate().toLocaleDateString()}
                    {pp?.handicap != null ? ` • HCP ${pp.handicap}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/coach/players/${pairing.playerId}`}
                    className="btn btn-secondary"
                  >
                    View
                  </Link>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      if (!confirm("Remove this player from your roster?"))
                        return;
                      await revokePairing({
                        coachId: pairing.coachId,
                        playerId: pairing.playerId,
                      });
                      setPlayers((list) =>
                        list.filter((x) => x.pairing.id !== pairing.id)
                      );
                    }}
                  >
                    Unpair
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
