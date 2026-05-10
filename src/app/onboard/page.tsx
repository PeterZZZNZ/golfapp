"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth";
import { updateUserProfile } from "@/lib/firebase/profiles";
import type { UserRole } from "@/lib/firebase/types";

type Option = {
  role: UserRole;
  emoji: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  destination: string;
};

const OPTIONS: Option[] = [
  {
    role: "player",
    emoji: "🏌️",
    title: "I'm a player",
    description: "Track rounds, shots, and stats. Pair with a coach later.",
    bullets: [
      "Log every shot with detailed card types",
      "See strokes gained, FIR, GIR, and putting stats",
      "Self-reflection and post-round notes",
    ],
    cta: "Start tracking →",
    destination: "/rounds",
  },
  {
    role: "coach",
    emoji: "📋",
    title: "I'm a coach",
    description: "Build your coach profile and manage paired players' stats.",
    bullets: [
      "Public coach profile with credentials and bio",
      "Generate pairing codes for your players",
      "View every paired player's full round history",
    ],
    cta: "Set up coaching →",
    destination: "/coach",
  },
  {
    role: "both",
    emoji: "🎯",
    title: "I'm both",
    description: "You play and you coach. Everything is available to you.",
    bullets: [
      "Full player tracking for yourself",
      "Coach dashboard and pairing for your players",
      "Switch context from your account page",
    ],
    cta: "Set up both →",
    destination: "/account",
  },
];

export default function OnboardPage() {
  const auth = useAuth();
  const router = useRouter();
  const [saving, setSaving] = React.useState<UserRole | null>(null);

  React.useEffect(() => {
    if (auth.status === "authed" && auth.profile?.onboarded) {
      router.replace("/dashboard");
    } else if (auth.status === "anon") {
      router.replace("/auth?next=/onboard");
    }
  }, [auth.status, auth.profile?.onboarded, router]);

  if (auth.status === "loading" || auth.status === "anon") {
    return (
      <div className="muted text-sm py-12 text-center">Loading…</div>
    );
  }

  async function pick(opt: Option) {
    if (!auth.user || saving) return;
    setSaving(opt.role);
    try {
      await updateUserProfile(auth.user.uid, {
        role: opt.role,
        onboarded: true,
      });
      await auth.refreshProfile();
      router.replace(opt.destination);
    } catch {
      setSaving(null);
    }
  }

  const name =
    auth.profile?.displayName ?? auth.user?.displayName ?? "there";

  return (
    <div className="max-w-3xl mx-auto py-8 fade-in">
      <div className="text-center mb-8">
        <div className="h1">Hey {name}, how do you play? 👋</div>
        <div className="muted text-sm mt-2">
          Pick your role — you can always change this in your account settings.
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {OPTIONS.map((opt) => {
          const isSaving = saving === opt.role;
          const isDisabled = saving !== null && !isSaving;
          return (
            <button
              key={opt.role}
              type="button"
              disabled={isDisabled}
              onClick={() => pick(opt)}
              className="card text-left p-5 flex flex-col gap-3 transition-all cursor-pointer
                         hover:border-[var(--accent)] hover:shadow-sm
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]
                         disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isSaving
                  ? "var(--accent-soft)"
                  : undefined,
                borderColor: isSaving ? "var(--accent)" : undefined,
              }}
            >
              <div style={{ fontSize: "2.2rem", lineHeight: 1 }}>
                {opt.emoji}
              </div>
              <div>
                <div className="h2">{opt.title}</div>
                <div className="muted text-sm mt-1">{opt.description}</div>
              </div>
              <ul className="space-y-1 flex-1">
                {opt.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <span className="text-[var(--accent)] mt-0.5 shrink-0">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div
                className="btn btn-primary w-full justify-center mt-1"
                aria-hidden
              >
                {isSaving ? "Saving…" : opt.cta}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
