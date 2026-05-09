import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";
import type { HoleSpec, ParsedCourseCandidate } from "../types";

const HEADER_HOLE = /^(hole|#|h)$/i;
const HEADER_PAR = /^par$/i;
const HEADER_HCP = /^(hcp|handicap|index|si|stroke|si\.)$/i;
const HEADER_YARDS_TEE = /(yard|yds|yd|meter|m|distance)/i;
const HOLE_CELL = /^(\d{1,2})$/;
const SKIP_ROW = /^(out|in|total|front|back|overall|grand)/i;

type Matrix = string[][];

// Parse a single table into a candidate (if it looks like a scorecard).
function candidateFromTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<DomElement>): ParsedCourseCandidate | null {
  // Build a normalized 2D matrix of cells
  const rows: cheerio.Cheerio<DomElement>[] = [];
  $(table).find("tr").each((_i, tr) => {
    rows.push($(tr));
  });
  if (rows.length < 2) return null;

  const matrix: Matrix = rows.map((tr) => {
    const cells: string[] = [];
    tr.find("th,td").each((_j, el) => {
      cells.push($(el).text().replace(/\s+/g, " ").trim());
    });
    return cells;
  });

  // Attempt row-oriented layout (header row, then data rows where each row = one hole)
  const rowLayout = tryRowLayout(matrix);
  if (rowLayout) return rowLayout;

  // Attempt column-oriented layout (hole numbers are a ROW, fields are rows)
  const colLayout = tryColLayout(matrix);
  if (colLayout) return colLayout;

  return null;
}

function tryRowLayout(matrix: Matrix): ParsedCourseCandidate | null {
  if (matrix.length < 3) return null;
  // Find a header row and data rows
  for (let hdrIdx = 0; hdrIdx < Math.min(3, matrix.length); hdrIdx++) {
    const headers = matrix[hdrIdx];
    const holeCol = headers.findIndex((c) => HEADER_HOLE.test(c));
    const parCol = headers.findIndex((c) => HEADER_PAR.test(c));
    if (holeCol < 0 || parCol < 0) continue;
    const hcpCol = headers.findIndex((c) => HEADER_HCP.test(c));
    // Tee columns: any other column with numeric data; label = header text
    const teeCols: { name: string; index: number }[] = [];
    headers.forEach((h, i) => {
      if (i === holeCol || i === parCol || i === hcpCol) return;
      if (!h || /men|women|ladies|ratings?|slope|yards|yds|blue|white|black|red|gold|green|silver|championship|tips?|back|middle|forward|senior|junior|yellow|orange|pink|par|handicap|dist/i.test(h)) {
        // Accept as tee if contains distance or color keyword
        if (h) teeCols.push({ name: h, index: i });
      }
    });
    // If no tee cols detected by name, infer from remaining columns
    if (teeCols.length === 0) {
      headers.forEach((h, i) => {
        if (i === holeCol || i === parCol || i === hcpCol) return;
        if (h && h.length < 30) teeCols.push({ name: h || `Tee ${i}`, index: i });
      });
    }

    const holes: HoleSpec[] = [];
    let validRows = 0;
    for (let r = hdrIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      const first = (row[holeCol] ?? "").trim();
      if (!first || SKIP_ROW.test(first)) continue;
      const holeNum = Number(first.match(HOLE_CELL)?.[1] ?? first);
      if (!Number.isFinite(holeNum) || holeNum < 1 || holeNum > 36) continue;
      const par = Number(row[parCol]);
      if (!Number.isFinite(par) || par < 3 || par > 6) continue;
      const hcp = hcpCol >= 0 ? Number(row[hcpCol]) : undefined;
      const distances: Record<string, number> = {};
      for (const t of teeCols) {
        const n = Number(row[t.index]);
        distances[t.name] = Number.isFinite(n) ? n : 0;
      }
      holes.push({
        holeNumber: holeNum,
        par: par as 3 | 4 | 5 | 6,
        handicapIndex: Number.isFinite(hcp) ? hcp : undefined,
        distances,
      });
      validRows += 1;
    }
    if (validRows >= 9) {
      // Ensure unique hole numbers
      const uniq = new Map<number, HoleSpec>();
      for (const h of holes) uniq.set(h.holeNumber, h);
      const sorted = Array.from(uniq.values()).sort((a, b) => a.holeNumber - b.holeNumber);
      const teeNames = teeCols.map((t) => t.name).filter(Boolean);
      // Simple confidence: fraction of expected 18 holes found, plus fraction of tee cols with any nonzero distance
      const teesWithData = teeNames.filter((n) =>
        sorted.some((h) => (h.distances[n] ?? 0) > 0)
      );
      const conf =
        Math.min(sorted.length, 18) / 18 * 0.6 +
        (teesWithData.length > 0 ? 0.3 : 0) +
        (sorted.every((h) => h.par >= 3 && h.par <= 6) ? 0.1 : 0);
      // Drop tee columns that have zero distance everywhere
      const keepTees = teesWithData.length > 0 ? teesWithData : teeNames.slice(0, 1);
      const cleaned = sorted.map((h) => {
        const dist: Record<string, number> = {};
        for (const n of keepTees) dist[n] = h.distances[n] ?? 0;
        return { ...h, distances: dist };
      });
      return {
        confidence: Math.min(1, conf),
        source: "table",
        holes: cleaned,
        teeNames: keepTees,
        note: "Row-oriented table",
      };
    }
  }
  return null;
}

function tryColLayout(matrix: Matrix): ParsedCourseCandidate | null {
  if (matrix.length < 3) return null;
  // Find a row whose first cell matches hole, and contains 1..9 or 1..18 numeric cells
  for (let hi = 0; hi < matrix.length; hi++) {
    const row = matrix[hi];
    if (row.length < 5) continue;
    const firstCell = row[0]?.trim() ?? "";
    if (!HEADER_HOLE.test(firstCell)) continue;
    const holeNumbers: { col: number; n: number }[] = [];
    for (let c = 1; c < row.length; c++) {
      const m = row[c]?.match(HOLE_CELL);
      if (m) holeNumbers.push({ col: c, n: Number(m[1]) });
    }
    if (holeNumbers.length < 9) continue;

    // Find par row + tee rows below
    let parRow: string[] | null = null;
    let hcpRow: string[] | null = null;
    const teeRows: { name: string; row: string[] }[] = [];
    for (let r = hi + 1; r < matrix.length; r++) {
      const r0 = matrix[r];
      const label = (r0[0] ?? "").trim();
      if (SKIP_ROW.test(label)) continue;
      if (HEADER_PAR.test(label)) {
        parRow = r0;
        continue;
      }
      if (HEADER_HCP.test(label)) {
        hcpRow = r0;
        continue;
      }
      if (HEADER_YARDS_TEE.test(label) || /blue|white|black|red|gold|silver|green|tips?|back|middle|forward|senior|junior|yellow|orange|pink|championship|member|men|women|ladies/i.test(label)) {
        teeRows.push({ name: label.replace(/\s*(yards|yds|yd|distance|tees?)\b.*$/i, "").trim() || label, row: r0 });
      }
    }
    if (!parRow) continue;
    const holes: HoleSpec[] = [];
    for (const hn of holeNumbers) {
      const par = Number(parRow[hn.col]);
      if (!Number.isFinite(par) || par < 3 || par > 6) continue;
      const hcp = hcpRow ? Number(hcpRow[hn.col]) : undefined;
      const distances: Record<string, number> = {};
      for (const t of teeRows) {
        const n = Number(t.row[hn.col]);
        distances[t.name] = Number.isFinite(n) ? n : 0;
      }
      holes.push({
        holeNumber: hn.n,
        par: par as 3 | 4 | 5 | 6,
        handicapIndex: Number.isFinite(hcp) ? hcp : undefined,
        distances,
      });
    }
    if (holes.length < 9) continue;

    const teeNames = teeRows.map((t) => t.name);
    const teesWithData = teeNames.filter((n) => holes.some((h) => (h.distances[n] ?? 0) > 0));
    const keepTees = teesWithData.length ? teesWithData : teeNames.slice(0, 1);
    const cleaned = holes.map((h) => {
      const dist: Record<string, number> = {};
      for (const n of keepTees) dist[n] = h.distances[n] ?? 0;
      return { ...h, distances: dist };
    });
    const conf =
      Math.min(cleaned.length, 18) / 18 * 0.6 +
      (teesWithData.length > 0 ? 0.3 : 0) +
      0.1;
    return {
      confidence: Math.min(1, conf),
      source: "table",
      holes: cleaned.sort((a, b) => a.holeNumber - b.holeNumber),
      teeNames: keepTees,
      note: "Column-oriented table",
    };
  }
  return null;
}

export async function scrapeCourse(url: string): Promise<{
  name?: string;
  candidates: ParsedCourseCandidate[];
}> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) {
    throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || undefined;

  const candidates: ParsedCourseCandidate[] = [];
  $("table").each((_i, el) => {
    const c = candidateFromTable($, $(el));
    if (c) candidates.push(c);
  });

  // Dedupe near-identical candidates (same hole count, same tee names)
  const keyed = new Map<string, ParsedCourseCandidate>();
  for (const c of candidates) {
    const k = `${c.holes.length}|${c.teeNames.join(",")}|${c.holes.map((h) => h.par).join("")}`;
    const prev = keyed.get(k);
    if (!prev || prev.confidence < c.confidence) keyed.set(k, c);
  }
  const deduped = Array.from(keyed.values()).sort((a, b) => b.confidence - a.confidence);

  return {
    name: guessName(title),
    candidates: deduped.slice(0, 4),
  };
}

function guessName(title?: string): string | undefined {
  if (!title) return undefined;
  // Strip common suffixes
  const cleaned = title
    .replace(/\s*[-–|]\s*(scorecard|course tour|golf course|home|the course).*$/i, "")
    .replace(/\s*scorecard\s*$/i, "")
    .trim();
  return cleaned || title;
}
