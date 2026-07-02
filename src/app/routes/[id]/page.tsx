import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeBaseline } from "@/lib/detection";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import PriceChart from "@/components/PriceChart";
import RouteForm, { type RouteFormValues } from "@/components/RouteForm";
import { CheckNowButton, DeleteRouteButton, EnabledToggle } from "@/components/RouteActions";

export const dynamic = "force-dynamic";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const routeId = Number(id);
  if (!Number.isInteger(routeId)) notFound();

  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route) notFound();

  const settings = await getSettings();
  const [snapshots, alerts, baseline] = await Promise.all([
    prisma.priceSnapshot.findMany({
      where: { routeId },
      orderBy: { capturedAt: "asc" },
      take: 1000,
    }),
    prisma.alert.findMany({
      where: { routeId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    computeBaseline(routeId, settings),
  ]);

  const latest = snapshots[snapshots.length - 1];
  // Mark snapshots that triggered an alert (same check writes both within seconds).
  const alertTimes = alerts.map((a) => ({ t: a.createdAt.getTime(), price: a.price }));
  const chartData = snapshots.map((s) => {
    const t = s.capturedAt.getTime();
    const isAlert = alertTimes.some(
      (a) => Math.abs(a.t - t) < 10 * 60_000 && a.price === s.price
    );
    return { t, price: s.price, ...(isAlert ? { alertPrice: s.price } : {}) };
  });

  let airlines: string[] = [];
  try {
    airlines = JSON.parse(route.preferredAirlines);
  } catch {
    airlines = [];
  }
  const initial: RouteFormValues = {
    origin: route.origin,
    destination: route.destination ?? "",
    tripType: route.tripType,
    departDateFrom: route.departDateFrom,
    departDateTo: route.departDateTo,
    stayDurationDays: route.stayDurationDays,
    preferredAirlines: airlines.join(", "),
    cabin: route.cabin,
    currency: route.currency,
    maxPrice: route.maxPrice != null ? String(route.maxPrice) : "",
    dropPercent: route.dropPercent,
    intervalMinutes: route.intervalMinutes,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">
          {route.origin} → {route.destination ?? "anywhere"}
          <span className="ml-2 text-sm font-normal text-[var(--ink-muted)]">
            {route.tripType === "ROUND_TRIP" ? "round trip" : "one way"} · {route.cabin.toLowerCase()}
          </span>
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <CheckNowButton routeId={route.id} />
          <EnabledToggle routeId={route.id} enabled={route.enabled} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--ink-muted)]">Latest price</p>
          <p className="mt-1 text-2xl font-semibold">
            {latest ? money(latest.price, latest.currency) : "—"}
          </p>
          {latest?.departDate && (
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">
              {latest.destination && latest.destination !== route.destination
                ? `to ${latest.destination} · `
                : ""}
              dep {latest.departDate}
              {latest.returnDate ? ` – ret ${latest.returnDate}` : ""}
              {latest.airline ? ` · ${latest.airline}` : ""}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--ink-muted)]">
            Typical ({settings.baselineWindowDays}-day baseline)
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {baseline ? money(baseline.avg, route.currency) : "building…"}
          </p>
          {baseline && (
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">
              range {money(baseline.min, route.currency)} – {money(baseline.max, route.currency)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--ink-muted)]">Alert when</p>
          <p className="mt-1 text-sm font-medium">
            price drops {route.dropPercent}% below average
            {route.maxPrice != null && (
              <>
                <br />
                or is ≤ {money(route.maxPrice, route.currency)}
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-secondary)]">
            checked every {route.intervalMinutes} min
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 text-sm font-semibold">Price history</h2>
        <PriceChart data={chartData} baseline={baseline} currency={route.currency} />
      </section>

      {alerts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Alerts on this route</h2>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border
                           border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-sm"
              >
                <span className="font-semibold text-[var(--critical)]">
                  {money(a.price, a.currency)}
                </span>
                <span className="text-xs text-[var(--ink-secondary)]">
                  {a.destination ?? route.destination ?? "anywhere"} · dep {a.departDate ?? "?"}
                  {a.returnDate ? ` – ret ${a.returnDate}` : ""}
                  {a.airline ? ` · ${a.airline}` : ""}
                </span>
                <span className="text-xs text-[var(--ink-muted)]">
                  {a.createdAt.toLocaleString("en-US")} · {a.rule.toLowerCase()} rule · email{" "}
                  {a.emailStatus.toLowerCase()}
                  {a.emailError ? ` (${a.emailError})` : ""}
                </span>
                {a.bookingLink && (
                  <a
                    href={a.bookingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs font-medium text-[var(--series-1)] hover:underline"
                  >
                    book ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Edit route</h2>
        <RouteForm routeId={route.id} initial={initial} />
        <div className="mt-6">
          <DeleteRouteButton routeId={route.id} />
        </div>
      </section>
    </div>
  );
}
