"use client";

import * as React from "react";
import {
  Send,
  Sparkles,
  Plus,
  MessageSquare,
  Trash2,
  ChevronDown,
  ChevronUp,
  Flag,
  X,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { listRounds, listCourses, getSettings, getRound } from "@/lib/db/repo";
import { aggregate, summarizeRound } from "@/lib/stats";
import { useUnits } from "@/lib/units";
import { signed, formatDate } from "@/lib/util";
import type { Round, Course } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  roundIds: string[]; // manually loaded round IDs
  createdAt: number;
  updatedAt: number;
};

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = "mytraqr_chat_conversations";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

function newConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    messages: [],
    roundIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildStatsContext(
  stats: ReturnType<typeof aggregate>,
  roundCount: number,
  distUnit: string,
): string {
  const sg = stats.sgPerRound;
  const sgLines = sg
    ? [
        `SG off-tee: ${signed(sg.offTee)}/round`,
        `SG approach: ${signed(sg.approach)}/round`,
        `SG around-green: ${signed(sg.aroundGreen)}/round`,
        `SG putting: ${signed(sg.putting)}/round`,
        `SG total: ${signed(sg.total)}/round`,
      ].join(", ")
    : "SG data unavailable (need full-shot rounds)";

  return [
    `Rounds logged: ${roundCount}`,
    stats.avgScore != null ? `Avg score: ${stats.avgScore.toFixed(1)}` : null,
    stats.avgScoreToPar != null
      ? `Avg to par: ${stats.avgScoreToPar >= 0 ? "+" : ""}${stats.avgScoreToPar.toFixed(1)}`
      : null,
    stats.firPct != null ? `FIR: ${stats.firPct.toFixed(0)}%` : null,
    stats.girPct != null ? `GIR: ${stats.girPct.toFixed(0)}%` : null,
    stats.avgPutts != null ? `Putts/round: ${stats.avgPutts.toFixed(1)}` : null,
    stats.scramblingPct != null ? `Scrambling: ${stats.scramblingPct.toFixed(0)}%` : null,
    `Distance unit: ${distUnit}`,
    sgLines,
  ]
    .filter(Boolean)
    .join(" | ");
}

function buildRoundContext(round: Round, course: Course, distUnit: string): string {
  const s = summarizeRound(round, course);
  const sg = s.sg;
  const lines = [
    `Round: ${course.name} on ${round.date}`,
    s.totalScore != null ? `Score: ${s.totalScore}` : null,
    s.scoreToPar != null
      ? `To par: ${s.scoreToPar >= 0 ? "+" : ""}${s.scoreToPar}`
      : null,
    s.firs.attempts
      ? `FIR: ${s.firs.made}/${s.firs.attempts}`
      : null,
    s.girs.attempts
      ? `GIR: ${s.girs.made}/${s.girs.attempts}`
      : null,
    s.putts.measuredHoles
      ? `Putts: ${s.putts.total}`
      : null,
    sg
      ? `SG: tee ${signed(sg.offTee)}, approach ${signed(sg.approach)}, around-green ${signed(sg.aroundGreen)}, putting ${signed(sg.putting)}`
      : null,
    round.postRound?.wentWell
      ? `Player notes — went well: "${round.postRound.wentWell}"`
      : null,
    round.postRound?.needsWork
      ? `Needs work: "${round.postRound.needsWork}"`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");
  return lines;
}

function buildSystemPrompt(
  statsContext: string,
  roundContexts: string[],
): string {
  const roundSection =
    roundContexts.length > 0
      ? `\n\nManually loaded rounds:\n${roundContexts.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
      : "";

  return `You are an expert golf performance coach with deep knowledge of shot statistics, strokes gained methodology, and practice planning.

Player statistics (based on last up to 10 rounds):
${statsContext}${roundSection}

Give concise, actionable coaching advice. Be honest and direct — 2-4 short paragraphs max unless the player asks for detail. Never make up numbers not in the stats above.`;
}

// ── API call ──────────────────────────────────────────────────────────────────

async function callAi(
  systemPrompt: string,
  messages: Message[],
): Promise<string> {
  const settings = await getSettings();
  const ai = settings?.ai;

  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  // Prefer BYOK if configured, otherwise use server-side key (OPENROUTER_API_KEY in .env.local)
  if (ai?.apiKey && ai.provider) {
    const isAnthropic = ai.provider === "anthropic";
    const endpoint = isAnthropic
      ? "https://api.anthropic.com/v1/messages"
      : ai.provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const body = isAnthropic
      ? {
          model: ai.chatModel ?? "claude-haiku-4-5",
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }
      : { model: ai.chatModel ?? "gpt-4o-mini", max_tokens: 1024, messages: allMessages };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isAnthropic) {
      headers["x-api-key"] = ai.apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${ai.apiKey}`;
    }

    const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await resp.json();
    const content = isAnthropic
      ? (json?.content?.[0]?.text ?? "")
      : (json?.choices?.[0]?.message?.content ?? "");
    if (!content) throw new Error(json?.error?.message ?? "No content returned.");
    return content;
  }

  // Server proxy (uses OPENROUTER_API_KEY from .env.local — works out of the box)
  const resp = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "chat", maxTokens: 1024, messages: allMessages }),
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(
      json?.error === "No OPENROUTER_API_KEY configured on the server."
        ? "No AI key configured. Add OPENROUTER_API_KEY to .env.local or set a BYOK key in Settings."
        : (json?.error ?? "Server error."),
    );
  }
  return json.content ?? "";
}

// ── Round picker modal ────────────────────────────────────────────────────────

function RoundPicker({
  rounds,
  courses,
  selected,
  onToggle,
  onClose,
}: {
  rounds: Round[];
  courses: Map<string, Course>;
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = React.useState("");
  const filtered = rounds
    .filter((r) => !r.isDraft)
    .filter((r) => {
      if (!q) return true;
      const c = courses.get(r.courseId)?.name ?? "";
      return (
        c.toLowerCase().includes(q.toLowerCase()) ||
        r.date.includes(q) ||
        (r.title ?? "").toLowerCase().includes(q.toLowerCase())
      );
    })
    .slice(0, 30);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="font-semibold">Load rounds as context</div>
          <button onClick={onClose} className="btn btn-ghost !p-1.5">
            <X size={16} />
          </button>
        </div>
        <div className="p-3 border-b border-[var(--border)]">
          <input
            className="input"
            placeholder="Search rounds…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="muted text-sm p-3">No rounds found.</div>
          ) : (
            filtered.map((r) => {
              const c = courses.get(r.courseId);
              const isSelected = selected.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => onToggle(r.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isSelected
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <Flag size={14} className={isSelected ? "text-[var(--accent)]" : "muted"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {c?.name ?? "Unknown course"}
                    </div>
                    <div className="text-xs muted">{formatDate(r.date)}</div>
                  </div>
                  {isSelected && (
                    <span className="text-xs font-semibold text-[var(--accent)]">✓</span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="p-3 border-t border-[var(--border)] flex justify-between items-center">
          <span className="muted text-xs">
            {selected.length > 0 ? `${selected.length} round${selected.length > 1 ? "s" : ""} selected` : "No rounds selected"}
          </span>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const allRounds = useLiveQuery(() => listRounds(), [], []);
  const allCourses = useLiveQuery(() => listCourses(), [], []);
  const units = useUnits();

  // Conversations stored in localStorage
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<string>("");
  const [convListOpen, setConvListOpen] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);

  // Chat state
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Load from localStorage on mount
  React.useEffect(() => {
    const stored = loadConversations();
    if (stored.length > 0) {
      setConversations(stored);
      setActiveId(stored[0].id);
    } else {
      const first = newConversation();
      setConversations([first]);
      setActiveId(first.id);
    }
  }, []);

  // Persist whenever conversations change
  React.useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations);
  }, [conversations]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId]);

  if (allRounds === undefined || allCourses === undefined || !activeId) {
    return <div className="muted text-sm">Loading…</div>;
  }

  const coursesById = new Map(allCourses.map((c) => [c.id, c]));
  const last10 = allRounds.filter((r) => !r.isDraft).slice(0, 10);
  const stats = aggregate(last10, coursesById);
  const statsContext = buildStatsContext(stats, last10.length, units.dist);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  // Build round contexts for manually loaded rounds
  const roundContexts = active?.roundIds
    .map((id) => {
      const r = allRounds.find((x) => x.id === id);
      const c = r ? coursesById.get(r.courseId) : undefined;
      return r && c ? buildRoundContext(r, c, units.dist) : null;
    })
    .filter((x): x is string => x !== null) ?? [];

  const systemPrompt = buildSystemPrompt(statsContext, roundContexts);

  function updateActive(patch: Partial<Conversation>) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, ...patch, updatedAt: Date.now() } : c,
      ),
    );
  }

  function createConversation() {
    const conv = newConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setConvListOpen(false);
    setError(null);
    setInput("");
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = newConversation();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  function toggleRound(id: string) {
    const cur = active?.roundIds ?? [];
    updateActive({
      roundIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !active) return;
    setInput("");
    setError(null);

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages: Message[] = [...active.messages, userMsg];

    // Auto-title from first user message
    const isFirstMessage = active.messages.length === 0;
    updateActive({
      messages: updatedMessages,
      ...(isFirstMessage ? { title: text.slice(0, 48) } : {}),
    });

    setLoading(true);
    try {
      const reply = await callAi(systemPrompt, updatedMessages);
      updateActive({ messages: [...updatedMessages, { role: "assistant", content: reply }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      // Roll back the user message on error
      updateActive({ messages: active.messages });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const activeMessages = active?.messages ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)] gap-0">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)] flex-shrink-0">
        <Sparkles size={18} className="text-[var(--accent)] flex-shrink-0" />

        {/* Conversation selector */}
        <div className="relative flex-1 min-w-0">
          <button
            className="flex items-center gap-1.5 font-semibold text-sm hover:text-[var(--accent)] transition-colors max-w-full truncate"
            onClick={() => setConvListOpen((o) => !o)}
          >
            <span className="truncate">{active?.title ?? "Chat"}</span>
            {convListOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {convListOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl w-72 max-h-80 overflow-y-auto">
              <div className="p-2">
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      c.id === activeId
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "hover:bg-[var(--surface-2)]"
                    }`}
                    onClick={() => { setActiveId(c.id); setConvListOpen(false); }}
                  >
                    <MessageSquare size={13} className="flex-shrink-0" />
                    <span className="flex-1 text-sm truncate">{c.title}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 hover:text-[var(--danger)] p-0.5 rounded flex-shrink-0"
                      style={{ opacity: c.id === activeId ? 1 : undefined }}
                      onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                      title="Delete conversation"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-secondary !py-1.5 !px-2.5 text-xs flex items-center gap-1 flex-shrink-0"
          onClick={createConversation}
          title="New conversation"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {/* ── Context bar (loaded rounds) ─────────────────────────────────────── */}
      {(active?.roundIds?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 py-2 border-b border-[var(--border)] flex-shrink-0">
          <span className="text-xs muted self-center">Context:</span>
          {active.roundIds.map((id) => {
            const r = allRounds.find((x) => x.id === id);
            const c = r ? coursesById.get(r.courseId) : undefined;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 badge badge-muted text-xs"
              >
                <Flag size={10} />
                {c?.name ?? "Round"} {r ? formatDate(r.date) : ""}
                <button
                  className="hover:text-[var(--danger)] ml-0.5"
                  onClick={() => toggleRound(id)}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-0">
        {activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] grid place-items-center">
              <Sparkles size={22} className="text-[var(--accent)]" />
            </div>
            <div>
              <p className="font-semibold">Your AI golf coach</p>
              <p className="muted text-sm mt-1 max-w-sm">
                Your overall stats are always in context. Load specific rounds below for deeper analysis.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "What's my biggest weakness?",
                "What should I practice this week?",
                "Explain my SG numbers",
                "How do I stop 3-putting?",
              ].map((q) => (
                <button
                  key={q}
                  className="btn btn-secondary text-sm"
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          activeMessages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[var(--accent)] text-white rounded-br-sm"
                    : "bg-[var(--surface-2)] text-[var(--foreground)] rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--surface-2)] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="text-sm text-[var(--danger)] px-1 py-2 rounded-lg bg-[var(--danger)]/10">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────────── */}
      <div className="pt-3 border-t border-[var(--border)] flex-shrink-0 space-y-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="input flex-1 resize-none min-h-[44px] max-h-32"
            placeholder="Ask your coach…  (Enter to send · Shift+Enter for new line)"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="btn btn-primary self-end"
            onClick={send}
            disabled={!input.trim() || loading}
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="btn btn-ghost !py-1 !px-2 text-xs flex items-center gap-1"
            onClick={() => setShowPicker(true)}
          >
            <Flag size={12} />
            Load rounds{(active?.roundIds?.length ?? 0) > 0 ? ` (${active.roundIds.length})` : ""}
          </button>
          <span className="muted text-xs">
            Overall stats always loaded ·{" "}
            {active?.roundIds?.length
              ? `${active.roundIds.length} specific round${active.roundIds.length > 1 ? "s" : ""} in context`
              : "no specific rounds"}
          </span>
        </div>
      </div>

      {/* ── Round picker modal ──────────────────────────────────────────────── */}
      {showPicker && (
        <RoundPicker
          rounds={allRounds}
          courses={coursesById}
          selected={active?.roundIds ?? []}
          onToggle={toggleRound}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
