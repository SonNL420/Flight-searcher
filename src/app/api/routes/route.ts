import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRouteInput } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = parseRouteInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const route = await prisma.route.create({ data: parsed.data });
  return NextResponse.json(route, { status: 201 });
}
