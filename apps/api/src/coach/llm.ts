import { coachReview } from "@coinfidant/contracts";
import {
  type CoachPayload,
  type CoachReview,
  coachSystemPrompt,
  type CycleCoachPayload,
  type Tone,
} from "@coinfidant/engine";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { CONFIG, type Config } from "../config";

export type CoachResult = { review: CoachReview; model: string; inputTokens: number; outputTokens: number };

/** The seam between the coach and whichever model writes the words. Tests swap in a fake. */
export interface CoachLlm {
  readonly available: boolean;
  review(tone: Tone, payload: CoachPayload | CycleCoachPayload): Promise<CoachResult>;
}

export const COACH_LLM = Symbol("COACH_LLM");

export class CoachLlmError extends Error {}

const TOOL = "submit_review";
const inputSchema = z.toJSONSchema(coachReview);

const response = z.object({
  model: z.string(),
  content: z.array(z.object({ type: z.string(), name: z.string().optional(), input: z.unknown().optional() })),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
});

@Injectable()
export class AnthropicCoach implements CoachLlm {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  get available() {
    return !!this.config.ANTHROPIC_API_KEY;
  }

  async review(tone: Tone, payload: CoachPayload | CycleCoachPayload): Promise<CoachResult> {
    const key = this.config.ANTHROPIC_API_KEY;
    if (!key) throw new CoachLlmError("coach_unavailable");
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: this.config.COACH_MODEL,
          max_tokens: 1024,
          system: coachSystemPrompt(tone, "kind" in payload ? "cycle" : "week"),
          // Forcing the tool makes the reply structured JSON rather than prose to parse.
          tools: [{ name: TOOL, description: "Submit the review.", input_schema: inputSchema }],
          tool_choice: { type: "tool", name: TOOL },
          messages: [{ role: "user", content: JSON.stringify(payload) }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new CoachLlmError("coach_unreachable");
    }
    if (!res.ok) throw new CoachLlmError(`coach_http_${res.status}`);

    const body = response.safeParse(await res.json());
    const call = body.success ? body.data.content.find((c) => c.type === "tool_use" && c.name === TOOL) : undefined;
    const review = coachReview.safeParse(call?.input);
    if (!body.success || !review.success) throw new CoachLlmError("coach_bad_output");
    return {
      review: review.data,
      model: body.data.model,
      inputTokens: body.data.usage.input_tokens,
      outputTokens: body.data.usage.output_tokens,
    };
  }
}
