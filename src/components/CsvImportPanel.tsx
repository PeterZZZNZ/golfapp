"use client";

import * as React from "react";
import { FileText, ChevronRight } from "lucide-react";
import type { HoleSpec, TeeBox } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

type Props = {
  onParsed: (p: {
    name?: string;
    sourceUrl?: string;
    tees?: TeeBox[];
    holes?: HoleSpec[];
  }) => void;
};

type Parsed = {
  teeNames: string[];
  holes: HoleSpec[];
};

function parseCsv(text: string): Parsed {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");

  const splitLine = (s: string): string[] =>
    s.split(",").map((c) => c.trim());

  const headers = splitLine(lines[0]);
  const lower = headers.map((h) => h.toLowerCase());
  const holeIdx = lower.findIndex((h) => h === "hole" || h === "#");
  const parIdx = lower.findIndex((h) => h === "par");
  if (holeIdx === -1 || parIdx === -1) {
    throw new Error("Header must include 'hole' and 'par' columns.");
  }
  const hcpIdx = lower.findIndex((h) => ["hcp", "handicap", "index", "si", "stroke"].includes(h));
  const teeCols: { name: string; index: number }[] = [];
  headers.forEach((h, i) => {
    if (i === holeIdx || i === parIdx || i === hcpIdx) return;
    teeCols.push({ name: h, index: i });
  });

  const holes: HoleSpec[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitLine(lines[r]);
    if (cells.every((c) => !c)) continue;
    const hole = Number(cells[holeIdx]);
    const par = Number(cells[parIdx]);
    if (!hole || !par) continue;
    const distances: Record<string, number> = {};
    for (const t of teeCols) {
      const v = Number(cells[t.index]);
      distances[t.name] = Number.isFinite(v) ? v : 0;
    }
    const hcp = hcpIdx >= 0 ? Number(cells[hcpIdx]) : undefined;
    holes.push({
      holeNumber: hole,
      par: (par >= 3 && par <= 6 ? par : 4) as 3 | 4 | 5 | 6,
      handicapIndex: Number.isFinite(hcp) ? hcp : undefined,
      distances,
    });
  }
  holes.sort((a, b) => a.holeNumber - b.holeNumber);

  return {
    teeNames: teeCols.map((t) => t.name),
    holes,
  };
}

const EXAMPLE = `hole,par,hcp,White,Blue,Black
1,4,7,380,400,420
2,5,3,510,530,560
3,3,15,165,180,195`;

export function CsvImportPanel({ onParsed }: Props) {
  const [csv, setCsv] = React.useState("");
  const [name, setName] = React.useState("");
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const parse = () => {
    setError(null);
    try {
      setParsed(parseCsv(csv));
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const use = () => {
    if (!parsed) return;
    onParsed({
      name: name || undefined,
      tees: parsed.teeNames.length
        ? parsed.teeNames.map((n) => ({ name: n }))
        : [{ name: "White" }],
      holes: parsed.holes,
    });
  };

  return (
    <Card>
      <CardHeader
        title="Paste CSV"
        subtitle="Header row: hole, par, hcp (optional), and one column per tee."
      />
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Field label="CSV">
            <Textarea
              rows={12}
              className="font-mono text-[12px]"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={EXAMPLE}
            />
          </Field>
          <div className="muted text-xs mt-1">
            Example above — paste your own, then click Parse.
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" onClick={() => setCsv(EXAMPLE)}>
              <FileText size={14} /> Fill with example
            </Button>
            <Button variant="primary" onClick={parse}>Parse</Button>
          </div>
        </div>
        <div>
          <Field label="Course name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pebble Beach"
            />
          </Field>
          {error ? (
            <div className="mt-3 text-sm text-[var(--danger)]">{error}</div>
          ) : null}
          {parsed ? (
            <div className="mt-3">
              <div className="badge mb-2">
                {parsed.holes.length} holes • {parsed.teeNames.length} tee{parsed.teeNames.length === 1 ? "" : "s"}
              </div>
              <div className="hscroll card-2 p-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hole</th>
                      <th>Par</th>
                      <th>HCP</th>
                      {parsed.teeNames.map((n) => (
                        <th key={n}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.holes.slice(0, 5).map((h) => (
                      <tr key={h.holeNumber}>
                        <td className="num">{h.holeNumber}</td>
                        <td className="num">{h.par}</td>
                        <td className="num">{h.handicapIndex ?? "—"}</td>
                        {parsed.teeNames.map((n) => (
                          <td key={n} className="num">{h.distances[n] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                    {parsed.holes.length > 5 ? (
                      <tr>
                        <td colSpan={3 + parsed.teeNames.length} className="muted text-xs text-center">
                          …and {parsed.holes.length - 5} more
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-3">
                <Button variant="primary" onClick={use}>
                  Use this <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
