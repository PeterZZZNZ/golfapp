"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Upload, Trash2, AlertTriangle, Sparkles, Eye, EyeOff } from "lucide-react";
import {
  clearAll,
  exportAll,
  getSettings,
  importAll,
  saveSettings,
} from "@/lib/db/repo";
import type { Settings, AiProvider } from "@/lib/types";
import { DEFAULT_MODEL, PROVIDER_LABEL } from "@/lib/ai/scorecard";
import { DEFAULT_MODELS, ROLE_HINTS, ROLE_LABELS, type AiRole } from "@/lib/ai/models";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";

export default function SettingsPage() {
  const s = useLiveQuery(() => getSettings(), [], undefined);
  const [local, setLocal] = React.useState<Settings | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [showKey, setShowKey] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (s && !local) setLocal(s);
  }, [s, local]);

  if (!local) return <div className="muted">Loading…</div>;

  const aiProvider = local.ai?.provider;

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(local);
      setMessage("Settings saved.");
      setTimeout(() => setMessage(null), 2000);
    } finally {
      setSaving(false);
    }
  };

  const doExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `golf-tracker-${data.exportedAt}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File, mode: "merge" | "replace") => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importAll(json, mode);
      setMessage(`Imported (${mode}).`);
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage(`Import failed: ${(e as Error).message}`);
    }
  };

  const doReset = async () => {
    const confirmation = prompt('Type "delete" to permanently clear every course, round, note, and setting.');
    if (confirmation?.toLowerCase() !== "delete") return;
    await clearAll();
    setMessage("All data cleared.");
    setLocal({
      units: "m",
      puttingUnits: "ft",
      tempUnits: "C",
      handedness: "right",
    });
  };

  const updateAi = (patch: Partial<NonNullable<Settings["ai"]>>) => {
    setLocal({
      ...local,
      ai: { ...(local.ai ?? {}), ...patch },
    });
  };

  const clearAiKey = () => {
    const { apiKey: _drop, ...rest } = local.ai ?? {};
    void _drop;
    setLocal({ ...local, ai: rest });
  };

  return (
    <div className="space-y-5 fade-in">
      <div>
        <div className="h1">Settings</div>
        <div className="muted text-sm mt-1">
          Preferences and data management. Everything lives on this device.
        </div>
      </div>

      <Card>
        <CardHeader title="Preferences" />
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Distance units" hint="Used for tee yardages, drives, and approach distances.">
            <div className="flex gap-1.5">
              {(["m", "yd"] as const).map((u) => (
                <Chip
                  key={u}
                  active={local.units === u}
                  onClick={() => setLocal({ ...local, units: u })}
                >
                  {u === "m" ? "Meters" : "Yards"}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Putting distance" hint="Used for shots on the green and all putt stats.">
            <div className="flex gap-1.5">
              {(["ft", "m"] as const).map((u) => (
                <Chip
                  key={u}
                  active={local.puttingUnits === u}
                  onClick={() => setLocal({ ...local, puttingUnits: u })}
                >
                  {u === "ft" ? "Feet" : "Meters"}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Temperature">
            <div className="flex gap-1.5">
              {(["C", "F"] as const).map((u) => (
                <Chip
                  key={u}
                  active={local.tempUnits === u}
                  onClick={() => setLocal({ ...local, tempUnits: u })}
                >
                  °{u}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Handedness">
            <div className="flex gap-1.5">
              {(["right", "left"] as const).map((h) => (
                <Chip
                  key={h}
                  active={local.handedness === h}
                  onClick={() => setLocal({ ...local, handedness: h })}
                >
                  {h}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Default tee">
            <Input
              value={local.defaultTee ?? ""}
              onChange={(e) =>
                setLocal({ ...local, defaultTee: e.target.value || undefined })
              }
              placeholder="White"
            />
          </Field>
          <Field label="Handicap">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={local.handicap ?? ""}
              onChange={(e) =>
                setLocal({
                  ...local,
                  handicap:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="12.0"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="primary" onClick={save} disabled={saving}>
            Save preferences
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="AI"
          subtitle="Scorecard scanning works out of the box (server-provided key). Configure a BYOK provider below only if you want to use your own API key."
          right={<Sparkles size={16} className="text-[var(--accent,#7cc98a)]" />}
        />
        <div className="space-y-4">

          {/* Server-default model overview */}
          <div className="card-2 p-3 space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wider muted mb-2">Server defaults (no setup required)</div>
            {(["vision", "bulk", "chat"] as AiRole[]).map((role) => (
              <div key={role} className="flex items-center justify-between gap-2 text-sm">
                <span className="muted">{ROLE_LABELS[role]}</span>
                <span className="font-mono text-xs badge badge-muted">{DEFAULT_MODELS[role]}</span>
              </div>
            ))}
          </div>

          {/* BYOK (optional override) */}
          <details>
            <summary className="cursor-pointer text-sm font-medium select-none text-[var(--accent)]">
              BYOK override (optional)
            </summary>
            <div className="mt-3 space-y-4">
              <div className="muted text-xs">
                Select a provider and enter your own API key to override the server defaults.
                Your key is stored only on this device and sent directly to the provider.
              </div>
              <Field label="Provider">
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    active={!aiProvider}
                    onClick={() => setLocal({ ...local, ai: undefined })}
                  >
                    None (server key)
                  </Chip>
                  {(["openai", "anthropic", "openrouter"] as AiProvider[]).map((p) => (
                    <Chip
                      key={p}
                      active={aiProvider === p}
                      onClick={() =>
                        updateAi({
                          provider: p,
                          model: DEFAULT_MODEL[p],
                        })
                      }
                    >
                      {PROVIDER_LABEL[p]}
                    </Chip>
                  ))}
                </div>
              </Field>

              {aiProvider ? (
                <div className="space-y-3">
                  <Field label={`${PROVIDER_LABEL[aiProvider]} API key`}>
                    <div className="flex gap-2">
                      <Input
                        type={showKey ? "text" : "password"}
                        autoComplete="off"
                        value={local.ai?.apiKey ?? ""}
                        onChange={(e) => updateAi({ apiKey: e.target.value })}
                        placeholder={
                          aiProvider === "openai"
                            ? "sk-…"
                            : aiProvider === "anthropic"
                              ? "sk-ant-…"
                              : "sk-or-v1-…"
                        }
                      />
                      <Button
                        variant="ghost"
                        onClick={() => setShowKey((v) => !v)}
                        aria-label={showKey ? "Hide key" : "Show key"}
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </div>
                    {local.ai?.apiKey ? (
                      <button
                        type="button"
                        className="muted text-xs underline mt-1 self-start"
                        onClick={clearAiKey}
                      >
                        Remove saved key
                      </button>
                    ) : null}
                  </Field>

                  {/* Per-role model overrides */}
                  <div className="grid md:grid-cols-3 gap-3">
                    {(["vision", "bulk", "chat"] as AiRole[]).map((role) => {
                      const fieldKey =
                        role === "vision"
                          ? "model"
                          : role === "bulk"
                            ? "bulkModel"
                            : "chatModel";
                      const currentVal = (local.ai as Record<string, string | undefined>)?.[fieldKey] ?? "";
                      return (
                        <Field
                          key={role}
                          label={ROLE_LABELS[role]}
                          hint={ROLE_HINTS[role]}
                        >
                          <Input
                            value={currentVal}
                            onChange={(e) =>
                              updateAi({ [fieldKey]: e.target.value || undefined })
                            }
                            placeholder={
                              aiProvider === "openrouter"
                                ? DEFAULT_MODELS[role]
                                : DEFAULT_MODEL[aiProvider]
                            }
                          />
                        </Field>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="primary" onClick={save} disabled={saving}>
            Save AI settings
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Data"
          subtitle="Back up or migrate everything as a single JSON file."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={doExport}>
            <Download size={14} /> Export as JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const mode = (window.confirm(
                "OK = MERGE with existing data. Cancel = REPLACE everything."
              )
                ? "merge"
                : "replace") as "merge" | "replace";
              await doImport(f, mode);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> Import JSON
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Danger zone"
          subtitle="Permanent, local-only actions."
          right={<AlertTriangle size={16} className="text-[var(--danger)]" />}
        />
        <Button variant="danger" onClick={doReset}>
          <Trash2 size={14} /> Delete all data
        </Button>
      </Card>

      {message ? (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 card px-4 py-2 text-sm shadow-lg">
          {message}
        </div>
      ) : null}
    </div>
  );
}
