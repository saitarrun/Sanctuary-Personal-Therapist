import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Landing: continue the most recent session, or start a fresh one. Keeps a
 * single active conversation rather than spawning a new session per visit.
 */
export default async function Home() {
  const latest = await prisma.session.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  const session = latest ?? (await prisma.session.create({ data: {} }));
  redirect(`/session/${session.id}`);
}
