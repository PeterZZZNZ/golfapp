import Dexie, { type Table } from "dexie";
import type {
  Course,
  Round,
  MemorableShot,
  PracticeSession,
  Settings,
} from "../types";

export type SettingsRow = Settings & { id: "settings" };

class GolfDB extends Dexie {
  courses!: Table<Course, string>;
  rounds!: Table<Round, string>;
  memorableShots!: Table<MemorableShot, string>;
  practiceSessions!: Table<PracticeSession, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super("golf-tracker");
    this.version(1).stores({
      courses: "id, name, updatedAt",
      rounds: "id, courseId, date, updatedAt, isDraft",
      memorableShots: "id, roundId, date, createdAt",
      practiceSessions: "id, date, createdAt",
      settings: "id",
    });
  }
}

let _db: GolfDB | null = null;

export function db(): GolfDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie is client-only");
  }
  if (!_db) _db = new GolfDB();
  return _db;
}
