import "dotenv/config";
import { ensureDbReady, prisma } from "@/lib/db";
import { BudgetExceededError, remainingDailyBudget } from "@/lib/rateLimit";
import { checkRoute, routeLabel } from "./checkRoute";

const TICK_MS = 60_000;

let ticking = false;

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function tick(): Promise<void> {
  if (ticking) return; // never overlap ticks
  ticking = true;
  try {
    const routes = await prisma.route.findMany({ where: { enabled: true } });
    const now = Date.now();
    const due = routes.filter(
      (r) =>
        !r.lastCheckedAt ||
        r.lastCheckedAt.getTime() + r.intervalMinutes * 60_000 <= now
    );
    if (due.length === 0) return;
    log(`${due.length} route(s) due (daily budget left: ${remainingDailyBudget()})`);

    for (const route of due) {
      try {
        const res = await checkRoute(route);
        const price = res.fare
          ? `${res.fare.price} ${res.fare.currency} (${res.fare.origin}→${res.fare.destination})`
          : "no fare";
        log(
          `${res.label}: ${price}${res.alerted ? ` — ALERT [${res.rule}]` : ""}${res.note ? ` — ${res.note}` : ""}`
        );
      } catch (err) {
        if (err instanceof BudgetExceededError) {
          log(`daily request budget exhausted, pausing checks until tomorrow`);
          return;
        }
        log(`${routeLabel(route)}: check failed — ${err instanceof Error ? err.message : err}`);
      }
    }
  } catch (err) {
    log(`tick failed: ${err instanceof Error ? err.message : err}`);
  } finally {
    ticking = false;
  }
}

async function main(): Promise<void> {
  await ensureDbReady();
  log("worker started — checking for due routes every 60s");
  await tick();
  const interval = setInterval(tick, TICK_MS);

  const shutdown = async (signal: string) => {
    log(`received ${signal}, shutting down`);
    clearInterval(interval);
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("worker crashed:", err);
  process.exit(1);
});
