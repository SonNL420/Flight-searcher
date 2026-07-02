import type { Route } from "@prisma/client";
import { searchAnywhere, searchCheapestOffer } from "@/lib/flights/travelpayouts";
import type { FoundFare } from "@/lib/flights/types";
import { prisma } from "@/lib/db";
import { computeBaseline, evaluateGlitch, passesCooldown, type GlitchRule } from "@/lib/detection";
import { sendAlertEmail } from "@/lib/email";
import { googleFlightsLink } from "@/lib/links";
import { getSettings } from "@/lib/settings";

export interface CheckOutcome {
  routeId: number;
  label: string;
  fare: FoundFare | null;
  alerted: boolean;
  rule?: GlitchRule;
  note?: string;
}

export function routeLabel(route: Route): string {
  return `${route.origin} → ${route.destination ?? "anywhere"}`;
}

function parseAirlines(route: Route): string[] {
  try {
    const parsed = JSON.parse(route.preferredAirlines);
    return Array.isArray(parsed) ? parsed.filter((a) => typeof a === "string") : [];
  } catch {
    return [];
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pick up to `n` evenly spaced departure dates inside the route's window,
 * skipping dates in the past. Sampling (instead of scanning every day)
 * keeps API usage within the daily budget.
 */
export function sampleDates(from: string, to: string, n = 3): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const start = from < today ? today : from;
  if (start > to) return [];
  const startD = new Date(`${start}T00:00:00Z`);
  const span = Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - startD.getTime()) / 86_400_000
  );
  const count = Math.min(n, span + 1);
  const dates = new Set<string>();
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : Math.round((span * i) / (count - 1));
    dates.add(addDays(start, offset));
  }
  return [...dates];
}

async function findCheapestFare(route: Route): Promise<{ fare: FoundFare | null; note?: string }> {
  const oneWay = route.tripType === "ONE_WAY";
  const airlines = parseAirlines(route);

  if (!route.destination) {
    const fares = await searchAnywhere({
      origin: route.origin,
      currency: route.currency,
      airlines,
    });
    if (fares.length === 0) return { fare: null, note: "no destinations returned" };
    return { fare: fares.reduce((a, b) => (a.price <= b.price ? a : b)) };
  }

  const dates = sampleDates(route.departDateFrom, route.departDateTo);
  if (dates.length === 0) {
    return { fare: null, note: "departure window is entirely in the past" };
  }
  let cheapest: FoundFare | null = null;
  for (const departDate of dates) {
    const fare = await searchCheapestOffer({
      origin: route.origin,
      destination: route.destination,
      departDate,
      returnDate: oneWay ? undefined : addDays(departDate, route.stayDurationDays),
      currency: route.currency,
      airlines,
    });
    if (fare && (!cheapest || fare.price < cheapest.price)) cheapest = fare;
  }
  return { fare: cheapest, note: cheapest ? undefined : "no offers found" };
}

export async function checkRoute(route: Route): Promise<CheckOutcome> {
  const label = routeLabel(route);
  const settings = await getSettings();
  const done = async (outcome: Omit<CheckOutcome, "routeId" | "label">) => {
    await prisma.route.update({
      where: { id: route.id },
      data: { lastCheckedAt: new Date() },
    });
    return { routeId: route.id, label, ...outcome };
  };

  const { fare, note } = await findCheapestFare(route);
  if (!fare) return done({ fare: null, alerted: false, note });

  const bookingLink = fare.link ?? googleFlightsLink(fare);

  // Baseline is computed from history *before* today's price is added, so a
  // glitch price can't drag its own baseline down.
  const baseline = await computeBaseline(route.id, settings);

  await prisma.priceSnapshot.create({
    data: {
      routeId: route.id,
      price: fare.price,
      currency: fare.currency,
      airline: fare.airline,
      destination: fare.destination,
      departDate: fare.departDate,
      returnDate: fare.returnDate,
      details: JSON.stringify({
        segments: fare.segments,
        stops: fare.stops,
        duration: fare.duration,
      }),
      bookingLink,
    },
  });

  const rule = evaluateGlitch(fare.price, route, baseline, settings);
  if (!rule) return done({ fare, alerted: false });

  if (!(await passesCooldown(route.id, fare.price, settings))) {
    return done({ fare, alerted: false, rule, note: "suppressed by cooldown" });
  }

  const detectedAt = new Date();
  const alert = await prisma.alert.create({
    data: {
      routeId: route.id,
      price: fare.price,
      currency: fare.currency,
      baselineAvg: baseline?.avg,
      baselineMin: baseline?.min,
      baselineMax: baseline?.max,
      rule,
      destination: fare.destination,
      departDate: fare.departDate,
      returnDate: fare.returnDate,
      airline: fare.airline,
      details: JSON.stringify({ segments: fare.segments, stops: fare.stops }),
      bookingLink,
    },
  });

  const result = await sendAlertEmail({ fare, rule, baseline, bookingLink, detectedAt }, settings);
  await prisma.alert.update({
    where: { id: alert.id },
    data: { emailStatus: result.status, emailError: result.error },
  });

  return done({ fare, alerted: true, rule, note: `email ${result.status.toLowerCase()}` });
}
