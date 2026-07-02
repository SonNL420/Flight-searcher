import { NextResponse } from "next/server";
import { updateSettings, type AppSettings } from "@/lib/settings";

const NUMERIC_KEYS = ["cooldownHours", "baselineWindowDays", "minSnapshots", "minDistinctDays"];
const STRING_KEYS = ["alertEmailTo", "alertEmailFrom"];

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const values: Partial<Record<keyof AppSettings, string>> = {};
  for (const key of STRING_KEYS) {
    if (key in body) values[key as keyof AppSettings] = String(body[key]).trim();
  }
  for (const key of NUMERIC_KEYS) {
    if (!(key in body)) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: `${key} must be a positive number` }, { status: 400 });
    }
    values[key as keyof AppSettings] = String(n);
  }

  await updateSettings(values);
  return NextResponse.json({ ok: true });
}
