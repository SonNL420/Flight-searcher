import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRouteInput } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

async function findRoute(params: Params["params"]) {
  const { id } = await params;
  const routeId = Number(id);
  if (!Number.isInteger(routeId)) return null;
  return prisma.route.findUnique({ where: { id: routeId } });
}

export async function PATCH(req: Request, { params }: Params) {
  const route = await findRoute(params);
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  // Toggle-only update (from the routes list) doesn't need the full payload.
  if (Object.keys(body).length === 1 && "enabled" in body) {
    const updated = await prisma.route.update({
      where: { id: route.id },
      data: { enabled: Boolean(body.enabled) },
    });
    return NextResponse.json(updated);
  }

  const parsed = parseRouteInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const updated = await prisma.route.update({ where: { id: route.id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const route = await findRoute(params);
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  await prisma.route.delete({ where: { id: route.id } });
  return NextResponse.json({ ok: true });
}
