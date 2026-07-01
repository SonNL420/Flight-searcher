import "dotenv/config";
import { ensureDbReady, prisma } from "@/lib/db";
import { checkRoute } from "@/worker/checkRoute";

/**
 * Manually trigger a price check, ignoring intervals. Useful for testing.
 *
 *   npm run check-now          # check all enabled routes
 *   npm run check-now -- 3     # check route id 3 (even if disabled)
 */
async function main(): Promise<void> {
  await ensureDbReady();
  const idArg = process.argv[2];
  const routes = idArg
    ? await prisma.route.findMany({ where: { id: Number(idArg) } })
    : await prisma.route.findMany({ where: { enabled: true } });

  if (routes.length === 0) {
    console.log(
      idArg ? `No route with id ${idArg}.` : "No enabled routes. Add one via the dashboard."
    );
    return;
  }

  for (const route of routes) {
    console.log(`Checking ${route.origin} → ${route.destination ?? "anywhere"} ...`);
    const res = await checkRoute(route);
    if (!res.fare) {
      console.log(`  no fare found${res.note ? ` (${res.note})` : ""}`);
      continue;
    }
    console.log(
      `  cheapest: ${res.fare.price} ${res.fare.currency} — ` +
        `${res.fare.origin}→${res.fare.destination} depart ${res.fare.departDate}` +
        `${res.fare.returnDate ? ` return ${res.fare.returnDate}` : ""}` +
        `${res.fare.airline ? ` on ${res.fare.airline}` : ""}`
    );
    console.log(
      res.alerted
        ? `  🚨 GLITCH DETECTED [${res.rule}] — ${res.note}`
        : `  no glitch${res.note ? ` (${res.note})` : ""}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
