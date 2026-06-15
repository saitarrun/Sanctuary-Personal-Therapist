import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(5000),
});

/**
 * Server-side proxy to ElevenLabs text-to-speech. Keeps the API key off the
 * client and streams back MP3 audio. Returns 501 when no key is configured so
 * the client can fall back to the browser's built-in speech synthesis.
 */
export async function POST(req: NextRequest) {
  const cfg = getConfig();
  if (!cfg.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ElevenLabs not configured" },
      { status: 501 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${cfg.ELEVENLABS_VOICE_ID}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": cfg.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: parsed.data.text,
      model_id: cfg.ELEVENLABS_MODEL,
      // A calm, steady delivery suited to a coaching tone.
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error("[tts] ElevenLabs error:", res.status, detail.slice(0, 500));
    return NextResponse.json(
      { error: "Text-to-speech failed" },
      { status: 502 }
    );
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
