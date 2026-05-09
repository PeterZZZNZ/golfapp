# Coach mode — Phase 1: Auth + Pairing

This document covers the first slice of the coach/player feature: Firebase
Authentication, user/coach profiles, and the pairing flow. Round-data sync
(so coaches can actually view a player's stats) is a separate phase.

## What's in the app now

| Route | Who | Purpose |
| --- | --- | --- |
| `/auth` | anyone | Email/password + Google sign-in / sign-up |
| `/account` | signed in | Profile, role (player / coach / both), coach profile editor, list of paired coaches, sign out |
| `/coach` | role includes coach | Generate single-use 6-char pairing code, list paired players |
| `/coach/players/[playerId]` | role includes coach, paired with that player | Player detail (stats placeholder until phase 2) |
| `/pair` | role includes player | Redeem a pairing code |

Auth state is provided to the whole app via `<AuthProvider>` in
`src/lib/firebase/auth.tsx`. Use `useAuth()` to read the current user and
profile anywhere in the tree.

## Firestore data model

```
users/{uid}                       — user profile (private to user, readable by paired coaches)
coaches/{uid}                     — public coach profile
pairingCodes/{code}               — single-use 6-char codes (TTL 10 min)
pairings/{coachId__playerId}      — active coach <-> player link
```

Document shapes are defined in `src/lib/firebase/types.ts`.

## Pairing flow (no Cloud Functions required)

1. Coach taps "Generate pairing code" on `/coach`. We write
   `pairingCodes/{code}` with `coachId = me`, `used = false`,
   `expiresAt = now + 10 min`.
2. Coach reads the code aloud / copies it.
3. Player goes to `/pair`, enters the code. We run a Firestore transaction
   (`redeemPairingCode` in `src/lib/firebase/pairing.ts`) that:
   - reads the code, validates expiry / not-used / not-self / not-already-paired
   - updates the code (`used = true`, `usedBy = me`, `usedAt = now`)
   - creates `pairings/{coachId__playerId}` with `codeUsed = code`
4. Security rules verify the pairing creation by `get()`-ing the matching
   pairing-code doc and checking `coachId` and `usedBy` line up.

Either party can revoke the link via `revokePairing()` (sets
`status: 'revoked'` — soft delete preserves audit trail).

## Next phases

1. Sync rounds + courses to Firestore. Add coach-only read access to a
   player's rounds. Replace the placeholder on `/coach/players/[playerId]`
   with a real round list / round detail.
2. Coach edits & annotations on rounds (with attribution).
3. Coach discovery / browse + first-message request flow.
