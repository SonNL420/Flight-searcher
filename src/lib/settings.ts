import { prisma } from "./db";
import { config } from "./config";

export interface AppSettings {
  /** Alert recipient; falls back to ALERT_EMAIL_TO env var. */
  alertEmailTo: string;
  /** Sender address; falls back to ALERT_EMAIL_FROM env var. */
  alertEmailFrom: string;
  /** Hours to wait before re-alerting the same route (unless price drops further). */
  cooldownHours: number;
  /** Days of history used to compute the baseline price. */
  baselineWindowDays: number;
  /** Minimum snapshots before the percent rule can fire. */
  minSnapshots: number;
  /** Minimum distinct days of history before the percent rule can fire. */
  minDistinctDays: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  alertEmailTo: "",
  alertEmailFrom: "",
  cooldownHours: 6,
  baselineWindowDays: 30,
  minSnapshots: 10,
  minDistinctDays: 3,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const numOr = (key: keyof AppSettings) => {
    const n = Number(map[key]);
    return Number.isFinite(n) && n > 0 ? n : (DEFAULT_SETTINGS[key] as number);
  };
  return {
    alertEmailTo: map.alertEmailTo || config.email.to,
    alertEmailFrom: map.alertEmailFrom || config.email.from,
    cooldownHours: numOr("cooldownHours"),
    baselineWindowDays: numOr("baselineWindowDays"),
    minSnapshots: numOr("minSnapshots"),
    minDistinctDays: numOr("minDistinctDays"),
  };
}

export async function updateSettings(values: Partial<Record<keyof AppSettings, string>>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
