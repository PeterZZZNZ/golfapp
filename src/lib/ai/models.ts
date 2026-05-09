/**
 * Central catalogue of AI model roles and their defaults.
 *
 * All three roles use OpenRouter so a single OPENROUTER_API_KEY covers
 * everything. Values can be overridden via env vars (server routes) or
 * per-device settings (BYOK override in the Settings page).
 */

/** The three roles AI plays in this app. */
export type AiRole = "vision" | "bulk" | "chat";

/**
 * Default model IDs on OpenRouter for each role.
 *
 * Vision  – Gemini 2.5 Flash: best OCR on the market, excellent at reading
 *   tables and following strict JSON schemas, very cheap.
 *
 * Bulk    – Claude Haiku 4.5: fastest Anthropic model, great at structured
 *   reasoning over large datasets (full round breakdowns, batch insights).
 *
 * Chat    – Claude Sonnet 4.5: noticeably smarter than Haiku for open-ended
 *   coaching conversations; still reasonably priced.
 */
export const DEFAULT_MODELS: Record<AiRole, string> = {
  vision: "google/gemini-2.5-flash",
  bulk: "anthropic/claude-haiku-4-5",
  chat: "anthropic/claude-sonnet-4-5",
};

/** Human-readable names shown in the Settings UI. */
export const ROLE_LABELS: Record<AiRole, string> = {
  vision: "Vision (scorecard scan)",
  bulk: "Bulk / analytics",
  chat: "Coaching chat",
};

/** Short hints shown below each model field in Settings. */
export const ROLE_HINTS: Record<AiRole, string> = {
  vision:
    "Reads scorecard photos. Needs vision capability. Default: Gemini 2.5 Flash.",
  bulk: "Processes round data, generates insights. Default: Claude Haiku 4.5.",
  chat: "Powers the coaching chat. Default: Claude Sonnet 4.5.",
};

/**
 * Read the effective model for a role.
 * Priority: BYOK field in Settings → env override → hardcoded default.
 * The env override is only relevant server-side (the NEXT_PUBLIC_ form would
 * expose it to the browser bundle). Use the proxy API routes for server keys.
 */
export function resolveModel(
  role: AiRole,
  override?: string | null
): string {
  return override?.trim() || DEFAULT_MODELS[role];
}
