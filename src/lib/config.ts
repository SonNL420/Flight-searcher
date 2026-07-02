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
  travelpayouts: {
    token: process.env.TRAVELPAYOUTS_TOKEN ?? "",
    // Data-source market for cached prices, e.g. "us", "de", "ru"
    market: process.env.TRAVELPAYOUTS_MARKET ?? "us",
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

export function assertProviderConfigured(): void {
  if (!config.travelpayouts.token) {
    throw new Error("TRAVELPAYOUTS_TOKEN must be set (see .env.example)");
  }
}
