// Provider-agnostic fare shapes used by the rest of the app, plus minimal
// typings for the Travelpayouts/Aviasales Data API responses.

export interface FareSegment {
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  carrier: string;
  flightNumber: string;
}

export interface FoundFare {
  price: number;
  currency: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  /** Marketing carrier IATA code. */
  airline?: string;
  segments: FareSegment[];
  stops: number;
  duration?: string;
  /** Provider booking link, if the API returned one. */
  link?: string;
}

// --- Travelpayouts responses --------------------------------------------------

export interface TpEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string | null;
  currency?: string;
}

/** GET /aviasales/v3/prices_for_dates — one item per found ticket. */
export interface TpTicket {
  origin: string;
  destination: string;
  origin_airport?: string;
  destination_airport?: string;
  price: number;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string; // ISO datetime
  return_at?: string; // ISO datetime
  transfers?: number;
  return_transfers?: number;
  duration?: number; // minutes, whole trip
  link?: string; // relative aviasales search link
}

/** GET /v1/prices/city-directions — keyed by destination IATA code. */
export interface TpDirection {
  origin: string;
  destination: string;
  price: number;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string;
  return_at?: string;
  transfers?: number;
  expires_at?: string;
}
