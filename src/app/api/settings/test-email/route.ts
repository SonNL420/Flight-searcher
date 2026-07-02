import { NextResponse } from "next/server";
import { sendAlertEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";

/** Send a fake alert so the user can verify their email configuration. */
export async function POST() {
  const settings = await getSettings();
  const result = await sendAlertEmail(
    {
      fare: {
        price: 289,
        currency: "USD",
        origin: "JFK",
        destination: "HND",
        departDate: "2026-09-10",
        returnDate: "2026-09-17",
        airline: "NH",
        segments: [
          {
            from: "JFK",
            to: "HND",
            departAt: "2026-09-10T11:00:00",
            arriveAt: "2026-09-11T14:05:00",
            carrier: "NH",
            flightNumber: "NH105 (test)",
          },
        ],
        stops: 0,
      },
      rule: "PERCENT",
      baseline: { avg: 1050, min: 890, max: 1230, snapshotCount: 42, distinctDays: 14 },
      bookingLink: "https://www.google.com/travel/flights",
      detectedAt: new Date(),
    },
    settings
  );

  if (result.status !== "SENT") {
    return NextResponse.json(
      { error: result.error ?? "Email not sent" },
      { status: result.status === "SKIPPED" ? 400 : 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
