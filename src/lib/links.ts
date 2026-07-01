/**
 * Amadeus does not return consumer booking URLs, so we deep-link into Google
 * Flights with a natural-language query it resolves reliably.
 */
export function googleFlightsLink(opts: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
}): string {
  const q = opts.returnDate
    ? `flights from ${opts.origin} to ${opts.destination} on ${opts.departDate} through ${opts.returnDate}`
    : `one way flights from ${opts.origin} to ${opts.destination} on ${opts.departDate}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}
