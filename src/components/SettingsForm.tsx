"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppSettings } from "@/lib/settings";

const inputCls =
  "w-full rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-sm " +
  "focus:border-[var(--series-1)] focus:outline-none";
const labelCls = "block text-xs font-medium text-[var(--ink-secondary)] mb-1";

export default function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);

  const set = (patch: Partial<AppSettings>) => setValues((v) => ({ ...v, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setStatus(null);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "Save failed");
      return;
    }
    setStatus("Settings saved.");
    router.refresh();
  }

  async function sendTest() {
    setBusy("test");
    setStatus(null);
    setError(null);
    const res = await fetch("/api/settings/test-email", { method: "POST" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "Test email failed");
      return;
    }
    setStatus("Test email sent — check your inbox.");
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="mb-1 text-sm font-semibold">Email alerts</h2>
        <p className="mb-4 text-xs text-[var(--ink-muted)]">
          The Resend API key comes from <code>RESEND_API_KEY</code> in <code>.env</code>. Empty
          fields fall back to <code>ALERT_EMAIL_FROM</code> / <code>ALERT_EMAIL_TO</code>.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="alertEmailTo">Send alerts to</label>
            <input
              id="alertEmailTo"
              type="email"
              className={inputCls}
              value={values.alertEmailTo}
              onChange={(e) => set({ alertEmailTo: e.target.value })}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="alertEmailFrom">From address</label>
            <input
              id="alertEmailFrom"
              className={inputCls}
              value={values.alertEmailFrom}
              onChange={(e) => set({ alertEmailFrom: e.target.value })}
              placeholder="Flight Alerts <onboarding@resend.dev>"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={sendTest}
          disabled={busy !== null}
          className="mt-4 rounded-lg border border-[var(--hairline)] bg-white px-3 py-1.5 text-xs
                     font-medium hover:border-[var(--series-1)] disabled:opacity-50"
        >
          {busy === "test" ? "Sending…" : "Send test email"}
        </button>
      </section>

      <section className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="mb-1 text-sm font-semibold">Detection tuning</h2>
        <p className="mb-4 text-xs text-[var(--ink-muted)]">
          The percent rule stays quiet until a route has at least the minimum snapshots and
          distinct days of history, so a brand-new route can&apos;t false-alarm.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelCls} htmlFor="cooldownHours">Alert cooldown (h)</label>
            <input
              id="cooldownHours"
              type="number"
              min={1}
              className={inputCls}
              value={values.cooldownHours}
              onChange={(e) => set({ cooldownHours: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="baselineWindowDays">Baseline window (days)</label>
            <input
              id="baselineWindowDays"
              type="number"
              min={3}
              className={inputCls}
              value={values.baselineWindowDays}
              onChange={(e) => set({ baselineWindowDays: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="minSnapshots">Min snapshots</label>
            <input
              id="minSnapshots"
              type="number"
              min={1}
              className={inputCls}
              value={values.minSnapshots}
              onChange={(e) => set({ minSnapshots: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="minDistinctDays">Min distinct days</label>
            <input
              id="minDistinctDays"
              type="number"
              min={1}
              className={inputCls}
              value={values.minDistinctDays}
              onChange={(e) => set({ minDistinctDays: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-[var(--critical)]">{error}</p>}
      {status && <p className="text-sm text-[var(--good)]">{status}</p>}

      <button
        type="submit"
        disabled={busy !== null}
        className="rounded-lg bg-[var(--series-1)] px-5 py-2 text-sm font-semibold text-white
                   hover:opacity-90 disabled:opacity-50"
      >
        {busy === "save" ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
