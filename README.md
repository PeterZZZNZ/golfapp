# Golf Tracker

A local-first golf improvement tracker. Log rounds at three levels of detail, derive real stats (including Strokes Gained), get deterministic insights about where to improve, and keep qualitative notes alongside the numbers.

Everything lives in IndexedDB on the device — no accounts, no server, no cloud.

## Stack

- **Next.js 16 (App Router)** + TypeScript + Tailwind CSS
- **Dexie** (IndexedDB) for local persistence
- **Recharts** for trend visualizations
- **cheerio** for the scorecard URL scraper (server-side)
- **Zustand / React hooks** for UI state
- PWA manifest + service worker for offline / "add to home screen"

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

On first load you'll be on an empty dashboard. Add a course first (`Courses → Add course`), then log a round (`+ New Round`). The app pre-fills data from previous inputs where possible.

## Sections

| Route | What it does |
| --- | --- |
| `/` | Dashboard — last round, rolling averages, SG bars, biggest opportunity, recent rounds. |
| `/rounds` | List of all rounds including drafts. |
| `/rounds/new` | Multi-step wizard: setup → mode select → entry → wrap-up. Drafts auto-save. |
| `/rounds/[id]` | Full round breakdown with shot-by-shot + per-hole SG when available. |
| `/stats` | Overview, Strokes Gained, Approach, Short Game, Putting, Driving tabs. Filters by window & course. |
| `/courses` | Course library. |
| `/courses/new` | Three ways to add: **Manual**, **Import from URL** (scrapes a scorecard page), **Paste CSV**. |
| `/insights` | Deterministic, explainable recommendations based on your data. Every finding cites the numbers it used. |
| `/notes` | Memorable shots and qualitative observations, linkable to rounds. |
| `/practice` | Practice sessions. Cross-references hours vs Strokes Gained to flag mismatches. |
| `/settings` | Units, handicap, JSON export/import, reset. |

## Three entry modes

Pick per round — more detail unlocks deeper stats.

1. **Quick** (~60s): score + putts (+ optional FIR/GIR). Unlocks: score, FIR%, GIR%, putts/round, scrambling%.
2. **Standard** (~5 min): adds drive/approach distances, up-&-down and sand save flags, 3-putt flag. Unlocks richer short-game and driving stats.
3. **Full shots** (~15 min): per-shot lie + distance-to-hole. Unlocks **Strokes Gained** by category, proximity tables by distance bucket, per-shot SG.

## Strokes Gained baseline

Bundled in `src/data/baselines/sg.json` — approximate PGA Tour-style expected-strokes-to-hole by lie and distance. Interpolated linearly at lookup time. Good enough to produce trustworthy relative signal even though it's not tour-grade precise.

## Course scraper

`POST /api/courses/scrape { url }` fetches the page server-side and runs two cheerio-based layout detectors (row-oriented and column-oriented scorecards). Each candidate returns with a confidence score and is **always** reviewed/edited by the user before saving. Falls back to CSV paste if every detector misses.

## Data model

All types live in `src/lib/types.ts`. Storage is plain Dexie tables in `src/lib/db/`. Pure functions in `src/lib/stats/`, `src/lib/insights/`, and `src/lib/scraper/` have no browser-specific dependencies and are ready to port to React Native.

## Backups

Use Settings → Export to download a single JSON file containing every course, round, note, practice session, and setting. Import to merge or replace.
