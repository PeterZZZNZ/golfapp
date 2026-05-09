"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { useAuth } from "@/lib/firebase/auth";
import {
  getCoachProfile,
  roleAllowsCoach,
  roleAllowsPlayer,
  saveCoachProfile,
  updateUserProfile,
} from "@/lib/firebase/profiles";
import { loadPairedCoaches, revokePairing } from "@/lib/firebase/pairing";
import type {
  CoachProfile,
  UserProfile,
  UserRole,
} from "@/lib/firebase/types";
import type { User } from "firebase/auth";

export default function AccountPage() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.status === "loading") {
    return <div className="muted">Loading…</div>;
  }
  if (auth.status === "anon") {
    return (
      <div className="max-w-md mx-auto py-6">
        <Card>
          <CardHeader
            title="Sign in to access your account"
            subtitle="You need to be signed in to manage your profile."
          />
          <Link href="/auth" className="btn btn-primary w-full">
            Sign in
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <AccountInner
      key={auth.user.uid}
      user={auth.user}
      profile={auth.profile}
      onSignOut={async () => {
        await auth.signOut();
        router.replace("/");
      }}
      onProfileChanged={auth.refreshProfile}
    />
  );
}

function AccountInner({
  user,
  profile,
  onSignOut,
  onProfileChanged,
}: {
  user: User;
  profile: UserProfile | null;
  onSignOut: () => Promise<void>;
  onProfileChanged: () => Promise<void>;
}) {
  // Initial form state derived from props at construction time. The outer
  // component re-keys this component on uid, so we don't need an effect to
  // re-sync when the auth user changes.
  const [displayName, setDisplayName] = React.useState(
    profile?.displayName ?? user.displayName ?? ""
  );
  const [role, setRole] = React.useState<UserRole>(profile?.role ?? "player");
  const [handicap, setHandicap] = React.useState<string>(
    profile?.handicap == null ? "" : String(profile.handicap)
  );
  const [location, setLocation] = React.useState(profile?.location ?? "");

  // Coach profile form (lazy-loaded once the user enables a coach role).
  const [coach, setCoach] = React.useState<Partial<CoachProfile> | null>(null);
  const [coachLoaded, setCoachLoaded] = React.useState(false);
  const [credentialsText, setCredentialsText] = React.useState("");
  const [specialtiesText, setSpecialtiesText] = React.useState("");

  // Paired coaches (for players)
  const [pairedCoaches, setPairedCoaches] = React.useState<
    Awaited<ReturnType<typeof loadPairedCoaches>>
  >([]);

  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingCoach, setSavingCoach] = React.useState(false);
  const [profileMsg, setProfileMsg] = React.useState<string | null>(null);
  const [coachMsg, setCoachMsg] = React.useState<string | null>(null);

  const showCoachEditor = roleAllowsCoach(role);
  const showPlayerSection = roleAllowsPlayer(role);

  // Load coach profile when coach editor is shown for the first time.
  React.useEffect(() => {
    if (!showCoachEditor || coachLoaded) return;
    let cancelled = false;
    getCoachProfile(user.uid)
      .then((cp) => {
        if (cancelled) return;
        setCoach(cp);
        setCredentialsText((cp?.credentials ?? []).join(", "));
        setSpecialtiesText((cp?.specialties ?? []).join(", "));
        setCoachLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setCoachLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [showCoachEditor, coachLoaded, user.uid]);

  // Load paired coaches whenever player section is visible.
  React.useEffect(() => {
    if (!showPlayerSection) return;
    let cancelled = false;
    loadPairedCoaches(user.uid)
      .then((list) => {
        if (!cancelled) setPairedCoaches(list);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [showPlayerSection, user.uid]);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const handicapNum = handicap.trim() === "" ? null : Number(handicap);
      await updateUserProfile(user.uid, {
        displayName: displayName.trim() || "Golfer",
        role,
        handicap: Number.isFinite(handicapNum as number)
          ? (handicapNum as number)
          : null,
        location: location.trim() || null,
      });
      await onProfileChanged();
      setProfileMsg("Saved.");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveCoach() {
    setSavingCoach(true);
    setCoachMsg(null);
    try {
      const credentials = credentialsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const specialties = specialtiesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await saveCoachProfile(user.uid, {
        displayName:
          coach?.displayName?.trim() || displayName.trim() || "Coach",
        bio: coach?.bio ?? "",
        credentials,
        specialties,
        yearsCoaching: coach?.yearsCoaching ?? null,
        teachingStyle: coach?.teachingStyle ?? "",
        rate: coach?.rate ?? "",
        location: coach?.location ?? location ?? "",
        acceptingPlayers: coach?.acceptingPlayers ?? true,
        photoUrl: coach?.photoUrl ?? null,
      });
      setCoachMsg("Coach profile saved.");
    } catch (err) {
      setCoachMsg(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingCoach(false);
    }
  }

  return (
    <div className="space-y-5 fade-in">
      <div>
        <div className="h1">Account</div>
        <div className="muted text-sm mt-1">
          Signed in as {user.email ?? user.uid.slice(0, 8)}
        </div>
      </div>

      <Card className="space-y-4">
        <CardHeader
          title="Profile"
          subtitle="Used across the app and shown to coaches you pair with."
        />

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Display name">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="player">Player</option>
              <option value="coach">Coach</option>
              <option value="both">Both (player + coach)</option>
            </Select>
          </Field>
          <Field label="Handicap (optional)">
            <Input
              inputMode="decimal"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
              placeholder="e.g. 12.4"
            />
          </Field>
          <Field label="Home course / city (optional)">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Auckland, NZ"
            />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" disabled={savingProfile} onClick={saveProfile}>
            {savingProfile ? "Saving…" : "Save profile"}
          </Button>
          {profileMsg ? <span className="muted text-sm">{profileMsg}</span> : null}
        </div>
      </Card>

      {showCoachEditor ? (
        <Card className="space-y-4">
          <CardHeader
            title="Coach profile"
            subtitle="Public details shown to players when pairing or browsing."
          />

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Coach display name">
              <Input
                value={coach?.displayName ?? ""}
                onChange={(e) =>
                  setCoach((c) => ({ ...(c ?? {}), displayName: e.target.value }))
                }
                placeholder="e.g. Coach Alex"
              />
            </Field>
            <Field label="Years coaching">
              <Input
                inputMode="numeric"
                value={
                  coach?.yearsCoaching == null ? "" : String(coach.yearsCoaching)
                }
                onChange={(e) => {
                  const n = e.target.value === "" ? null : Number(e.target.value);
                  setCoach((c) => ({
                    ...(c ?? {}),
                    yearsCoaching: Number.isFinite(n as number)
                      ? (n as number)
                      : null,
                  }));
                }}
              />
            </Field>
            <Field
              label="Credentials (comma-separated)"
              hint="e.g. PGA Class A, R&A Level 2"
              className="md:col-span-2"
            >
              <Input
                value={credentialsText}
                onChange={(e) => setCredentialsText(e.target.value)}
              />
            </Field>
            <Field
              label="Specialties (comma-separated)"
              hint="e.g. Short game, Mental, Juniors"
              className="md:col-span-2"
            >
              <Input
                value={specialtiesText}
                onChange={(e) => setSpecialtiesText(e.target.value)}
              />
            </Field>
            <Field label="Teaching style">
              <Input
                value={coach?.teachingStyle ?? ""}
                onChange={(e) =>
                  setCoach((c) => ({
                    ...(c ?? {}),
                    teachingStyle: e.target.value,
                  }))
                }
                placeholder="Data-driven, feel-based, video, on-course…"
              />
            </Field>
            <Field label="Rate (optional, freeform)">
              <Input
                value={coach?.rate ?? ""}
                onChange={(e) =>
                  setCoach((c) => ({ ...(c ?? {}), rate: e.target.value }))
                }
                placeholder="$80/hr"
              />
            </Field>
            <Field label="Location" className="md:col-span-2">
              <Input
                value={coach?.location ?? ""}
                onChange={(e) =>
                  setCoach((c) => ({ ...(c ?? {}), location: e.target.value }))
                }
                placeholder="City / range / club"
              />
            </Field>
            <Field label="Bio" className="md:col-span-2">
              <Textarea
                rows={4}
                value={coach?.bio ?? ""}
                onChange={(e) =>
                  setCoach((c) => ({ ...(c ?? {}), bio: e.target.value }))
                }
                placeholder="Tell players what makes you a great fit."
              />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <Chip
              active={coach?.acceptingPlayers !== false}
              onClick={() =>
                setCoach((c) => ({
                  ...(c ?? {}),
                  acceptingPlayers: !(c?.acceptingPlayers !== false),
                }))
              }
            >
              {coach?.acceptingPlayers !== false
                ? "Accepting new players"
                : "Not accepting players"}
            </Chip>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={savingCoach} onClick={saveCoach}>
              {savingCoach ? "Saving…" : "Save coach profile"}
            </Button>
            {coachMsg ? <span className="muted text-sm">{coachMsg}</span> : null}
          </div>
        </Card>
      ) : null}

      {showPlayerSection ? (
        <Card className="space-y-3">
          <CardHeader
            title="Your coaches"
            subtitle="Coaches paired with your account."
            right={
              <Link href="/pair" className="btn btn-primary !py-1.5 !px-3 text-sm">
                Enter pairing code
              </Link>
            }
          />
          {pairedCoaches.length === 0 ? (
            <div className="muted text-sm">
              No coaches paired yet. Ask your coach for a 6-character code and
              tap “Enter pairing code”.
            </div>
          ) : (
            <ul className="space-y-2">
              {pairedCoaches.map(({ pairing, profile: cp }) => (
                <li
                  key={pairing.id}
                  className="card-2 px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-medium">
                      {cp?.displayName ?? pairing.coachDisplayName ?? "Coach"}
                    </div>
                    <div className="muted text-xs">
                      Paired {pairing.pairedAt.toDate().toLocaleDateString()}
                      {cp?.location ? ` • ${cp.location}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      if (!confirm("Unpair from this coach?")) return;
                      await revokePairing({
                        coachId: pairing.coachId,
                        playerId: pairing.playerId,
                      });
                      setPairedCoaches((list) =>
                        list.filter((x) => x.pairing.id !== pairing.id)
                      );
                    }}
                  >
                    Unpair
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card className="space-y-2">
        <CardHeader title="Session" />
        <Button variant="secondary" onClick={onSignOut}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
