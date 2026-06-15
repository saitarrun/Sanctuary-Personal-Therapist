import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/sessions — list sessions, newest first (for the sidebar).
export async function GET() {
  const sessions = await prisma.session.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
  return NextResponse.json({ sessions });
}

// POST /api/sessions — create a new session.
export async function POST() {
  const session = await prisma.session.create({ data: {} });
  return NextResponse.json({ id: session.id }, { status: 201 });
}
