import "dotenv/config";
import { prisma } from "@/lib/db";

/**
 * Seed a demo route with ~30 days of synthetic price history so you can see
 * the dashboard (chart, baseline, alerts) working before real data accrues.
 *
 *   npm run seed-demo
 *
 * Safe to re-run; it recreates the demo route each time. Delete it from the
 * dashboard when you're done.
 */
async function main(): Promise<void> {
  const old = await prisma.route.findFirst({
    where: { origin: "JFK", destination: "HND" },
  });
  if (old) await prisma.route.delete({ where: { id: old.id } });

  const today = new Date();
  const departFrom = new Date(today.getTime() + 60 * 86_400_000).toISOString().slice(0, 10);
  const departTo = new Date(today.getTime() + 75 * 86_400_000).toISOString().slice(0, 10);

  const route = await prisma.route.create({
    data: {
      origin: "JFK",
      destination: "HND",
      tripType: "ROUND_TRIP",
      departDateFrom: departFrom,
      departDateTo: departTo,
      stayDurationDays: 10,
      maxPrice: 400,
      dropPercent: 40,
      intervalMinutes: 60,
    },
  });

  // ~30 days of typical prices ($900–$1250), 2 checks/day
  const snapshots = [];
  for (let day = 30; day >= 1; day--) {
    for (const hour of [9, 21]) {
      const at = new Date(today.getTime() - day * 86_400_000);
      at.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
      snapshots.push({
        routeId: route.id,
        price: Math.round(900 + Math.random() * 350),
        currency: "USD",
        airline: ["NH", "JL", "UA"][Math.floor(Math.random() * 3)],
        destination: "HND",
        departDate: departFrom,
        returnDate: new Date(new Date(departFrom).getTime() + 10 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        capturedAt: at,
      });
    }
  }
  await prisma.priceSnapshot.createMany({ data: snapshots });

  console.log(`Seeded demo route #${route.id} (JFK → HND) with ${snapshots.length} snapshots.`);
  console.log(`Run "npm run check-now -- ${route.id}" to do a real Amadeus check against it,`);
  console.log("or open the dashboard to see the chart and baseline.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
