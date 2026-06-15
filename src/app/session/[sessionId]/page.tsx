import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { VoiceSession } from "@/components/VoiceSession";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) notFound();

  return (
    <main>
      <VoiceSession sessionId={session.id} />
    </main>
  );
}

