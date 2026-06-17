import { describe, expect, it } from "vitest";
import { createSpeechQueueController } from "@/lib/voice/speechQueue";

describe("createSpeechQueueController", () => {
  it("resumes after the final spoken sentence drains once the stream is finished", () => {
    const spoken: Array<{ sentence: string; done: () => void }> = [];
    let resumed = 0;

    const queue = createSpeechQueueController({
      onSpeaking: () => {},
      speak: (sentence, done) => spoken.push({ sentence, done }),
      onQueueDrainedAfterStream: () => {
        resumed++;
      },
    });

    queue.enqueue("One sentence.");
    queue.processQueue();

    expect(spoken.map((s) => s.sentence)).toEqual(["One sentence."]);
    expect(queue.isSpeaking()).toBe(true);
    expect(resumed).toBe(0);

    queue.markStreamFinished();
    expect(resumed).toBe(0);

    spoken[0].done();
    expect(queue.isSpeaking()).toBe(false);
    expect(resumed).toBe(1);
  });

  it("waits for stream completion if the queue drains before the stream ends", () => {
    const spoken: Array<{ done: () => void }> = [];
    let resumed = 0;

    const queue = createSpeechQueueController({
      onSpeaking: () => {},
      speak: (_sentence, done) => spoken.push({ done }),
      onQueueDrainedAfterStream: () => {
        resumed++;
      },
    });

    queue.enqueue("Quick reply.");
    queue.processQueue();
    spoken[0].done();

    expect(resumed).toBe(0);

    queue.markStreamFinished();
    expect(resumed).toBe(1);
  });

  it("speaks queued sentences in order and resumes only once", () => {
    const spoken: Array<{ sentence: string; done: () => void }> = [];
    let speakingTransitions = 0;
    let resumed = 0;

    const queue = createSpeechQueueController({
      onSpeaking: () => {
        speakingTransitions++;
      },
      speak: (sentence, done) => spoken.push({ sentence, done }),
      onQueueDrainedAfterStream: () => {
        resumed++;
      },
    });

    queue.enqueue("First.");
    queue.enqueue("Second.");
    queue.processQueue();
    queue.markStreamFinished();

    expect(spoken.map((s) => s.sentence)).toEqual(["First."]);
    expect(speakingTransitions).toBe(1);

    spoken[0].done();
    expect(spoken.map((s) => s.sentence)).toEqual(["First.", "Second."]);
    expect(speakingTransitions).toBe(2);
    expect(resumed).toBe(0);

    spoken[1].done();
    queue.processQueue();
    queue.markStreamFinished();

    expect(resumed).toBe(1);
  });
});
