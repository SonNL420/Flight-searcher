const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CABINS = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"];
const TRIP_TYPES = ["ROUND_TRIP", "ONE_WAY"];

export interface RouteInput {
  origin: string;
  destination: string | null;
  tripType: string;
  departDateFrom: string;
  departDateTo: string;
  stayDurationDays: number;
  preferredAirlines: string;
  cabin: string;
  currency: string;
  maxPrice: number | null;
  dropPercent: number;
  intervalMinutes: number;
  enabled: boolean;
}

type Result = { ok: true; data: RouteInput } | { ok: false; error: string };

export function parseRouteInput(body: unknown): Result {
  const b = (body ?? {}) as Record<string, unknown>;
  const err = (error: string): Result => ({ ok: false, error });

  const origin = String(b.origin ?? "").trim().toUpperCase();
  if (!IATA.test(origin)) return err("Origin must be a 3-letter IATA code, e.g. JFK");

  const destRaw = String(b.destination ?? "").trim().toUpperCase();
  const destination = destRaw === "" || destRaw === "ANYWHERE" ? null : destRaw;
  if (destination !== null && !IATA.test(destination)) {
    return err("Destination must be a 3-letter IATA code or empty for anywhere");
  }

  const tripType = String(b.tripType ?? "ROUND_TRIP");
  if (!TRIP_TYPES.includes(tripType)) return err("Invalid trip type");

  const departDateFrom = String(b.departDateFrom ?? "");
  const departDateTo = String(b.departDateTo ?? "");
  if (!DATE.test(departDateFrom) || !DATE.test(departDateTo)) {
    return err("Departure window dates must be YYYY-MM-DD");
  }
  if (departDateFrom > departDateTo) {
    return err("Departure window start must be before its end");
  }

  const stayDurationDays = Math.round(Number(b.stayDurationDays ?? 7));
  if (!Number.isFinite(stayDurationDays) || stayDurationDays < 1 || stayDurationDays > 90) {
    return err("Stay duration must be between 1 and 90 days");
  }

  let airlines: string[] = [];
  if (Array.isArray(b.preferredAirlines)) {
    airlines = b.preferredAirlines.map((a) => String(a).trim().toUpperCase()).filter(Boolean);
  } else if (typeof b.preferredAirlines === "string") {
    airlines = b.preferredAirlines
      .split(",")
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);
  }
  if (airlines.some((a) => !/^[A-Z0-9]{2}$/.test(a))) {
    return err("Airlines must be 2-character IATA codes, comma-separated (e.g. DL, KE)");
  }

  const cabin = String(b.cabin ?? "ECONOMY");
  if (!CABINS.includes(cabin)) return err("Invalid cabin class");

  const currency = String(b.currency ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return err("Currency must be a 3-letter code, e.g. USD");

  const maxPriceRaw = b.maxPrice;
  const maxPrice =
    maxPriceRaw === null || maxPriceRaw === undefined || maxPriceRaw === ""
      ? null
      : Number(maxPriceRaw);
  if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice <= 0)) {
    return err("Absolute price threshold must be a positive number or empty");
  }

  const dropPercent = Number(b.dropPercent ?? 40);
  if (!Number.isFinite(dropPercent) || dropPercent < 1 || dropPercent > 95) {
    return err("Drop percent must be between 1 and 95");
  }

  const intervalMinutes = Math.round(Number(b.intervalMinutes ?? 60));
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 10080) {
    return err("Check interval must be between 5 minutes and 7 days");
  }

  return {
    ok: true,
    data: {
      origin,
      destination,
      tripType,
      departDateFrom,
      departDateTo,
      stayDurationDays,
      preferredAirlines: JSON.stringify(airlines),
      cabin,
      currency,
      maxPrice,
      dropPercent,
      intervalMinutes,
      enabled: b.enabled === undefined ? true : Boolean(b.enabled),
    },
  };
}
