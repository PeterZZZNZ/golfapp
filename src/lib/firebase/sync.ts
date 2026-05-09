/**
 * Cloud sync layer for rounds and courses.
 *
 * Strategy (offline-first):
 *  1. Every local write (Dexie) fires a background cloud write.
 *  2. If the user is not signed in, the sync is a no-op.
 *  3. Migration: on first sign-in we upload all existing local data once,
 *     then set `users/{uid}.localMigratedAt` so we don't repeat it.
 *
 * Coach read access uses separate query functions that hit Firestore directly,
 * because the coach has no local copy of the player's data.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "./config";
import { listPairingsForCoach } from "./pairing";
import type { Course, Round } from "@/lib/types";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function db(): Firestore {
  return firebaseDb();
}

function currentUid(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return firebaseAuth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * Firestore rejects `undefined` field values. JSON round-trip is the simplest
 * way to strip them from arbitrarily nested objects (Course, Round, etc.).
 */
function toFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function roundRef(roundId: string) {
  return doc(db(), "rounds", roundId);
}

function courseRef(courseId: string) {
  return doc(db(), "courses", courseId);
}

function userRef(uid: string) {
  return doc(db(), "users", uid);
}

// -----------------------------------------------------------------------
// Cloud writes (called fire-and-forget from repo.ts)
// -----------------------------------------------------------------------

export async function saveRoundToCloud(round: Round): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  await setDoc(roundRef(round.id), toFirestore({ ...round, ownerId: uid }));
}

export async function deleteRoundFromCloud(roundId: string): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  // Only delete if this user owns it (Firestore rules enforce this too).
  await deleteDoc(roundRef(roundId));
}

export async function saveCourseToCloud(course: Course): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  await setDoc(courseRef(course.id), toFirestore({ ...course, ownerId: uid }));
}

export async function deleteCourseFromCloud(courseId: string): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  await deleteDoc(courseRef(courseId));
}

// -----------------------------------------------------------------------
// Migration: local → cloud, runs once per uid
// -----------------------------------------------------------------------

export async function hasLocalMigrated(uid: string): Promise<boolean> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return false;
  return !!snap.data()?.localMigratedAt;
}

export async function markLocalMigrated(uid: string): Promise<void> {
  await updateDoc(userRef(uid), { localMigratedAt: serverTimestamp() });
}

export async function migrateLocalToCloud(opts: {
  uid: string;
  rounds: Round[];
  courses: Course[];
  onProgress?: (done: number, total: number) => void;
}): Promise<void> {
  const { uid, rounds, courses, onProgress } = opts;
  const items: Array<() => Promise<void>> = [
    ...rounds.map(
      (r) => () =>
        setDoc(roundRef(r.id), toFirestore({ ...r, ownerId: uid }))
    ),
    ...courses.map(
      (c) => () =>
        setDoc(courseRef(c.id), toFirestore({ ...c, ownerId: uid }))
    ),
  ];
  const total = items.length;
  let done = 0;
  // Batch in groups of 10 to avoid hammering write limits.
  for (let i = 0; i < items.length; i += 10) {
    await Promise.all(items.slice(i, i + 10).map((fn) => fn()));
    done = Math.min(i + 10, total);
    onProgress?.(done, total);
  }
  await markLocalMigrated(uid);
}

// -----------------------------------------------------------------------
// Coach reads — Firestore queries on another user's rounds
// -----------------------------------------------------------------------

/** Verify a coach is actually paired with the player. Throws otherwise. */
async function assertCoachAccess(
  coachUid: string,
  playerUid: string
): Promise<void> {
  const pairings = await listPairingsForCoach(coachUid);
  const linked = pairings.some((p) => p.playerId === playerUid);
  if (!linked) {
    throw new Error("Not paired with this player.");
  }
}

export async function listRoundsForPlayer(
  coachUid: string,
  playerUid: string
): Promise<Round[]> {
  await assertCoachAccess(coachUid, playerUid);
  const q = query(
    collection(db(), "rounds"),
    where("ownerId", "==", playerUid),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    // Strip the ownerId field before returning to keep the type clean.
    const { ownerId: _ownerId, ...round } = d.data() as Round & {
      ownerId: string;
    };
    void _ownerId;
    return round;
  });
}

export async function getRoundForPlayer(
  coachUid: string,
  playerUid: string,
  roundId: string
): Promise<Round | null> {
  await assertCoachAccess(coachUid, playerUid);
  const snap = await getDoc(roundRef(roundId));
  if (!snap.exists()) return null;
  const data = snap.data() as Round & { ownerId: string };
  if (data.ownerId !== playerUid) return null;
  const { ownerId: _ownerId, ...round } = data;
  void _ownerId;
  return round;
}

export async function getCourseForPlayer(
  coachUid: string,
  playerUid: string,
  courseId: string
): Promise<Course | null> {
  await assertCoachAccess(coachUid, playerUid);
  const snap = await getDoc(courseRef(courseId));
  if (!snap.exists()) return null;
  const data = snap.data() as Course & { ownerId: string };
  if (data.ownerId !== playerUid) return null;
  const { ownerId: _ownerId, ...course } = data;
  void _ownerId;
  return course;
}

// -----------------------------------------------------------------------
// Public course library
// -----------------------------------------------------------------------

export type PublicCourse = Course & {
  /** uid of the user who published this course. */
  publishedBy: string;
  /** Display name of the contributor, snapshotted at publish time. */
  contributorName: string;
  publishedAt: Timestamp;
  /** How many times this course has been imported by other users. */
  importCount: number;
};

function publicCourseRef(courseId: string) {
  return doc(db(), "publicCourses", courseId);
}

/**
 * Publish a course to the community library.
 * Idempotent — calling again updates the course data but preserves importCount.
 */
export async function publishCourse(opts: {
  course: Course;
  contributorName: string;
}): Promise<void> {
  const uid = currentUid();
  if (!uid) throw new Error("Must be signed in to publish.");
  const ref = publicCourseRef(opts.course.id);
  const existing = await getDoc(ref);
  const importCount = existing.exists()
    ? (existing.data() as PublicCourse).importCount ?? 0
    : 0;
  // toFirestore on the course data only — serverTimestamp() must not be JSON-round-tripped.
  const payload = {
    ...toFirestore(opts.course),
    publishedBy: uid,
    contributorName: opts.contributorName,
    publishedAt: serverTimestamp(),
    importCount,
  };
  await setDoc(ref, payload);
}

/** Remove a course from the community library. Only the publisher can do this. */
export async function unpublishCourse(courseId: string): Promise<void> {
  const uid = currentUid();
  if (!uid) throw new Error("Must be signed in.");
  await deleteDoc(publicCourseRef(courseId));
}

/** Check whether the signed-in user has already published this course. */
export async function isPublished(courseId: string): Promise<boolean> {
  const uid = currentUid();
  if (!uid) return false;
  const snap = await getDoc(publicCourseRef(courseId));
  if (!snap.exists()) return false;
  return (snap.data() as PublicCourse).publishedBy === uid;
}

/**
 * Search the public library by name or location (case-insensitive, prefix).
 * Firestore doesn't support full-text search natively, so we fetch a reasonable
 * number of recent courses and filter client-side. Good enough for a small
 * community library; can swap for Algolia later if needed.
 */
export async function searchPublicCourses(opts: {
  q?: string;
  maxResults?: number;
}): Promise<PublicCourse[]> {
  const { q = "", maxResults = 100 } = opts;
  const snap = await getDocs(
    query(
      collection(db(), "publicCourses"),
      orderBy("publishedAt", "desc"),
      limit(maxResults)
    )
  );
  const all = snap.docs.map((d) => d.data() as PublicCourse);
  if (!q.trim()) return all;
  const lower = q.trim().toLowerCase();
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      (c.location ?? "").toLowerCase().includes(lower)
  );
}

/**
 * Import a public course into the user's own library (Dexie + private Firestore).
 * Creates a fresh copy with a new local ID and bumps the importCount.
 */
export async function importPublicCourse(
  publicCourse: PublicCourse,
  saveLocalFn: (course: Omit<Course, "id" | "createdAt" | "updatedAt">) => Promise<Course>
): Promise<Course> {
  // Strip public-library-only fields, save as a fresh local course.
  const {
    publishedBy: _pb,
    contributorName: _cn,
    publishedAt: _pa,
    importCount: _ic,
    id: _id,
    createdAt: _ca,
    updatedAt: _ua,
    ...courseData
  } = publicCourse;
  void _pb; void _cn; void _pa; void _ic; void _id; void _ca; void _ua;

  const saved = await saveLocalFn(courseData);

  // Bump import counter in the background (fire-and-forget).
  const ref = publicCourseRef(publicCourse.id);
  updateDoc(ref, { importCount: (publicCourse.importCount ?? 0) + 1 }).catch(
    () => {}
  );

  return saved;
}
