"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface RouteFormValues {
  origin: string;
  destination: string;
  tripType: string;
  departDateFrom: string;
  departDateTo: string;
  stayDurationDays: number;
  preferredAirlines: string; // comma-separated in the form
  cabin: string;
  currency: string;
  maxPrice: string;
  dropPercent: number;
  intervalMinutes: number;
}

const EMPTY: RouteFormValues = {
  origin: "",
  destination: "",
  tripType: "ROUND_TRIP",
  departDateFrom: "",
  departDateTo: "",
  stayDurationDays: 7,
  preferredAirlines: "",
  cabin: "ECONOMY",
  currency: "USD",
  maxPrice: "",
  dropPercent: 40,
  intervalMinutes: 60,
};

const inputCls =
  "w-full rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-sm " +
  "focus:border-[var(--series-1)] focus:outline-none";
const labelCls = "block text-xs font-medium text-[var(--ink-secondary)] mb-1";

export default function RouteForm({
  routeId,
  initial,
}: {
  routeId?: number;
  initial?: RouteFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<RouteFormValues>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<RouteFormValues>) => setValues((v) => ({ ...v, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(routeId ? `/api/routes/${routeId}` : "/api/routes", {
      method: routeId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "Request failed");
      return;
    }
    const route = await res.json();
    router.push(`/routes/${route.id}`);
    router.refresh();
  }

  const roundTrip = values.tripType === "ROUND_TRIP";

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="mb-4 text-sm font-semibold">Route</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="origin">Origin (IATA)</label>
            <input
              id="origin"
              className={inputCls}
              value={values.origin}
              onChange={(e) => set({ origin: e.target.value.toUpperCase() })}
              placeholder="JFK"
              maxLength={3}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="destination">Destination</label>
            <input
              id="destination"
              className={inputCls}
              value={values.destination}
              onChange={(e) => set({ destination: e.target.value.toUpperCase() })}
              placeholder="HND — empty = anywhere"
              maxLength={3}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="tripType">Trip</label>
            <select
              id="tripType"
              className={inputCls}
              value={values.tripType}
              onChange={(e) => set({ tripType: e.target.value })}
            >
              <option value="ROUND_TRIP">Round trip</option>
              <option value="ONE_WAY">One way</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="departDateFrom">Depart window from</label>
            <input
              id="departDateFrom"
              type="date"
              className={inputCls}
              value={values.departDateFrom}
              onChange={(e) => set({ departDateFrom: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="departDateTo">Depart window to</label>
            <input
              id="departDateTo"
              type="date"
              className={inputCls}
              value={values.departDateTo}
              onChange={(e) => set({ departDateTo: e.target.value })}
              required
            />
          </div>
          {roundTrip && (
            <div>
              <label className={labelCls} htmlFor="stayDurationDays">Stay (days)</label>
              <input
                id="stayDurationDays"
                type="number"
                min={1}
                max={90}
                className={inputCls}
                value={values.stayDurationDays}
                onChange={(e) => set({ stayDurationDays: Number(e.target.value) })}
              />
            </div>
          )}
          <div>
            <label className={labelCls} htmlFor="preferredAirlines">Airlines (optional)</label>
            <input
              id="preferredAirlines"
              className={inputCls}
              value={values.preferredAirlines}
              onChange={(e) => set({ preferredAirlines: e.target.value.toUpperCase() })}
              placeholder="DL, KE — empty = any"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="cabin">Cabin</label>
            <select
              id="cabin"
              className={inputCls}
              value={values.cabin}
              onChange={(e) => set({ cabin: e.target.value })}
            >
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="currency">Currency</label>
            <input
              id="currency"
              className={inputCls}
              value={values.currency}
              onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
              maxLength={3}
              required
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="mb-1 text-sm font-semibold">Glitch thresholds</h2>
        <p className="mb-4 text-xs text-[var(--ink-muted)]">
          An alert fires when the price is below the absolute threshold, or drops the given
          percent below the route&apos;s historical average (once enough history exists).
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="maxPrice">
              Absolute threshold ({values.currency || "USD"})
            </label>
            <input
              id="maxPrice"
              type="number"
              min={1}
              step="any"
              className={inputCls}
              value={values.maxPrice}
              onChange={(e) => set({ maxPrice: e.target.value })}
              placeholder="e.g. 350 — empty = off"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="dropPercent">Drop below average (%)</label>
            <input
              id="dropPercent"
              type="number"
              min={1}
              max={95}
              className={inputCls}
              value={values.dropPercent}
              onChange={(e) => set({ dropPercent: Number(e.target.value) })}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="intervalMinutes">Check every (minutes)</label>
            <input
              id="intervalMinutes"
              type="number"
              min={5}
              max={10080}
              className={inputCls}
              value={values.intervalMinutes}
              onChange={(e) => set({ intervalMinutes: Number(e.target.value) })}
              required
            />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-[var(--critical)]">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-[var(--series-1)] px-5 py-2 text-sm font-semibold text-white
                   hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : routeId ? "Save changes" : "Start monitoring"}
      </button>
    </form>
  );
}
