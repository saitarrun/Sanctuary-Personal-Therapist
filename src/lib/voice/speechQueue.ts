export interface SpeechQueueController {
  enqueue(sentence: string): void;
  processQueue(): void;
  markStreamFinished(): void;
  pendingCount(): number;
  isSpeaking(): boolean;
}

interface SpeechQueueOptions {
  onSpeaking: () => void;
  speak: (sentence: string, onDone: () => void) => void;
  onQueueDrainedAfterStream: () => void;
}

/**
 * Coordinates streamed sentence playback with the listening loop.
 *
 * The final sentence often finishes after the chat stream has already ended.
 * When that last onDone callback drains the queue, we must explicitly return to
 * listening; otherwise the UI can remain stuck in the previous turn.
 */
export function createSpeechQueueController({
  onSpeaking,
  speak,
  onQueueDrainedAfterStream,
}: SpeechQueueOptions): SpeechQueueController {
  const queue: string[] = [];
  let streamFinished = false;
  let speaking = false;
  let resumed = false;

  const resumeIfComplete = () => {
    if (!streamFinished || speaking || queue.length > 0 || resumed) return;
    resumed = true;
    onQueueDrainedAfterStream();
  };

  const processQueue = () => {
    // processQueue is also used as the speech completion callback, so reaching
    // this point means the previously active utterance has finished.
    speaking = false;

    const next = queue.shift();
    if (!next) {
      resumeIfComplete();
      return;
    }

    speaking = true;
    onSpeaking();
    speak(next, processQueue);
  };

  return {
    enqueue(sentence: string) {
      queue.push(sentence);
    },
    processQueue,
    markStreamFinished() {
      streamFinished = true;
      resumeIfComplete();
    },
    pendingCount() {
      return queue.length;
    },
    isSpeaking() {
      return speaking;
    },
  };
}
