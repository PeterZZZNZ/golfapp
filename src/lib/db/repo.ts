import { db } from "./db";
import type {
  Course,
  MemorableShot,
  PracticeSession,
  Round,
  Settings,
} from "../types";
import { uid } from "../util";
import {
  deleteRoundFromCloud,
  deleteCourseFromCloud,
  saveRoundToCloud,
  saveCourseToCloud,
} from "../firebase/sync";

/** Fire-and-forget: run an async cloud sync without blocking or crashing the caller. */
function cloudSync(fn: () => Promise<void>): void {
  fn().catch((err) => {
    // Local write already succeeded; log so the error is visible in DevTools.
    console.error("[cloudSync] Firestore sync failed:", err);
  });
}

const DEFAULT_SETTINGS: Settings = {
  units: "m",
  puttingUnits: "ft",
  tempUnits: "C",
  handedness: "right",
};

// ---------- Courses ----------

export async function listCourses(): Promise<Course[]> {
  return (await db().courses.toArray()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export async function getCourse(id: string): Promise<Course | undefined> {
  return db().courses.get(id);
}

export async function saveCourse(
  c: Omit<Course, "createdAt" | "updatedAt" | "id"> & {
    id?: string;
    createdAt?: number;
  }
): Promise<Course> {
  const now = Date.now();
  const id = c.id ?? uid();
  const full: Course = {
    ...c,
    id,
    createdAt: c.createdAt ?? now,
    updatedAt: now,
  };
  await db().courses.put(full);
  cloudSync(() => saveCourseToCloud(full));
  return full;
}

export async function deleteCourse(id: string): Promise<void> {
  await db().courses.delete(id);
  cloudSync(() => deleteCourseFromCloud(id));
}

// ---------- Rounds ----------

export async function listRounds(): Promise<Round[]> {
  const all = await db().rounds.toArray();
  return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt));
}

export async function getRound(id: string): Promise<Round | undefined> {
  return db().rounds.get(id);
}

export async function saveRound(
  r: Omit<Round, "createdAt" | "updatedAt" | "id"> & {
    id?: string;
    createdAt?: number;
  }
): Promise<Round> {
  const now = Date.now();
  const id = r.id ?? uid();
  const full: Round = {
    ...r,
    id,
    createdAt: r.createdAt ?? now,
    updatedAt: now,
  };
  await db().rounds.put(full);
  cloudSync(() => saveRoundToCloud(full));
  return full;
}

export async function deleteRound(id: string): Promise<void> {
  await db().rounds.delete(id);
  cloudSync(() => deleteRoundFromCloud(id));
}

// ---------- Memorable shots ----------

export async function listMemorableShots(): Promise<MemorableShot[]> {
  const all = await db().memorableShots.toArray();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveMemorableShot(
  s: Omit<MemorableShot, "id" | "createdAt"> & { id?: string; createdAt?: number }
): Promise<MemorableShot> {
  const id = s.id ?? uid();
  const full: MemorableShot = {
    ...s,
    id,
    createdAt: s.createdAt ?? Date.now(),
  };
  await db().memorableShots.put(full);
  return full;
}

export async function deleteMemorableShot(id: string): Promise<void> {
  await db().memorableShots.delete(id);
}

// ---------- Practice sessions ----------

export async function listPracticeSessions(): Promise<PracticeSession[]> {
  const all = await db().practiceSessions.toArray();
  return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function savePracticeSession(
  s: Omit<PracticeSession, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  }
): Promise<PracticeSession> {
  const id = s.id ?? uid();
  const full: PracticeSession = {
    ...s,
    id,
    createdAt: s.createdAt ?? Date.now(),
  };
  await db().practiceSessions.put(full);
  return full;
}

export async function deletePracticeSession(id: string): Promise<void> {
  await db().practiceSessions.delete(id);
}

// ---------- Settings ----------

export async function getSettings(): Promise<Settings> {
  const row = await db().settings.get("settings");
  if (!row) return { ...DEFAULT_SETTINGS };
  // strip id field and backfill any newly-added preference keys
  const { id: _id, ...s } = row;
  void _id;
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db().settings.put({ ...s, id: "settings" });
}

// ---------- Export / Import ----------

export type ExportBundle = {
  version: 1;
  exportedAt: number;
  courses: Course[];
  rounds: Round[];
  memorableShots: MemorableShot[];
  practiceSessions: PracticeSession[];
  settings: Settings;
};

export async function exportAll(): Promise<ExportBundle> {
  const [courses, rounds, memorableShots, practiceSessions, settings] =
    await Promise.all([
      listCourses(),
      listRounds(),
      listMemorableShots(),
      listPracticeSessions(),
      getSettings(),
    ]);
  return {
    version: 1,
    exportedAt: Date.now(),
    courses,
    rounds,
    memorableShots,
    practiceSessions,
    settings,
  };
}

export async function importAll(
  bundle: ExportBundle,
  mode: "merge" | "replace" = "merge"
): Promise<void> {
  if (bundle.version !== 1) throw new Error("Unsupported bundle version");
  const d = db();
  await d.transaction(
    "rw",
    [d.courses, d.rounds, d.memorableShots, d.practiceSessions, d.settings],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          d.courses.clear(),
          d.rounds.clear(),
          d.memorableShots.clear(),
          d.practiceSessions.clear(),
          d.settings.clear(),
        ]);
      }
      await d.courses.bulkPut(bundle.courses);
      await d.rounds.bulkPut(bundle.rounds);
      await d.memorableShots.bulkPut(bundle.memorableShots);
      await d.practiceSessions.bulkPut(bundle.practiceSessions);
      await d.settings.put({ ...bundle.settings, id: "settings" });
    }
  );
}

export async function clearAll(): Promise<void> {
  const d = db();
  await d.transaction(
    "rw",
    [d.courses, d.rounds, d.memorableShots, d.practiceSessions, d.settings],
    async () => {
      await Promise.all([
        d.courses.clear(),
        d.rounds.clear(),
        d.memorableShots.clear(),
        d.practiceSessions.clear(),
        d.settings.clear(),
      ]);
    }
  );
}
