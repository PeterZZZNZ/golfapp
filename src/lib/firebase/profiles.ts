import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { firebaseDb } from "./config";
import type { CoachProfile, UserProfile, UserRole } from "./types";

function db(): Firestore {
  return firebaseDb();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db(), "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function getCoachProfile(
  uid: string
): Promise<CoachProfile | null> {
  const snap = await getDoc(doc(db(), "coaches", uid));
  return snap.exists() ? (snap.data() as CoachProfile) : null;
}

/**
 * Ensure a user profile document exists for this auth user. Called on first
 * sign-in. Defaults role to "player" — user can change it on /account.
 */
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db(), "users", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return existing.data() as UserProfile;
  }
  const now = serverTimestamp() as unknown as Timestamp;
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "Golfer",
    photoUrl: user.photoURL ?? null,
    role: "player",
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, profile);
  return profile;
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<
    Pick<
      UserProfile,
      "displayName" | "photoUrl" | "role" | "handicap" | "location" | "onboarded"
    >
  >
): Promise<void> {
  await updateDoc(doc(db(), "users", uid), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** Create or replace a coach profile. Idempotent. */
export async function saveCoachProfile(
  uid: string,
  patch: Partial<Omit<CoachProfile, "uid" | "createdAt" | "updatedAt">>
): Promise<void> {
  const ref = doc(db(), "coaches", uid);
  const existing = await getDoc(ref);
  const now = serverTimestamp() as unknown as Timestamp;
  if (existing.exists()) {
    await updateDoc(ref, { ...patch, updatedAt: now });
  } else {
    const base: CoachProfile = {
      uid,
      displayName: patch.displayName ?? "Coach",
      acceptingPlayers: patch.acceptingPlayers ?? true,
      createdAt: now,
      updatedAt: now,
      ...patch,
    };
    await setDoc(ref, base);
  }
}

export function roleAllowsCoach(role: UserRole | undefined | null): boolean {
  return role === "coach" || role === "both";
}

export function roleAllowsPlayer(role: UserRole | undefined | null): boolean {
  return role === "player" || role === "both";
}
