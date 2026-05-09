"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/firebase/auth";
import {
  PairingRedeemError,
  redeemPairingCode,
} from "@/lib/firebase/pairing";
import { PAIRING_CODE_LENGTH } from "@/lib/firebase/types";

const ERROR_MESSAGES: Record<PairingRedeemError["reason"], string> = {
  "not-found": "We couldn't find that code. Double-check the characters.",
  expired: "That code has expired. Ask your coach to generate a fresh one.",
  "already-used": "That code has already been used.",
  "self-pair": "You can't pair with your own coach account.",
  "already-paired": "You're already paired with this coach.",
  unknown: "Something went wrong. Try again.",
};

export default function PairPage() {
  const router = useRouter();
  const auth = useAuth();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{
    coachName: string;
  } | null>(null);

  if (auth.status === "loading") {
    return <div className="muted">Loading…</div>;
  }
  if (auth.status === "anon") {
    return (
      <div className="max-w-md mx-auto py-6">
        <Card>
          <CardHeader
            title="Sign in to pair with a coach"
            subtitle="You'll need an account so your coach can find your stats."
          />
          <Link
            href="/auth?next=/pair"
            className="btn btn-primary w-full"
          >
            Sign in
          </Link>
        </Card>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) return;
    setError(null);
    setBusy(true);
    try {
      const pairing = await redeemPairingCode({
        rawCode: code,
        playerId: auth.user.uid,
        playerDisplayName:
          auth.profile?.displayName ?? auth.user.displayName ?? "Player",
      });
      setDone({ coachName: pairing.coachDisplayName ?? "your coach" });
    } catch (err) {
      if (err instanceof PairingRedeemError) {
        setError(ERROR_MESSAGES[err.reason]);
      } else {
        setError(err instanceof Error ? err.message : ERROR_MESSAGES.unknown);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-6 fade-in">
      <Card>
        <CardHeader
          title="Pair with your coach"
          subtitle="Enter the 6-character code your coach gave you."
        />

        {done ? (
          <div className="space-y-3">
            <div className="badge w-full justify-start">
              Paired with {done.coachName}.
            </div>
            <div className="muted text-sm">
              They can now view (and soon edit) your rounds. You can manage
              this from your account at any time.
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => router.push("/account")}
              >
                Go to account
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setDone(null);
                  setCode("");
                }}
              >
                Pair another
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Field label="Pairing code">
              <Input
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z2-9]/g, "")
                      .slice(0, PAIRING_CODE_LENGTH)
                  )
                }
                placeholder="e.g. 4B9K2X"
                maxLength={PAIRING_CODE_LENGTH}
                style={{
                  letterSpacing: "0.4em",
                  fontFamily: "var(--font-mono)",
                  fontSize: "1.1rem",
                }}
                autoComplete="one-time-code"
                inputMode="text"
              />
            </Field>
            {error ? (
              <div className="badge badge-danger w-full justify-start">
                {error}
              </div>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={busy || code.length !== PAIRING_CODE_LENGTH}
            >
              {busy ? "Pairing…" : "Pair"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
