import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import {
  withErrorHandler,
  handleAPIError,
} from "@/lib/middleware/errorMiddleware";
import { ValidationError, APIError } from "@/lib/errors/errorHandler";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(5000),
});

/**
 * Server-side proxy to ElevenLabs text-to-speech. Keeps the API key off the
 * client and streams back MP3 audio. Returns 501 when no key is configured so
 * the client can fall back to the browser's built-in speech synthesis.
 */
export const POST = withErrorHandler(
  async (req: NextRequest, requestId: string) => {
    const cfg = getConfig();
    if (!cfg.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "Text-to-speech service is not available. Using browser speech instead." },
        { status: 501 }
      );
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(
        "Invalid request. Please provide valid text (1-5000 characters).",
        { issues: parsed.error.issues },
        requestId
      );
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${cfg.ELEVENLABS_VOICE_ID}`;
    let res;
    try {
      res = await fetch(url, {
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
    } catch (fetchError) {
      throw new APIError(
        "Text-to-speech service is temporarily unavailable. Using browser speech instead.",
        502,
        { originalError: String(fetchError) },
        requestId
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[tts] ElevenLabs error:", res.status, detail.slice(0, 500));

      if (res.status === 401 || res.status === 403) {
        throw new APIError(
          "Text-to-speech authentication failed. Using browser speech instead.",
          502,
          { elevenLabsStatus: res.status },
          requestId
        );
      } else if (res.status === 429) {
        throw new APIError(
          "Text-to-speech rate limit reached. Please try again in a moment.",
          429,
          { elevenLabsStatus: res.status },
          requestId
        );
      } else {
        throw new APIError(
          "Text-to-speech service failed. Using browser speech instead.",
          502,
          { elevenLabsStatus: res.status, detail: detail.slice(0, 200) },
          requestId
        );
      }
    }

    if (!res.body) {
      throw new APIError(
        "Text-to-speech returned no audio data. Using browser speech instead.",
        502,
        {},
        requestId
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
);

