import { assertProviderConfigured, config } from "../config";
import { politeFetch } from "../rateLimit";
import type { FoundFare, TpDirection, TpEnvelope, TpTicket } from "./types";

const BASE = "https://api.travelpayouts.com";

async function apiGet<T>(path: string, params: Record<string, string>): Promise<TpEnvelope<T>> {
  assertProviderConfigured();
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== "") url.searchParams.set(k, v);
  }
  const res = await politeFetch(url.toString(), {
    headers: {
      "X-Access-Token": config.travelpayouts.token,
      "Accept-Encoding": "gzip, deflate",
    },
  });
  const body = (await res.json().catch(() => ({}))) as TpEnvelope<T>;
  if (!res.ok || body.success === false) {
    throw new Error(`Travelpayouts ${path} failed (${res.status}): ${body.error ?? "unknown error"}`);
  }
  return body;
}

function ticketToFare(t: TpTicket, currency: string): FoundFare {
  const departAt = t.departure_at ?? "";
  const flightNumber = t.airline
    ? `${t.airline}${t.flight_number ?? ""}`
    : String(t.flight_number ?? "");
  return {
    price: Number(t.price),
    currency,
    origin: t.origin,
    destination: t.destination,
    departDate: departAt.slice(0, 10),
    returnDate: t.return_at ? t.return_at.slice(0, 10) : undefined,
    airline: t.airline,
    segments: departAt
      ? [
          {
            from: t.origin_airport ?? t.origin,
            to: t.destination_airport ?? t.destination,
            departAt,
            arriveAt: "",
            carrier: t.airline ?? "",
            flightNumber,
          },
        ]
      : [],
    stops: t.transfers ?? 0,
    duration: t.duration ? `PT${Math.floor(t.duration / 60)}H${t.duration % 60}M` : undefined,
    link: t.link ? `https://www.aviasales.com${t.link}` : undefined,
  };
}

export interface OfferSearchParams {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD, omit for one-way
  currency: string;
  airlines: string[]; // empty = any
}

/**
 * Cheapest cached fare for a specific origin/destination/date via
 * GET /aviasales/v3/prices_for_dates. Prices come from Aviasales' search
 * cache — near-real market prices, ideal for anomaly detection.
 */
export async function searchCheapestOffer(p: OfferSearchParams): Promise<FoundFare | null> {
  const body = await apiGet<TpTicket[]>("/aviasales/v3/prices_for_dates", {
    origin: p.origin,
    destination: p.destination,
    departure_at: p.departDate,
    return_at: p.returnDate ?? "",
    one_way: p.returnDate ? "false" : "true",
    currency: p.currency.toLowerCase(),
    market: config.travelpayouts.market,
    sorting: "price",
    limit: "100",
  });
  let tickets = body.data ?? [];
  if (p.airlines.length > 0) {
    tickets = tickets.filter((t) => t.airline && p.airlines.includes(t.airline));
  }
  if (tickets.length === 0) return null;
  const cheapest = tickets.reduce((a, b) => (a.price <= b.price ? a : b));
  return ticketToFare(cheapest, body.currency ?? p.currency);
}

export interface AnywhereSearchParams {
  origin: string;
  currency: string;
  airlines: string[];
}

/**
 * "Anywhere" search via GET /v1/prices/city-directions: cheapest cached fares
 * to popular destinations from the origin. Dates are whatever the cache holds
 * (the route's date window doesn't apply) — good enough to spot an anomaly.
 */
export async function searchAnywhere(p: AnywhereSearchParams): Promise<FoundFare[]> {
  const body = await apiGet<Record<string, TpDirection>>("/v1/prices/city-directions", {
    origin: p.origin,
    currency: p.currency.toLowerCase(),
    token: config.travelpayouts.token,
  });
  let directions = Object.values(body.data ?? {});
  if (p.airlines.length > 0) {
    directions = directions.filter((d) => d.airline && p.airlines.includes(d.airline));
  }
  return directions.map((d) =>
    ticketToFare(
      {
        origin: d.origin,
        destination: d.destination,
        price: d.price,
        airline: d.airline,
        flight_number: d.flight_number,
        departure_at: d.departure_at,
        return_at: d.return_at,
        transfers: d.transfers,
      },
      body.currency ?? p.currency
    )
  );
}
