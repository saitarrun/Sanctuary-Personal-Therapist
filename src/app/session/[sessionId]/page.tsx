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
    <>
      <header className="app-header">
        <strong>Personal Psychologist</strong>
        <span>Solution-focused coaching · voice</span>
      </header>

      <main>
        <VoiceSession sessionId={session.id} />
      </main>

      <p className="disclaimer">
        This is an AI coaching companion, not a licensed therapist or a crisis
        service. If you’re in danger or crisis, contact local emergency services
        or a crisis line.
      </p>
    </>
  );
}
