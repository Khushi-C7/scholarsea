"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Loader2,
  KeyRound,
  Check,
  X,
  Plug,
  Trash2,
  Download,
  Sun,
  Moon,
  Monitor,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProviderInfo } from "@/lib/ai/catalog";

interface PreferencesView {
  aiProvider: string | null;
  aiModel: string | null;
  outputLanguage: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  promptOverrides: Record<string, string>;
  providersWithKey: string[];
}
interface UsageSummary {
  analysisTokens: number;
  chatTokens: number;
  agentTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  isEstimate: true;
  pricedModel: string | null;
}
interface SettingsPayload {
  preferences: PreferencesView;
  usage: UsageSummary;
  providers: ProviderInfo[];
}

const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["hi", "Hindi"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ar", "Arabic"],
  ["ru", "Russian"],
];

const selectCls =
  "h-9 w-full rounded-md border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsClient() {
  const { setTheme } = useTheme();
  const [data, setData] = React.useState<SettingsPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // AI section local state
  const [provider, setProvider] = React.useState("");
  const [model, setModel] = React.useState("");
  const [language, setLanguage] = React.useState("en");
  const [instructions, setInstructions] = React.useState("");
  const [savingPrefs, setSavingPrefs] = React.useState(false);
  const [prefsSaved, setPrefsSaved] = React.useState(false);

  // Key + test state
  const [keyInput, setKeyInput] = React.useState("");
  const [keyBusy, setKeyBusy] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    ok: boolean;
    message: string;
    latencyMs: number | null;
  } | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const applyData = React.useCallback((body: SettingsPayload) => {
    setData(body);
    setProvider(body.preferences.aiProvider ?? "");
    setModel(body.preferences.aiModel ?? "");
    setLanguage(body.preferences.outputLanguage ?? "en");
    setInstructions(body.preferences.promptOverrides?.customInstructions ?? "");
  }, []);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/settings");
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error?.message ?? "Could not load settings.");
      return;
    }
    applyData(body);
  }, [applyData]);

  React.useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setError(body?.error?.message ?? "Could not load settings.");
          return;
        }
        applyData(body);
      })
      .catch(() => {
        if (active) setError("Could not load settings.");
      });
    return () => {
      active = false;
    };
  }, [applyData]);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[color:var(--destructive)]">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  const providers = data.providers;
  const selectedProvider = providers.find((p) => p.id === provider) ?? null;
  const models = selectedProvider?.models ?? [];
  const providerNeedsKey = selectedProvider?.requiresKey ?? false;
  const hasKey = data.preferences.providersWithKey.includes(provider);

  async function savePrefs() {
    setSavingPrefs(true);
    setPrefsSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          aiProvider: provider || null,
          aiModel: model || null,
          outputLanguage: language,
          promptOverrides: instructions.trim()
            ? { customInstructions: instructions.trim() }
            : {},
        }),
      });
      if (res.ok) {
        setPrefsSaved(true);
        await load();
        setTimeout(() => setPrefsSaved(false), 2500);
      } else {
        const b = await res.json().catch(() => null);
        setError(b?.error?.message ?? "Could not save settings.");
      }
    } finally {
      setSavingPrefs(false);
    }
  }

  async function saveKey() {
    if (!keyInput.trim() || !provider) return;
    setKeyBusy(true);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: provider, key: keyInput.trim() }),
      });
      if (res.ok) {
        setKeyInput("");
        await load();
      }
    } finally {
      setKeyBusy(false);
    }
  }

  async function removeKey() {
    setKeyBusy(true);
    try {
      await fetch("/api/settings/api-key", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: provider }),
      });
      await load();
    } finally {
      setKeyBusy(false);
    }
  }

  async function runTest() {
    if (!provider || !model) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: provider,
          modelId: model,
          ...(keyInput.trim() ? { key: keyInput.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (body) setTestResult(body);
    } finally {
      setTesting(false);
    }
  }

  async function deleteData() {
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/data", { method: "DELETE" });
      if (res.ok) {
        setConfirmDelete(false);
        await load();
      }
    } finally {
      setDeleting(false);
    }
  }

  const u = data.usage;

  return (
    <div className="space-y-5">
      {/* AI provider & model */}
      <Section
        title="AI provider & model"
        description="Choose the model used for analysis, chat, and the agent. Without a key, ScholarSea runs in clearly-labeled demo mode."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider">Provider</Label>
            <select
              id="provider"
              className={selectCls}
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                const p = providers.find((x) => x.id === e.target.value);
                setModel(p?.models[0]?.id ?? "");
                setTestResult(null);
              }}
            >
              <option value="">— None (demo mode) —</option>
              {providers
                .filter((p) => p.id !== "demo")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <select
              id="model"
              className={selectCls}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!selectedProvider}
            >
              {models.length === 0 ? <option value="">—</option> : null}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* API key for the selected provider */}
        {providerNeedsKey ? (
          <div className="mt-4 rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="size-4" /> API key
              </div>
              {hasKey ? (
                <span className="inline-flex items-center gap-1 text-xs text-[color:var(--success)]">
                  <Check className="size-3.5" /> Stored (encrypted)
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not set</span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Keys are encrypted on the server (AES-256-GCM) before storage and
              never sent back to the browser, logged, or committed.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                type="password"
                autoComplete="off"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={hasKey ? "Replace stored key…" : "Paste API key…"}
                className="h-9 max-w-xs flex-1"
              />
              <Button size="sm" onClick={saveKey} disabled={keyBusy || !keyInput.trim()}>
                {keyBusy ? <Loader2 className="animate-spin" /> : null} Save key
              </Button>
              <Button size="sm" variant="outline" onClick={runTest} disabled={testing || !model}>
                {testing ? <Loader2 className="animate-spin" /> : <Plug />} Test
              </Button>
              {hasKey ? (
                <Button size="sm" variant="ghost" onClick={removeKey} disabled={keyBusy}>
                  Remove
                </Button>
              ) : null}
            </div>
            {testResult ? (
              <div
                className={[
                  "mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs",
                  testResult.ok
                    ? "bg-success/10 text-[color:var(--success)]"
                    : "bg-destructive/10 text-[color:var(--destructive)]",
                ].join(" ")}
              >
                {testResult.ok ? (
                  <Check className="mt-0.5 size-3.5 shrink-0" />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0" />
                )}
                <span>
                  {testResult.message}
                  {testResult.latencyMs != null
                    ? ` (${testResult.latencyMs} ms)`
                    : ""}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>

      {/* Output language + prompt customization */}
      <Section
        title="Output & prompts"
        description="Preferred output language and optional custom instructions appended to analysis and chat prompts."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lang">Output language</Label>
            <select
              id="lang"
              className={selectCls + " max-w-xs"}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instructions">Custom instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Prefer concise bullet points; emphasize reproducibility details."
              className="min-h-24"
            />
            <p className="text-xs text-muted-foreground">
              Added to the system prompt for chat answers. Leave blank for defaults.
            </p>
          </div>
        </div>
      </Section>

      {/* Theme */}
      <Section title="Theme" description="Applies immediately and is saved to your account.">
        <div className="flex gap-2">
          {([
            ["LIGHT", "light", Sun, "Light"],
            ["DARK", "dark", Moon, "Dark"],
            ["SYSTEM", "system", Monitor, "System"],
          ] as const).map(([pref, mode, Icon, label]) => (
            <Button
              key={pref}
              variant={data.preferences.theme === pref ? "default" : "outline"}
              size="sm"
              onClick={async () => {
                setTheme(mode);
                await fetch("/api/settings", {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ theme: pref }),
                });
                await load();
              }}
            >
              <Icon /> {label}
            </Button>
          ))}
        </div>
      </Section>

      {/* Save preferences */}
      <div className="flex items-center gap-3">
        <Button onClick={savePrefs} disabled={savingPrefs}>
          {savingPrefs ? <Loader2 className="animate-spin" /> : null} Save settings
        </Button>
        {prefsSaved ? (
          <span className="inline-flex items-center gap-1 text-sm text-[color:var(--success)]">
            <Check className="size-4" /> Saved
          </span>
        ) : null}
      </div>

      {/* Token usage & estimated cost */}
      <Section
        title="Usage & estimated cost"
        description="Token counts are the actual totals providers reported. The cost is a rough estimate from approximate list prices — not a bill."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Analysis" value={u.analysisTokens.toLocaleString()} />
          <Stat label="Chat" value={u.chatTokens.toLocaleString()} />
          <Stat label="Agent" value={u.agentTokens.toLocaleString()} />
          <Stat label="Total tokens" value={u.totalTokens.toLocaleString()} />
        </div>
        <div className="mt-3 rounded-lg border bg-background px-4 py-3 text-sm">
          {u.estimatedCostUsd != null ? (
            <>
              <span className="font-semibold">
                ~${u.estimatedCostUsd.toFixed(4)}
              </span>{" "}
              <span className="text-muted-foreground">
                estimated ({u.pricedModel ?? "selected model"}, 50/50
                input/output split) — estimate only, not an invoice.
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              No cost estimate: the selected model has no known price (demo or
              custom provider).
            </span>
          )}
        </div>
      </Section>

      {/* Data management */}
      <Section
        title="Data management"
        description="Export everything you've created, or permanently delete your research data. Your account and settings are kept."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/settings/data">
              <Download /> Export my data (JSON)
            </a>
          </Button>
          {!confirmDelete ? (
            <Button
              variant="outline"
              size="sm"
              className="text-[color:var(--destructive)]"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Delete research data
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5">
              <AlertTriangle className="size-4 text-[color:var(--destructive)]" />
              <span className="text-xs">Delete all papers, projects, chats, and runs?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[color:var(--destructive)] text-white hover:opacity-90"
                onClick={deleteData}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="animate-spin" /> : null} Delete
              </Button>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
