import { assertAmadeusConfigured, config } from "../config";
import { politeFetch } from "../rateLimit";
import type {
  AmadeusTokenResponse,
  FlightDestinationsResponse,
  FlightOffer,
  FlightOffersResponse,
  FoundFare,
} from "./types";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  assertAmadeusConfigured();
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const res = await politeFetch(`${config.amadeus.baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.amadeus.clientId,
      client_secret: config.amadeus.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Amadeus auth failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as AmadeusTokenResponse;
  cachedToken = {
    value: body.access_token,
    // Refresh a minute before the token actually expires.
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  };
  return body.access_token;
}

async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await getToken();
  const url = new URL(`${config.amadeus.baseUrl}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== "") url.searchParams.set(k, v);
  }
  const res = await politeFetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    errors?: { title?: string; detail?: string }[];
  };
  if (!res.ok) {
    const detail = body.errors?.map((e) => e.detail ?? e.title).join("; ");
    throw new Error(`Amadeus ${path} failed (${res.status}): ${detail ?? "unknown error"}`);
  }
  return body;
}

function offerToFare(offer: FlightOffer, origin: string, destination: string): FoundFare {
  const segments = offer.itineraries.flatMap((it) =>
    it.segments.map((s) => ({
      from: s.departure.iataCode,
      to: s.arrival.iataCode,
      departAt: s.departure.at,
      arriveAt: s.arrival.at,
      carrier: s.carrierCode,
      flightNumber: `${s.carrierCode}${s.number}`,
    }))
  );
  const outbound = offer.itineraries[0];
  const inbound = offer.itineraries[1];
  return {
    price: Number(offer.price.grandTotal),
    currency: offer.price.currency,
    origin,
    destination,
    departDate: outbound?.segments[0]?.departure.at.slice(0, 10) ?? "",
    returnDate: inbound?.segments[0]?.departure.at.slice(0, 10),
    airline: outbound?.segments[0]?.carrierCode ?? offer.validatingAirlineCodes?.[0],
    segments,
    stops: Math.max(0, (outbound?.segments.length ?? 1) - 1),
    duration: outbound?.duration,
  };
}

export interface OfferSearchParams {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD, omit for one-way
  cabin: string;
  currency: string;
  airlines: string[]; // empty = any
}

/** Search a specific origin/destination/date and return the cheapest offer found. */
export async function searchCheapestOffer(p: OfferSearchParams): Promise<FoundFare | null> {
  const body = await apiGet<FlightOffersResponse>("/v2/shopping/flight-offers", {
    originLocationCode: p.origin,
    destinationLocationCode: p.destination,
    departureDate: p.departDate,
    returnDate: p.returnDate ?? "",
    adults: "1",
    travelClass: p.cabin,
    currencyCode: p.currency,
    includedAirlineCodes: p.airlines.join(","),
    max: "20",
  });
  const offers = body.data ?? [];
  if (offers.length === 0) return null;
  const cheapest = offers.reduce((a, b) =>
    Number(a.price.grandTotal) <= Number(b.price.grandTotal) ? a : b
  );
  return offerToFare(cheapest, p.origin, p.destination);
}

export interface AnywhereSearchParams {
  origin: string;
  departDateFrom: string;
  departDateTo: string;
  oneWay: boolean;
  stayDurationDays: number;
}

/**
 * "Anywhere" search via Flight Inspiration. Prices are cached fares in the
 * currency reported by the API (usually EUR) and are indicative, not bookable
 * offers — good enough for spotting anomalies.
 */
export async function searchAnywhere(p: AnywhereSearchParams): Promise<FoundFare[]> {
  const body = await apiGet<
    FlightDestinationsResponse & { meta?: { currency?: string } }
  >("/v1/shopping/flight-destinations", {
    origin: p.origin,
    departureDate: `${p.departDateFrom},${p.departDateTo}`,
    oneWay: String(p.oneWay),
    duration: p.oneWay ? "" : String(p.stayDurationDays),
  });
  const currency = body.meta?.currency ?? "EUR";
  return (body.data ?? []).map((d) => ({
    price: Number(d.price.total),
    currency,
    origin: d.origin,
    destination: d.destination,
    departDate: d.departureDate,
    returnDate: d.returnDate,
    segments: [],
    stops: 0,
  }));
}
