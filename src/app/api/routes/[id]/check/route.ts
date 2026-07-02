import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BudgetExceededError } from "@/lib/rateLimit";
import { checkRoute } from "@/worker/checkRoute";

type Params = { params: Promise<{ id: string }> };

/** Manually trigger a price check from the dashboard (ignores the interval). */
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const route = await prisma.route.findUnique({ where: { id: Number(id) } });
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  try {
    const outcome = await checkRoute(route);
    return NextResponse.json({
      fare: outcome.fare,
      alerted: outcome.alerted,
      rule: outcome.rule,
      note: outcome.note,
    });
  } catch (err) {
    const status = err instanceof BudgetExceededError ? 429 : 502;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status }
    );
  }
}
