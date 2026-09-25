import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicCoach, CoachLlmError } from "../src/coach/llm";
import type { Config } from "../src/config";

const config = { ANTHROPIC_API_KEY: "test-key", COACH_MODEL: "claude-sonnet-5" } as Config;
const payload = { pace: "ahead" } as never;
const review = {
  verdict: { label: "Ahead 🚀", line: "Nice." },
  lever: "Food.",
  target: "Keep Food down.",
  observation: "Steady.",
};

const reply = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe("AnthropicCoach", () => {
  it("forces the review tool and reads its input", async () => {
    const fetch = reply({
      model: "claude-sonnet-5",
      content: [{ type: "tool_use", name: "submit_review", input: review }],
      usage: { input_tokens: 900, output_tokens: 120 },
    });
    const out = await new AnthropicCoach(config).review("gentle", payload);
    expect(out).toEqual({ review, model: "claude-sonnet-5", inputTokens: 900, outputTokens: 120 });

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init!.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    const body = JSON.parse(init!.body as string);
    expect(body.tool_choice).toEqual({ type: "tool", name: "submit_review" });
    expect(body.system).toMatch(/Gentle/);
    expect(JSON.parse(body.messages[0].content)).toEqual({ pace: "ahead" });
  });

  it("rejects replies that don't match the review shape", async () => {
    reply({ model: "m", content: [{ type: "text" }], usage: { input_tokens: 1, output_tokens: 1 } });
    await expect(new AnthropicCoach(config).review("cheeky", payload)).rejects.toBeInstanceOf(CoachLlmError);
  });

  it("surfaces HTTP errors and a missing key as coach errors", async () => {
    reply({ error: {} }, 529);
    await expect(new AnthropicCoach(config).review("cheeky", payload)).rejects.toThrow("coach_http_529");
    const off = new AnthropicCoach({ ...config, ANTHROPIC_API_KEY: undefined });
    expect(off.available).toBe(false);
    await expect(off.review("cheeky", payload)).rejects.toThrow("coach_unavailable");
  });
});
