import { Resend } from "resend";
import { config } from "./config";
import type { Baseline, GlitchRule } from "./detection";
import type { FoundFare } from "./flights/types";
import type { AppSettings } from "./settings";

export interface AlertEmail {
  fare: FoundFare;
  rule: GlitchRule;
  baseline: Baseline | null;
  bookingLink: string;
  detectedAt: Date;
}

export interface SendResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function segmentsTable(fare: FoundFare): string {
  if (fare.segments.length === 0) return "";
  const rows = fare.segments
    .map(
      (s) => `<tr>
        <td style="padding:4px 12px 4px 0;">${s.flightNumber}</td>
        <td style="padding:4px 12px 4px 0;">${s.from} → ${s.to}</td>
        <td style="padding:4px 0;">${s.departAt.replace("T", " ").slice(0, 16)}</td>
      </tr>`
    )
    .join("");
  return `<h3 style="margin:24px 0 8px;">Flight details</h3>
    <table style="border-collapse:collapse;font-size:14px;color:#333;">${rows}</table>`;
}

export function buildAlertHtml(a: AlertEmail): string {
  const { fare, baseline } = a;
  const trip = fare.returnDate ? "round-trip" : "one-way";
  const pctBelow =
    baseline && baseline.avg > 0
      ? Math.round((1 - fare.price / baseline.avg) * 100)
      : null;
  const normalRange = baseline
    ? `${money(baseline.min, fare.currency)} – ${money(baseline.max, fare.currency)} (avg ${money(baseline.avg, fare.currency)})`
    : "not enough history yet";
  const reason =
    a.rule === "ABSOLUTE"
      ? "below your absolute price threshold"
      : `${pctBelow}% below the typical price for this route`;

  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f5;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <p style="margin:0;color:#c2410c;font-weight:600;font-size:13px;letter-spacing:.05em;">POSSIBLE ERROR FARE</p>
    <h1 style="margin:8px 0 4px;font-size:22px;">${fare.origin} → ${fare.destination} <span style="font-weight:400;color:#666;">(${trip})</span></h1>
    <p style="font-size:36px;font-weight:700;margin:16px 0 4px;color:#16a34a;">${money(fare.price, fare.currency)}</p>
    <p style="margin:0;color:#555;">This is ${reason}.</p>
    <table style="margin:20px 0;font-size:14px;color:#333;border-collapse:collapse;">
      <tr><td style="padding:4px 16px 4px 0;color:#888;">Normal range</td><td>${normalRange}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#888;">Depart</td><td>${fare.departDate}</td></tr>
      ${fare.returnDate ? `<tr><td style="padding:4px 16px 4px 0;color:#888;">Return</td><td>${fare.returnDate}</td></tr>` : ""}
      ${fare.airline ? `<tr><td style="padding:4px 16px 4px 0;color:#888;">Airline</td><td>${fare.airline}</td></tr>` : ""}
      ${fare.segments.length ? `<tr><td style="padding:4px 16px 4px 0;color:#888;">Stops</td><td>${fare.stops === 0 ? "non-stop" : fare.stops}</td></tr>` : ""}
      <tr><td style="padding:4px 16px 4px 0;color:#888;">Detected</td><td>${a.detectedAt.toUTCString()}</td></tr>
    </table>
    <a href="${a.bookingLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Check &amp; book on Google Flights</a>
    ${segmentsTable(fare)}
    <p style="margin-top:28px;font-size:12px;color:#999;">Error fares vanish fast — verify the price before booking. Sent by your flight-searcher monitor.</p>
  </div>
</body></html>`;
}

export async function sendAlertEmail(a: AlertEmail, settings: AppSettings): Promise<SendResult> {
  const to = settings.alertEmailTo;
  const from = settings.alertEmailFrom;
  if (!config.email.resendApiKey || !to || !from) {
    return {
      status: "SKIPPED",
      error: "Email not configured (RESEND_API_KEY / from / to missing)",
    };
  }
  try {
    const resend = new Resend(config.email.resendApiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `✈️ ${money(a.fare.price, a.fare.currency)} ${a.fare.origin} → ${a.fare.destination} — possible error fare`,
      html: buildAlertHtml(a),
    });
    if (error) return { status: "FAILED", error: error.message };
    return { status: "SENT" };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}
