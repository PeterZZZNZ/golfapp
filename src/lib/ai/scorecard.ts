// Browser-side scorecard extraction. Two code paths:
//   1. Server proxy (default) — image is sent to /api/ai/vision; the server
//      holds the OPENROUTER_API_KEY. No key needed from the user.
//   2. BYOK — if the user has configured their own API key in Settings, that
//      is used instead and calls go directly from the browser to the provider.

import type { AiProvider } from "../types";
import { DEFAULT_MODELS } from "./models";

export type ScorecardUnit = "yards" | "meters";

export type ExtractedTee = {
  name: string;
  rating?: number | null;
  slope?: number | null;
  distances: (number | null)[];
  /** Unit for this tee's distances if the card labels it per-row; else falls back to the top-level `distanceUnit`. */
  distanceUnit?: ScorecardUnit | null;
};

export type ExtractedHole = {
  holeNumber: number;
  par: number;
  handicapIndex?: number | null;
};

export type ScorecardExtraction = {
  courseName?: string;
  location?: string;
  /** The unit the scorecard printed its distances in, as detected from the photo. */
  distanceUnit?: ScorecardUnit;
  tees: ExtractedTee[];
  holes: ExtractedHole[];
  notes?: string;
};

export type ExtractOpts = {
  file: File;
  /** Present only when the user has configured BYOK. When absent, the server proxy is used. */
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
};

/** @deprecated Use ExtractOpts (provider + apiKey are now optional). */
export type LegacyExtractOpts = {
  file: File;
  provider: AiProvider;
  apiKey: string;
  model?: string;
};

export const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  openrouter: DEFAULT_MODELS.vision,
};

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
};

async function fileToResizedDataUrl(file: File, maxDim = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.9);
}

function stripJsonFence(s: string): string {
  const trimmed = s.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function parseUnit(v: unknown): ScorecardUnit | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "yards" || s === "yard" || s === "yd" || s === "yds") return "yards";
  if (
    s === "meters" ||
    s === "metres" ||
    s === "meter" ||
    s === "metre" ||
    s === "m" ||
    s === "mts"
  )
    return "meters";
  return null;
}

function coerce(raw: unknown): ScorecardExtraction {
  if (!raw || typeof raw !== "object") {
    throw new Error("Model returned no object.");
  }
  const r = raw as Record<string, unknown>;
  const teesRaw = Array.isArray(r.tees) ? r.tees : [];
  const holesRaw = Array.isArray(r.holes) ? r.holes : [];
  const topUnit = parseUnit(r.distanceUnit);

  const tees: ExtractedTee[] = teesRaw.map((t, i) => {
    const obj = (t ?? {}) as Record<string, unknown>;
    const name =
      typeof obj.name === "string" && obj.name.trim()
        ? obj.name.trim()
        : `Tee ${i + 1}`;
    const distances = Array.isArray(obj.distances)
      ? obj.distances.map((d: unknown) => {
          if (d === null || d === undefined || d === "") return null;
          const n = typeof d === "number" ? d : Number(d);
          return Number.isFinite(n) ? n : null;
        })
      : [];
    const rating =
      typeof obj.rating === "number" && Number.isFinite(obj.rating)
        ? obj.rating
        : null;
    const slope =
      typeof obj.slope === "number" && Number.isFinite(obj.slope)
        ? obj.slope
        : null;
    const rowUnit = parseUnit(obj.distanceUnit);
    return { name, rating, slope, distances, distanceUnit: rowUnit };
  });

  const holes: ExtractedHole[] = holesRaw
    .map((h, i) => {
      const obj = (h ?? {}) as Record<string, unknown>;
      const holeNumber =
        typeof obj.holeNumber === "number"
          ? obj.holeNumber
          : Number(obj.holeNumber) || i + 1;
      const par = typeof obj.par === "number" ? obj.par : Number(obj.par);
      const hcpVal = obj.handicapIndex;
      const handicapIndex =
        hcpVal === null || hcpVal === undefined || hcpVal === ""
          ? null
          : Number(hcpVal);
      return {
        holeNumber,
        par: Number.isFinite(par) ? par : 4,
        handicapIndex:
          handicapIndex !== null && Number.isFinite(handicapIndex)
            ? handicapIndex
            : null,
      } as ExtractedHole;
    })
    .filter((h) => Number.isFinite(h.holeNumber));

  let detectedUnit: ScorecardUnit | undefined = topUnit ?? undefined;
  if (!detectedUnit) {
    const firstTeeTotal: number = tees[0]
      ? tees[0].distances.reduce<number>(
          (a, d) => a + (typeof d === "number" && d > 0 ? d : 0),
          0
        )
      : 0;
    if (firstTeeTotal >= 6500) detectedUnit = "yards";
    else if (firstTeeTotal > 0 && firstTeeTotal <= 6500) detectedUnit = "meters";
  }

  return {
    courseName:
      typeof r.courseName === "string" && r.courseName.trim()
        ? r.courseName.trim()
        : undefined,
    location:
      typeof r.location === "string" && r.location.trim()
        ? r.location.trim()
        : undefined,
    distanceUnit: detectedUnit,
    tees,
    holes,
    notes:
      typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : undefined,
  };
}

// ─── Path 1: server proxy ────────────────────────────────────────────────────

async function callServerProxy(
  dataUrl: string,
  model?: string
): Promise<string> {
  const resp = await fetch("/api/ai/vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, model }),
  });
  if (!resp.ok) {
    const json = await resp.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ??
        `Vision proxy error (${resp.status})`
    );
  }
  const json = await resp.json();
  const content = (json as { content?: string }).content;
  if (!content) throw new Error("Vision proxy returned no content.");
  return content;
}

// ─── Path 2: BYOK (direct browser → provider) ────────────────────────────────

async function callOpenAiCompatible(
  label: string,
  endpoint: string,
  headers: Record<string, string>,
  dataUrl: string,
  model: string
): Promise<string> {
  const SYSTEM_PROMPT = `You are a vision model extracting structured data from a photo of a printed golf scorecard.

Return ONLY a single JSON object matching this schema — no prose, no markdown, no code fences:

{
  "courseName": string | null,         // course name if printed on the card
  "location": string | null,           // city/state/country if visible
  "distanceUnit": "yards" | "meters",  // which unit the distances are printed in (see rules below)
  "tees": [
    {
      "name": string,
      "rating": number | null,
      "slope": number | null,
      "distances": [number | null, ...],
      "distanceUnit": "yards" | "meters" | null
    }
  ],
  "holes": [
    { "holeNumber": 1, "par": 4, "handicapIndex": 7 },
    ...
  ],
  "notes": string | null
}

Rules:
- CRITICAL: NEVER convert numbers. Report the digits as they appear on the card and report the unit separately in "distanceUnit".
- To detect the unit, look for printed labels such as "YARDS", "YDS", "METERS", "METRES", "M", "Mts".
- If no explicit unit label is visible, infer from typical totals: 6000-7500 → yards; 5000-6500 → meters.
- Output 18 holes in order if the card shows 18. If only 9, output 9 and note it.
- par is an integer 3..6.
- handicapIndex is 1..18; use null if unreadable.
- Every tees[].distances array MUST have the same length as holes.
- If a cell is unreadable, use null — do not guess.`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the scorecard from this image as JSON." },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`${label} request failed (${resp.status}): ${txt.slice(0, 400)}`);
  }
  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error(`${label} response missing content.`);
  return content;
}

async function callAnthropic(
  dataUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error("Could not prepare image for Anthropic.");
  const mediaType = match[1];
  const base64 = match[2];

  const SYSTEM_PROMPT = `You are a vision model extracting structured data from a photo of a printed golf scorecard. Return ONLY a single valid JSON object — no prose, no markdown.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: "Extract the scorecard from this image as JSON only." },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Anthropic request failed (${resp.status}): ${txt.slice(0, 400)}`);
  }
  const json = await resp.json();
  const block = Array.isArray(json?.content)
    ? json.content.find((c: { type?: string }) => c?.type === "text")
    : null;
  const text = block?.text;
  if (typeof text !== "string") throw new Error("Anthropic response missing text.");
  return text;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function extractScorecardFromImage(
  opts: ExtractOpts | LegacyExtractOpts
): Promise<ScorecardExtraction> {
  const { file, model } = opts;
  const dataUrl = await fileToResizedDataUrl(file);

  let rawContent: string;

  const hasApiKey = "apiKey" in opts && !!opts.apiKey;
  const provider = "provider" in opts ? opts.provider : undefined;

  if (hasApiKey && opts.apiKey && provider) {
    // BYOK path
    if (provider === "openai") {
      rawContent = await callOpenAiCompatible(
        "OpenAI",
        "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${opts.apiKey}` },
        dataUrl,
        model || DEFAULT_MODEL.openai
      );
    } else if (provider === "openrouter") {
      const extra: Record<string, string> = {
        Authorization: `Bearer ${opts.apiKey}`,
      };
      if (typeof window !== "undefined") {
        extra["HTTP-Referer"] = window.location.origin;
        extra["X-Title"] = "Golf Improvement Tracker";
      }
      rawContent = await callOpenAiCompatible(
        "OpenRouter",
        "https://openrouter.ai/api/v1/chat/completions",
        extra,
        dataUrl,
        model || DEFAULT_MODEL.openrouter
      );
    } else {
      rawContent = await callAnthropic(
        dataUrl,
        opts.apiKey,
        model || DEFAULT_MODEL.anthropic
      );
    }
  } else {
    // Server proxy path (no BYOK key needed)
    rawContent = await callServerProxy(dataUrl, model);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(rawContent));
  } catch {
    throw new Error(
      "The model's response wasn't valid JSON. Try a clearer photo, or try again."
    );
  }
  return coerce(parsed);
}
