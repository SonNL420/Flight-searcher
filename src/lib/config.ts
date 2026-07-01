function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid numeric value for ${name}: "${raw}"`);
  }
  return n;
}

export const config = {
  amadeus: {
    clientId: process.env.AMADEUS_CLIENT_ID ?? "",
    clientSecret: process.env.AMADEUS_CLIENT_SECRET ?? "",
    baseUrl:
      process.env.AMADEUS_ENV === "production"
        ? "https://api.amadeus.com"
        : "https://test.api.amadeus.com",
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.ALERT_EMAIL_FROM ?? "",
    to: process.env.ALERT_EMAIL_TO ?? "",
  },
  politeness: {
    requestDelayMs: num("REQUEST_DELAY_MS", 600),
    dailyRequestBudget: num("DAILY_REQUEST_BUDGET", 500),
    userAgent: process.env.USER_AGENT || "flight-searcher/0.1 (personal price monitor)",
  },
};

export function assertAmadeusConfigured(): void {
  if (!config.amadeus.clientId || !config.amadeus.clientSecret) {
    throw new Error(
      "AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET must be set (see .env.example)"
    );
  }
}
