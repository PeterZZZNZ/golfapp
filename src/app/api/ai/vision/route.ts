/**
 * POST /api/ai/vision
 *
 * Server-side proxy that forwards a scorecard image to OpenRouter.
 * The OPENROUTER_API_KEY env var is never sent to the browser.
 *
 * Body: { dataUrl: string, model?: string }
 * Response: { content: string }   (the raw JSON string from the model)
 */

import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_MODELS } from "@/lib/ai/models";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are a vision model extracting structured data from a photo of a printed golf scorecard.

Return ONLY a single JSON object matching this schema — no prose, no markdown, no code fences:

{
  "courseName": string | null,
  "location": string | null,
  "distanceUnit": "yards" | "meters",
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
- To detect the unit, look for printed labels near the distance rows such as "YARDS", "YDS", "Yds", "METERS", "METRES", "M", "Mts".
- If no explicit unit label is visible, infer from typical totals: an 18-hole total of 6000-7500 is almost certainly yards; 5000-6500 is almost certainly meters.
- Output 18 holes in order if the card shows 18. If only 9, output 9 and mention it in notes.
- par is an integer 3..6.
- handicapIndex (also "HCP", "SI", "Stroke Index") is 1..18; use null if unreadable.
- Every tees[].distances array MUST have the same length as holes.
- If a cell is unreadable, use null — do not guess.
- Do not include any keys other than the schema above.`;

export const runtime = "nodejs";

// Raise body size limit for base64 images (default 1MB is too small).
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No OPENROUTER_API_KEY configured on the server." },
      { status: 503 }
    );
  }

  let body: { dataUrl?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { dataUrl, model } = body;
  if (!dataUrl || typeof dataUrl !== "string") {
    return NextResponse.json(
      { error: "dataUrl is required." },
      { status: 400 }
    );
  }

  const effectiveModel =
    model?.trim() ||
    process.env.OPENROUTER_VISION_MODEL ||
    DEFAULT_MODELS.vision;

  const orResp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://mytraqr.app",
      "X-Title": "Golf Improvement Tracker",
    },
    body: JSON.stringify({
      model: effectiveModel,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the scorecard from this image as JSON.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
          ],
        },
      ],
    }),
  });

  if (!orResp.ok) {
    const txt = await orResp.text().catch(() => "");
    return NextResponse.json(
      { error: `OpenRouter error (${orResp.status}): ${txt.slice(0, 400)}` },
      { status: 502 }
    );
  }

  const json = await orResp.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: "OpenRouter returned no content." },
      { status: 502 }
    );
  }

  return NextResponse.json({ content });
}
