import type { Route } from "@prisma/client";
import { prisma } from "./db";
import type { AppSettings } from "./settings";

export interface Baseline {
  /** Average of each day's cheapest observed price over the window. */
  avg: number;
  /** Cheapest daily-minimum in the window (bottom of the "normal" range). */
  min: number;
  /** Highest daily-minimum in the window (top of the "normal" range). */
  max: number;
  snapshotCount: number;
  distinctDays: number;
}

export async function computeBaseline(
  routeId: number,
  settings: AppSettings
): Promise<Baseline | null> {
  const since = new Date(Date.now() - settings.baselineWindowDays * 24 * 3600 * 1000);
  const snapshots = await prisma.priceSnapshot.findMany({
    where: { routeId, capturedAt: { gte: since } },
    select: { price: true, capturedAt: true },
  });
  if (snapshots.length === 0) return null;

  const dailyMin = new Map<string, number>();
  for (const s of snapshots) {
    const day = s.capturedAt.toISOString().slice(0, 10);
    const prev = dailyMin.get(day);
    if (prev === undefined || s.price < prev) dailyMin.set(day, s.price);
  }
  const mins = [...dailyMin.values()];
  return {
    avg: mins.reduce((a, b) => a + b, 0) / mins.length,
    min: Math.min(...mins),
    max: Math.max(...mins),
    snapshotCount: snapshots.length,
    distinctDays: dailyMin.size,
  };
}

export type GlitchRule = "PERCENT" | "ABSOLUTE";

/**
 * Decide whether a price is a glitch.
 *  - ABSOLUTE: price <= route.maxPrice (works from day one).
 *  - PERCENT: price is at least route.dropPercent% below the baseline average,
 *    but only once enough history exists to trust the baseline.
 */
export function evaluateGlitch(
  price: number,
  route: Route,
  baseline: Baseline | null,
  settings: AppSettings
): GlitchRule | null {
  if (route.maxPrice != null && price <= route.maxPrice) return "ABSOLUTE";

  if (
    baseline &&
    baseline.snapshotCount >= settings.minSnapshots &&
    baseline.distinctDays >= settings.minDistinctDays &&
    price <= baseline.avg * (1 - route.dropPercent / 100)
  ) {
    return "PERCENT";
  }
  return null;
}

/**
 * Cooldown/dedup: suppress a repeat alert for the same route within the
 * cooldown window unless the new price undercuts the alerted price by >= 10%.
 */
export async function passesCooldown(
  routeId: number,
  price: number,
  settings: AppSettings
): Promise<boolean> {
  const since = new Date(Date.now() - settings.cooldownHours * 3600 * 1000);
  const recent = await prisma.alert.findFirst({
    where: { routeId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (!recent) return true;
  return price <= recent.price * 0.9;
}
