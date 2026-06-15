import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getConfig } from "@/lib/config";
import type { ChatMessage, ChatProvider, ChatRequest, ChatResult } from "./types";

const execFileAsync = promisify(execFile);

/**
 * Local-dev provider. Shells out to the Claude Code CLI in non-interactive print
 * mode. NOT usable on serverless/Vercel (no `claude` binary, no auth, sandboxed FS).
 *
 * `claude -p` is single-shot, so prior turns are rendered into the prompt as a
 * transcript; the coaching instructions ride on --append-system-prompt.
 */
export class ClaudeCliProvider implements ChatProvider {
  readonly name = "claude-cli" as const;

  async chat(req: ChatRequest): Promise<ChatResult> {
    const cfg = getConfig();
    const transcript = renderTranscript(req.messages);

    // Args passed as an array (never a shell string) so user text can't inject
    // shell commands.
    const args = [
      "-p",
      transcript,
      "--append-system-prompt",
      req.system,
      "--model",
      cfg.CLAUDE_CLI_MODEL,
    ];

    let stdout: string;
    try {
      const result = await execFileAsync("claude", args, {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = result.stdout;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Claude CLI invocation failed: ${message}`);
    }

    const content = stdout.trim();
    if (!content) {
      throw new Error("Claude CLI returned empty output.");
    }

    return { content, model: cfg.CLAUDE_CLI_MODEL, provider: this.name };
  }
}

function renderTranscript(messages: ChatMessage[]): string {
  const lines = messages.map((m) => {
    const speaker = m.role === "assistant" ? "Coach" : "Person";
    return `${speaker}: ${m.content}`;
  });
  // Cue the model to continue as the coach for the final turn.
  lines.push("Coach:");
  return lines.join("\n");
}
