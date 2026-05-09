import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { firebaseDb } from "./config";
import {
  PAIRING_CODE_LENGTH,
  PAIRING_CODE_TTL_MS,
  type Pairing,
  type PairingCode,
} from "./types";
import { getCoachProfile, getUserProfile } from "./profiles";

function db(): Firestore {
  return firebaseDb();
}

// Avoids ambiguous chars: 0/O, 1/I, etc.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = PAIRING_CODE_LENGTH): string {
  let out = "";
  const buf = new Uint32Array(length);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 1e9);
  }
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function pairingId(coachId: string, playerId: string): string {
  return `${coachId}__${playerId}`;
}

/**
 * Coach calls this to create a one-time-use pairing code. Retries on
 * collision (extremely rare with a 32^6 ≈ 1B keyspace).
 */
export async function generatePairingCode(opts: {
  coachId: string;
  coachDisplayName: string;
}): Promise<PairingCode> {
  const { coachId, coachDisplayName } = opts;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const ref = doc(db(), "pairingCodes", code);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;
    const now = Timestamp.now();
    const expires = Timestamp.fromMillis(Date.now() + PAIRING_CODE_TTL_MS);
    const payload: PairingCode = {
      code,
      coachId,
      coachDisplayName,
      createdAt: now,
      expiresAt: expires,
      used: false,
      usedBy: null,
      usedAt: null,
    };
    await setDoc(ref, payload);
    return payload;
  }
  throw new Error("Could not generate a unique pairing code, try again.");
}

export type RedeemError =
  | "not-found"
  | "expired"
  | "already-used"
  | "self-pair"
  | "already-paired"
  | "unknown";

export class PairingRedeemError extends Error {
  reason: RedeemError;
  constructor(reason: RedeemError, message?: string) {
    super(message ?? reason);
    this.reason = reason;
    this.name = "PairingRedeemError";
  }
}

/**
 * Player calls this to redeem a code. Runs a transaction:
 *  1. Read the code, validate.
 *  2. Mark it used (used=true, usedBy=playerId).
 *  3. Create the pairing doc with a deterministic id.
 *
 * If a stale code was already consumed by *this* same player but the pairing
 * doc was never created (e.g. network failure), we recover by skipping step 2
 * and creating the pairing anyway.
 */
export async function redeemPairingCode(opts: {
  rawCode: string;
  playerId: string;
  playerDisplayName: string;
}): Promise<Pairing> {
  const code = opts.rawCode.trim().toUpperCase();
  if (code.length !== PAIRING_CODE_LENGTH) {
    throw new PairingRedeemError("not-found", "Code must be 6 characters.");
  }

  const codeRef = doc(db(), "pairingCodes", code);
  const result = await runTransaction(db(), async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists()) {
      throw new PairingRedeemError("not-found");
    }
    const data = codeSnap.data() as PairingCode;
    const expired = data.expiresAt.toMillis() < Date.now();
    if (expired) throw new PairingRedeemError("expired");
    if (data.coachId === opts.playerId) {
      throw new PairingRedeemError("self-pair");
    }
    const usedByOther = data.used && data.usedBy && data.usedBy !== opts.playerId;
    if (usedByOther) throw new PairingRedeemError("already-used");

    const id = pairingId(data.coachId, opts.playerId);
    const pairingRef = doc(db(), "pairings", id);
    const existingPairing = await tx.get(pairingRef);
    if (existingPairing.exists()) {
      throw new PairingRedeemError("already-paired");
    }

    if (!data.used) {
      tx.update(codeRef, {
        used: true,
        usedBy: opts.playerId,
        usedAt: serverTimestamp(),
      });
    }

    const pairing: Pairing = {
      id,
      coachId: data.coachId,
      playerId: opts.playerId,
      codeUsed: code,
      status: "active",
      pairedAt: Timestamp.now(),
      coachDisplayName: data.coachDisplayName,
      playerDisplayName: opts.playerDisplayName,
    };
    tx.set(pairingRef, pairing);
    return pairing;
  });

  return result;
}

/** Active pairings where the current user is the coach. */
export async function listPairingsForCoach(coachId: string): Promise<Pairing[]> {
  const q = query(
    collection(db(), "pairings"),
    where("coachId", "==", coachId),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Pairing);
}

/** Active pairings where the current user is the player. */
export async function listPairingsForPlayer(playerId: string): Promise<Pairing[]> {
  const q = query(
    collection(db(), "pairings"),
    where("playerId", "==", playerId),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Pairing);
}

/** Either party can revoke (soft-delete) the link. */
export async function revokePairing(opts: {
  coachId: string;
  playerId: string;
}): Promise<void> {
  const id = pairingId(opts.coachId, opts.playerId);
  await updateDoc(doc(db(), "pairings", id), { status: "revoked" });
}

/** Hard delete (e.g. coach deletes their own active code before redemption). */
export async function deletePairingCode(code: string): Promise<void> {
  await deleteDoc(doc(db(), "pairingCodes", code.toUpperCase()));
}

/** Hydrate a list of pairings into a list of player profiles for the coach. */
export async function loadPairedPlayers(coachId: string) {
  const pairings = await listPairingsForCoach(coachId);
  const profiles = await Promise.all(
    pairings.map(async (p) => ({
      pairing: p,
      profile: await getUserProfile(p.playerId),
    }))
  );
  return profiles;
}

/** Hydrate a list of pairings into the coaches a player is linked to. */
export async function loadPairedCoaches(playerId: string) {
  const pairings = await listPairingsForPlayer(playerId);
  const profiles = await Promise.all(
    pairings.map(async (p) => ({
      pairing: p,
      profile: await getCoachProfile(p.coachId),
    }))
  );
  return profiles;
}
