"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/firebase/auth";

type Mode = "signin" | "signup";

export default function AuthPage() {
  return (
    <React.Suspense
      fallback={<div className="muted text-sm py-6 text-center">Loading…</div>}
    >
      <AuthInner />
    </React.Suspense>
  );
}

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/invalid-email": "That email address looks invalid.",
  "auth/missing-password": "Please enter a password.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/email-already-in-use":
    "That email is already registered. Try signing in.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/user-not-found": "No account exists for that email.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/operation-not-allowed":
    "This sign-in method isn't enabled in Firebase yet. Enable it in Authentication → Sign-in method.",
};

function describeError(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
  ) {
    const code = (err as { code: string }).code;
    return FIREBASE_ERRORS[code] ?? code;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Try again.";
}

function AuthInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/account";
  const auth = useAuth();

  const [mode, setMode] = React.useState<Mode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** After a successful sign-up we show a brief welcome screen before redirecting. */
  const [justSignedUp, setJustSignedUp] = React.useState(false);

  // Auto-redirect once authenticated.
  // - New users (onboarded === false/undefined) → /onboard first.
  // - Returning users → the `next` param (default /account).
  // Skip when justSignedUp — welcome screen handles the redirect manually.
  React.useEffect(() => {
    if (auth.status !== "authed" || justSignedUp) return;
    const needsOnboarding = !auth.profile?.onboarded;
    router.replace(needsOnboarding ? "/onboard" : next);
  }, [auth.status, auth.profile?.onboarded, justSignedUp, next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await auth.signUpEmail(email, password, displayName || undefined);
        setJustSignedUp(true);
      } else {
        await auth.signInEmail(email, password);
        // redirect handled by the effect above
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await auth.signInGoogle();
      // redirect handled by effect
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  // Welcome / confirmation screen shown right after sign-up.
  if (justSignedUp) {
    const name = displayName.trim() || email.split("@")[0];
    return (
      <div className="max-w-md mx-auto py-6 fade-in">
        <Card className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-full bg-[var(--accent-soft)] grid place-items-center mx-auto"
            style={{ fontSize: "2rem" }}
          >
            🏌️
          </div>
          <div>
            <div className="h1">Welcome, {name}!</div>
            <div className="muted text-sm mt-1">
              Your account is ready. Set your role, fill in a few details, and
              you&apos;re good to go.
            </div>
          </div>
          <div className="space-y-2 text-sm text-left">
            <div className="card-2 p-3 flex items-start gap-3">
              <span>👤</span>
              <div>
                <div className="font-medium">Complete your profile</div>
                <div className="muted">
                  Add your handicap, role (player / coach / both), and home
                  course.
                </div>
              </div>
            </div>
            <div className="card-2 p-3 flex items-start gap-3">
              <span>🏌️</span>
              <div>
                <div className="font-medium">Log your first round</div>
                <div className="muted">
                  Your existing local rounds will be synced to the cloud
                  automatically.
                </div>
              </div>
            </div>
            <div className="card-2 p-3 flex items-start gap-3">
              <span>🤝</span>
              <div>
                <div className="font-medium">Pair with a coach (optional)</div>
                <div className="muted">
                  Your coach can generate a 6-char code for you to enter at
                  /pair.
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => router.replace("/onboard")}
          >
            Get started →
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-6 fade-in">
      <Card>
        <CardHeader
          title={mode === "signup" ? "Create your account" : "Welcome back"}
          subtitle={
            mode === "signup"
              ? "Track your rounds and pair with a coach."
              : "Sign in to sync rounds and connect with your coach."
          }
        />

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" ? (
            <Field label="Display name">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                autoComplete="name"
              />
            </Field>
          ) : null}

          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={mode === "signup" ? "email" : "username"}
              required
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={6}
              required
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
            disabled={busy}
            className="w-full"
          >
            {busy
              ? "…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="hairline flex-1" />
          <span className="muted text-xs uppercase tracking-wider">or</span>
          <div className="hairline flex-1" />
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={handleGoogle}
          className="w-full"
        >
          Continue with Google
        </Button>

        <div className="text-sm muted mt-4 text-center">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="link"
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button
                type="button"
                className="link"
                onClick={() => setMode("signup")}
              >
                Create an account
              </button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
