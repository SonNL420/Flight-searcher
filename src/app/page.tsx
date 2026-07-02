import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeBaseline } from "@/lib/detection";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { EnabledToggle } from "@/components/RouteActions";

export const dynamic = "force-dynamic";

function timeAgo(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function OverviewPage() {
  const settings = await getSettings();
  const [routes, alerts] = await Promise.all([
    prisma.route.findMany({
      orderBy: { createdAt: "asc" },
      include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
    }),
    prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { route: true },
    }),
  ]);
  const baselines = await Promise.all(routes.map((r) => computeBaseline(r.id, settings)));

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Monitored routes</h1>
          <Link
            href="/routes/new"
            className="rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add route
          </Link>
        </div>

        {routes.length === 0 ? (
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-10 text-center">
            <p className="text-sm text-[var(--ink-secondary)]">
              No routes yet. Add one to start tracking prices and catching error fares.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)] text-left text-xs text-[var(--ink-muted)]">
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 font-medium">Latest price</th>
                  <th className="px-4 py-3 font-medium">Typical (30d avg)</th>
                  <th className="px-4 py-3 font-medium">Thresholds</th>
                  <th className="px-4 py-3 font-medium">Every</th>
                  <th className="px-4 py-3 font-medium">Checked</th>
                  <th className="px-4 py-3 font-medium">On</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r, i) => {
                  const latest = r.snapshots[0];
                  const baseline = baselines[i];
                  return (
                    <tr key={r.id} className="border-b border-[var(--hairline)] last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/routes/${r.id}`}
                          className="font-semibold hover:text-[var(--series-1)]"
                        >
                          {r.origin} → {r.destination ?? "anywhere"}
                        </Link>
                        <span className="ml-2 text-xs text-[var(--ink-muted)]">
                          {r.tripType === "ROUND_TRIP" ? "round trip" : "one way"}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {latest ? money(latest.price, latest.currency) : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--ink-secondary)]">
                        {baseline ? money(baseline.avg, r.currency) : "building…"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--ink-secondary)]">
                        −{r.dropPercent}%
                        {r.maxPrice != null && <> or ≤ {money(r.maxPrice, r.currency)}</>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--ink-secondary)]">
                        {r.intervalMinutes}m
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--ink-secondary)]">
                        {r.lastCheckedAt ? timeAgo(r.lastCheckedAt) : "never"}
                      </td>
                      <td className="px-4 py-3">
                        <EnabledToggle routeId={r.id} enabled={r.enabled} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Recent alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-[var(--ink-secondary)]">
            Nothing yet — you&apos;ll see detected glitches here (and in your inbox).
          </p>
        ) : (
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
                <Link href={`/routes/${a.routeId}`} className="font-medium hover:text-[var(--series-1)]">
                  {a.route.origin} → {a.destination ?? a.route.destination ?? "anywhere"}
                </Link>
                {a.baselineAvg != null && (
                  <span className="text-xs text-[var(--ink-secondary)]">
                    typical {money(a.baselineAvg, a.currency)}
                  </span>
                )}
                <span className="text-xs text-[var(--ink-muted)]">
                  {a.rule === "ABSOLUTE" ? "below your threshold" : "below average"} ·{" "}
                  {timeAgo(a.createdAt)} · email {a.emailStatus.toLowerCase()}
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
        )}
      </section>
    </div>
  );
}
