"use client";

import * as React from "react";
import { Download, AlertTriangle, ChevronRight } from "lucide-react";
import type { HoleSpec, TeeBox, ParsedCourseCandidate } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

type Props = {
  onParsed: (p: {
    name?: string;
    sourceUrl?: string;
    tees?: TeeBox[];
    holes?: HoleSpec[];
  }) => void;
};

export function ScraperPanel({ onParsed }: Props) {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<ParsedCourseCandidate[] | null>(null);
  const [name, setName] = React.useState("");

  const run = async () => {
    setError(null);
    setCandidates(null);
    if (!url.trim()) {
      setError("Enter a URL first.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/courses/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json?.error || `Request failed (${resp.status}).`);
        setLoading(false);
        return;
      }
      if (!json.candidates?.length) {
        setError("No scorecard-like tables were detected on that page. Try the Manual or CSV tab.");
        setLoading(false);
        return;
      }
      setCandidates(json.candidates as ParsedCourseCandidate[]);
      if (json.name) setName(json.name);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to fetch.");
    } finally {
      setLoading(false);
    }
  };

  const choose = (c: ParsedCourseCandidate) => {
    const tees: TeeBox[] = c.teeNames.map((n) => ({ name: n }));
    onParsed({
      name: name || undefined,
      sourceUrl: url.trim(),
      tees: tees.length ? tees : [{ name: "White" }],
      holes: c.holes,
    });
  };

  return (
    <Card>
      <CardHeader
        title="Import from URL"
        subtitle="Paste the URL of a scorecard page. We'll fetch it and try to find a scorecard table for you to review."
      />
      <div className="flex flex-col md:flex-row gap-3">
        <Field label="Scorecard URL" className="flex-1">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://coursename.com/scorecard"
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
          />
        </Field>
        <div className="md:self-end">
          <Button variant="primary" onClick={run} disabled={loading}>
            <Download size={14} /> {loading ? "Fetching…" : "Fetch"}
          </Button>
        </div>
      </div>

      <div className="muted text-xs mt-2 flex items-start gap-1.5">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        <span>
          Scraping is best-effort — every site is different. Review and edit the parsed data before saving.
        </span>
      </div>

      {error ? (
        <div className="mt-4 text-sm text-[var(--danger)]">{error}</div>
      ) : null}

      {candidates ? (
        <div className="mt-5 space-y-3">
          <Field label="Course name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="From page title, or enter manually"
            />
          </Field>
          <div className="h3">Detected candidates</div>
          <div className="muted text-xs">
            Pick the table that looks like your scorecard — you'll be able to fine-tune the holes next.
          </div>
          <div className="space-y-2">
            {candidates.map((c, i) => (
              <div key={i} className="card-2 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="badge">
                      {Math.round(c.confidence * 100)}% match
                    </span>
                    <span className="text-sm font-medium">
                      {c.holes.length} holes • {c.teeNames.length} tee{c.teeNames.length === 1 ? "" : "s"}
                    </span>
                    {c.note ? (
                      <span className="muted text-xs">{c.note}</span>
                    ) : null}
                  </div>
                  <Button variant="primary" onClick={() => choose(c)}>
                    Use this <ChevronRight size={14} />
                  </Button>
                </div>
                <div className="hscroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Hole</th>
                        <th>Par</th>
                        <th>HCP</th>
                        {c.teeNames.map((n) => (
                          <th key={n}>{n}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.holes.slice(0, 6).map((h) => (
                        <tr key={h.holeNumber}>
                          <td className="num">{h.holeNumber}</td>
                          <td className="num">{h.par}</td>
                          <td className="num">{h.handicapIndex ?? "—"}</td>
                          {c.teeNames.map((n) => (
                            <td key={n} className="num">
                              {h.distances[n] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {c.holes.length > 6 ? (
                        <tr>
                          <td colSpan={3 + c.teeNames.length} className="muted text-xs text-center">
                            …and {c.holes.length - 6} more holes
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
