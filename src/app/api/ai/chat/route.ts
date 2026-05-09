/**
 * POST /api/ai/chat
 *
 * Server-side proxy for coaching chat and bulk analytics.
 *
 * Body:
 *   {
 *     messages: { role: "system"|"user"|"assistant", content: string }[]
 *     model?: string       // override; falls back to env var or default
 *     role?: "chat"|"bulk" // which default model to pick if no model given
 *     maxTokens?: number
 *   }
 * Response: { content: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_MODELS, type AiRole } from "@/lib/ai/models";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No OPENROUTER_API_KEY configured on the server." },
      { status: 503 }
    );
  }

  let body: {
    messages?: ChatMessage[];
    model?: string;
    role?: AiRole;
    maxTokens?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { messages, model, role = "chat", maxTokens = 1024 } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required." },
      { status: 400 }
    );
  }

  // Resolve model: explicit override > env var for role > hardcoded default.
  const envKey =
    role === "bulk"
      ? process.env.OPENROUTER_BULK_MODEL
      : role === "vision"
        ? process.env.OPENROUTER_VISION_MODEL
        : process.env.OPENROUTER_CHAT_MODEL;

  const effectiveModel = model?.trim() || envKey || DEFAULT_MODELS[role];

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
      max_tokens: Math.min(maxTokens, 4096),
      temperature: role === "bulk" ? 0 : 0.7,
      messages,
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
