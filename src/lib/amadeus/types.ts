// Minimal typings for the two Amadeus Self-Service endpoints we use.

export interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number; // seconds
}

// --- Flight Offers Search (GET /v2/shopping/flight-offers) -------------------

export interface FlightOffersResponse {
  data?: FlightOffer[];
  errors?: AmadeusError[];
}

export interface FlightOffer {
  id: string;
  itineraries: Itinerary[];
  price: { grandTotal: string; currency: string };
  validatingAirlineCodes?: string[];
}

export interface Itinerary {
  duration: string; // ISO 8601, e.g. "PT14H30M"
  segments: Segment[];
}

export interface Segment {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
}

// --- Flight Inspiration Search (GET /v1/shopping/flight-destinations) --------

export interface FlightDestinationsResponse {
  data?: FlightDestination[];
  errors?: AmadeusError[];
}

export interface FlightDestination {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  price: { total: string };
}

export interface AmadeusError {
  status?: number;
  code?: number;
  title?: string;
  detail?: string;
}

// --- Normalized result used by the rest of the app ---------------------------

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
  /** Marketing carrier of the first outbound segment (or validating airline). */
  airline?: string;
  segments: FareSegment[];
  stops: number;
  duration?: string;
}
