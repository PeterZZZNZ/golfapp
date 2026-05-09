"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Image as ImageIcon,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { getSettings } from "@/lib/db/repo";
import type { HoleSpec, TeeBox } from "@/lib/types";
import {
  extractScorecardFromImage,
  PROVIDER_LABEL,
  type ScorecardExtraction,
  type ScorecardUnit,
} from "@/lib/ai/scorecard";
import { mToYd } from "@/lib/units";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Input";

type Props = {
  onParsed: (p: {
    name?: string;
    sourceUrl?: string;
    tees?: TeeBox[];
    holes?: HoleSpec[];
  }) => void;
};

/**
 * Convert an extraction into course-form data. Distances are always stored
 * in yards internally — so if the scorecard was in meters, we convert here.
 */
function extractionToForm(
  ex: ScorecardExtraction,
  overrideUnit: ScorecardUnit
): {
  name?: string;
  tees: TeeBox[];
  holes: HoleSpec[];
} {
  const tees: TeeBox[] = ex.tees.map((t) => ({
    name: t.name,
    rating: t.rating ?? undefined,
    slope: t.slope ?? undefined,
  }));
  const holeCount =
    ex.holes.length || (ex.tees[0]?.distances?.length ?? 0) || 0;

  const teeUnits: Record<string, ScorecardUnit> = {};
  for (const t of ex.tees) {
    teeUnits[t.name] = t.distanceUnit ?? overrideUnit;
  }

  const holes: HoleSpec[] = [];
  for (let i = 0; i < holeCount; i++) {
    const h = ex.holes[i];
    const holeNumber = h?.holeNumber ?? i + 1;
    const parRaw = h?.par ?? 4;
    const par = (Math.min(6, Math.max(3, Math.round(parRaw))) || 4) as
      | 3
      | 4
      | 5
      | 6;
    const distances: Record<string, number> = {};
    for (const t of ex.tees) {
      const raw = t.distances[i];
      if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
        const unit = teeUnits[t.name] ?? overrideUnit;
        distances[t.name] =
          unit === "meters" ? Math.round(mToYd(raw)) : Math.round(raw);
      } else {
        distances[t.name] = 0;
      }
    }
    holes.push({
      holeNumber,
      par,
      handicapIndex:
        h?.handicapIndex && Number.isFinite(h.handicapIndex)
          ? h.handicapIndex
          : undefined,
      distances,
    });
  }
  return {
    name: ex.courseName || undefined,
    tees: tees.length ? tees : [{ name: "White" }],
    holes,
  };
}

export function ImageImportPanel({ onParsed }: Props) {
  const settings = useLiveQuery(() => getSettings(), [], undefined);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [extraction, setExtraction] = React.useState<ScorecardExtraction | null>(
    null
  );
  // A null override means "use whatever the extraction detected". The user
  // chooses a specific unit by clicking a chip.
  const [unitOverride, setUnitOverride] = React.useState<ScorecardUnit | null>(
    null
  );
  const effectiveUnit: ScorecardUnit =
    unitOverride ?? extraction?.distanceUnit ?? "yards";
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  React.useEffect(() => {
    if (extraction?.courseName && !name) setName(extraction.courseName);
  }, [extraction, name]);

  const ai = settings?.ai;
  // BYOK is optional — if not set, the server proxy is used automatically.
  const hasByok = !!(ai?.provider && ai?.apiKey);

  const pick = (f: File | null) => {
    setFile(f);
    setExtraction(null);
    setError(null);
  };

  const run = async () => {
    if (!file) {
      setError("Pick a scorecard photo first.");
      return;
    }
    setError(null);
    setExtraction(null);
    setLoading(true);
    try {
      const ex = await extractScorecardFromImage(
        hasByok && ai?.provider && ai?.apiKey
          ? { file, provider: ai.provider, apiKey: ai.apiKey, model: ai.model }
          : { file }
      );
      if (!ex.holes.length && !ex.tees.length) {
        setError(
          "The model didn't find a scorecard in this image. Try a clearer, flatter photo."
        );
        return;
      }
      setExtraction(ex);
    } catch (e: unknown) {
      setError((e as Error).message || "Extraction failed.");
    } finally {
      setLoading(false);
    }
  };

  const use = () => {
    if (!extraction) return;
    const form = extractionToForm(extraction, effectiveUnit);
    onParsed({
      name: name || form.name,
      tees: form.tees,
      holes: form.holes,
    });
  };

  const reset = () => {
    setFile(null);
    setExtraction(null);
    setError(null);
    setName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader
        title="Scan a scorecard photo"
        subtitle="Take or upload a picture of a printed scorecard — a vision model will read it and fill the form."
      />

      {!hasByok ? (
        <div className="card-2 px-3 py-2 text-xs muted flex items-center gap-2">
          <Sparkles size={12} className="shrink-0" />
          <span>
            Using server AI (Gemini 2.5 Flash).{" "}
            <Link href="/settings" className="link">
              Add your own key
            </Link>{" "}
            in Settings to override.
          </span>
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <div className="space-y-3">
          <Field label="Scorecard image">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
              >
                <ImageIcon size={14} /> {file ? "Replace photo" : "Choose photo"}
              </Button>
              {file ? (
                <Button variant="ghost" onClick={reset}>
                  <RotateCcw size={14} /> Reset
                </Button>
              ) : null}
            </div>
            {file ? (
              <div className="muted text-xs mt-1.5">
                {file.name} — {Math.round(file.size / 1024)} KB
              </div>
            ) : null}
          </Field>

          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Scorecard preview"
              className="rounded-lg border border-[var(--border)] max-h-80 w-full object-contain bg-black/40"
            />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] text-[var(--muted)] text-xs h-48 flex items-center justify-center">
              No photo selected
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={run}
              disabled={!file || loading}
            >
              <Sparkles size={14} />{" "}
              {loading ? "Extracting…" : "Extract with AI"}
            </Button>
            {hasByok && ai?.provider ? (
              <span className="muted text-xs self-center">
                using {PROVIDER_LABEL[ai.provider]} ({ai.model || "default model"})
              </span>
            ) : null}
          </div>

          <div className="muted text-xs flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              Vision models make mistakes — especially on blurry, angled, or
              partial photos. Always review the parsed scorecard before saving.
            </span>
          </div>

          {error ? (
            <div className="text-sm text-[var(--danger)]">{error}</div>
          ) : null}
        </div>

        <div>
          <Field label="Course name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={extraction?.courseName || "Course name"}
            />
          </Field>

          {extraction ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">
                  {extraction.holes.length} holes •{" "}
                  {extraction.tees.length} tee
                  {extraction.tees.length === 1 ? "" : "s"}
                </span>
                {extraction.location ? (
                  <span className="muted text-xs">{extraction.location}</span>
                ) : null}
              </div>

              <div className="card-2 p-2.5">
                <div className="text-xs muted mb-1.5">
                  Detected unit on scorecard
                  {extraction.distanceUnit ? (
                    <>
                      {" "}— model read{" "}
                      <span className="font-medium">
                        {extraction.distanceUnit}
                      </span>
                    </>
                  ) : null}
                  . We&apos;ll convert to yards for storage. Override if wrong:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    active={effectiveUnit === "yards"}
                    onClick={() => setUnitOverride("yards")}
                  >
                    Yards
                  </Chip>
                  <Chip
                    active={effectiveUnit === "meters"}
                    onClick={() => setUnitOverride("meters")}
                  >
                    Meters
                  </Chip>
                </div>
              </div>

              {extraction.notes ? (
                <div className="text-xs text-[var(--warning,#c99000)] flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>Model note: {extraction.notes}</span>
                </div>
              ) : null}

              <div className="hscroll card-2 p-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hole</th>
                      <th>Par</th>
                      <th>HCP</th>
                      {extraction.tees.map((t) => (
                        <th key={t.name}>
                          {t.name} ({effectiveUnit === "meters" ? "m" : "yd"})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extraction.holes.slice(0, 6).map((h, i) => (
                      <tr key={h.holeNumber}>
                        <td className="num">{h.holeNumber}</td>
                        <td className="num">{h.par}</td>
                        <td className="num">{h.handicapIndex ?? "—"}</td>
                        {extraction.tees.map((t) => (
                          <td key={t.name} className="num">
                            {t.distances[i] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {extraction.holes.length > 6 ? (
                      <tr>
                        <td
                          colSpan={3 + extraction.tees.length}
                          className="muted text-xs text-center"
                        >
                          …and {extraction.holes.length - 6} more
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button variant="primary" onClick={use}>
                  Use this <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 muted text-xs">
              After extraction, the parsed scorecard will preview here for
              review before it fills the Manual form.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
