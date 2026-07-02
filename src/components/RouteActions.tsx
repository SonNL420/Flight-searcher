"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EnabledToggle({ routeId, enabled }: { routeId: number; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/routes/${routeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      role="switch"
      aria-checked={enabled}
      title={enabled ? "Monitoring on — click to pause" : "Paused — click to resume"}
      className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
        enabled ? "bg-[var(--series-1)]" : "bg-[var(--hairline)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          enabled ? "left-4.5" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function CheckNowButton({ routeId }: { routeId: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function check() {
    setState("busy");
    setMessage(null);
    const res = await fetch(`/api/routes/${routeId}/check`, { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setState("error");
      setMessage(body?.error ?? "Check failed");
      return;
    }
    setState("idle");
    setMessage(
      body.fare
        ? body.alerted
          ? "Glitch detected — alert sent!"
          : "Checked — no glitch."
        : `No fare found${body.note ? ` (${body.note})` : ""}`
    );
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={check}
        disabled={state === "busy"}
        className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-1.5 text-xs
                   font-medium hover:border-[var(--series-1)] disabled:opacity-50"
      >
        {state === "busy" ? "Checking…" : "Check now"}
      </button>
      {message && (
        <span
          className={`text-xs ${state === "error" ? "text-[var(--critical)]" : "text-[var(--ink-secondary)]"}`}
        >
          {message}
        </span>
      )}
    </span>
  );
}

export function DeleteRouteButton({ routeId }: { routeId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    await fetch(`/api/routes/${routeId}`, { method: "DELETE" }).catch(() => null);
    router.push("/");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-1.5 text-xs
                   font-medium text-[var(--critical)] hover:border-[var(--critical)]"
      >
        Delete route
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-[var(--ink-secondary)]">Delete route and all its history?</span>
      <button
        onClick={del}
        disabled={busy}
        className="rounded-lg bg-[var(--critical)] px-3 py-1.5 font-medium text-white disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-1.5 font-medium"
      >
        Cancel
      </button>
    </span>
  );
}
