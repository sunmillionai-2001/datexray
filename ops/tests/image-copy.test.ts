import { describe, expect, test, vi } from "vitest";
import { generateImageCopy } from "@/lib/ai/image-copy";
import { parseImageCopy, imageTheme, type ImageRequest } from "@/lib/image/schema";

const pair = (en: string) => ({ en, zh: "忠实中文对照" });
const input: ImageRequest = { text: "Pressure is not proof.", material: "Pressure is not proof.", contentType: "anti_fraud", template: "insight", hypothetical: false };
const copy = { headline: pair("Pressure is not proof."), support: pair("Pause and verify the context."), quote: pair(""), evidence: pair(""), source: pair(""), hook: pair("Review patterns with DateXray."), signal: "payment_pressure", mood: "warning" };

describe("image copy boundaries", () => {
  test("does not manufacture numbers without evidence", () => {
    expect(() => parseImageCopy({ ...copy, headline: pair("90% are scams") }, input)).toThrow();
    expect(() => parseImageCopy({ ...copy, evidence: pair("90% are scams"), source: pair("FBI") }, input)).toThrow();
    expect(parseImageCopy(copy, input).headline.en).toBe(input.text);
  });
  test("keeps complete numeric evidence, units, time and source", () => {
    const evidence = "In 2025, the sample recorded 25 reports per month.";
    const evidencePair = { en: evidence, zh: "2025 年，该样本每月记录 25 起报告。" };
    const request = { ...input, material: `${evidence}\nSource: Internal demo dataset` };
    const result = parseImageCopy({ ...copy, headline: evidencePair, evidence: evidencePair, source: pair("Internal demo dataset") }, request);
    expect(result.evidence.en).toBe(evidence);
    expect(() => parseImageCopy({ ...copy, headline: pair("25 reports per month"), evidence: evidencePair, source: pair("Internal demo dataset") }, request)).toThrow();
    expect(() => parseImageCopy({ ...copy, headline: pair("25 reports per year"), evidence: evidencePair, source: pair("Internal demo dataset") }, request)).toThrow();
    expect(() => parseImageCopy({ ...copy, headline: evidencePair, evidence: pair(evidence), source: pair("Internal demo dataset") }, request)).toThrow();
  });
  test("supports a sourced spelled-out number without allowing it to be rewritten", () => {
    const evidence = "Twenty-five reports were recorded per month.";
    const request = { ...input, material: `${evidence}\nSource: Reviewed dataset` };
    const evidencePair = { en: evidence, zh: "每月记录二十五起报告。" };
    expect(parseImageCopy({ ...copy, headline: evidencePair, evidence: evidencePair, source: pair("Reviewed dataset") }, request).evidence.en).toBe(evidence);
    expect(() => parseImageCopy({ ...copy, headline: pair("Twenty reports per month"), evidence: evidencePair, source: pair("Reviewed dataset") }, request)).toThrow();
  });
  test("does not invent or rewrite real dialogue", () => {
    const request = { ...input, template: "dialogue" as const, material: 'Alex: Please send money now.' };
    expect(parseImageCopy({ ...copy, quote: pair("Please send money now.") }, request).quote.en).toBe("Please send money now.");
    expect(() => parseImageCopy({ ...copy, quote: pair("Send $500 now.") }, request)).toThrow();
  });
  test("requires explicit hypothetical consent when there is no dialogue, before calling AI", async () => {
    const provider = vi.fn();
    await expect(generateImageCopy({ ...input, template: "dialogue" }, { apiKey: "test", fetch: provider })).rejects.toThrow(/对话/);
    expect(provider).not.toHaveBeenCalled();
    expect(parseImageCopy({ ...copy, quote: pair("If you care, pay now.") }, { ...input, template: "dialogue", hypothetical: true }).quote.en).toBeTruthy();
  });
  test("rejects Chinese image text, missing Chinese comparison, personality labels and oversized copy", () => {
    for (const bad of [{ headline: pair("中文标题") }, { headline: { en: "Safe headline", zh: "" } }, { signal: "scammer" }, { headline: pair("Long ".repeat(30)) }]) {
      expect(() => parseImageCopy({ ...copy, ...bad }, input)).toThrow();
    }
  });
  test("uses one provider call including the exact edited text and original material", async () => {
    const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(copy) } }] })));
    await generateImageCopy(input, { apiKey: "test", fetch: provider });
    expect(provider).toHaveBeenCalledOnce();
    const body = JSON.parse(provider.mock.calls[0][1].body);
    expect(body.messages[1].content).toContain(input.material);
    expect(body.messages[1].content).toContain(input.text);
  });
  test("selects brand themes by content and mood", () => {
    expect(imageTheme("anti_fraud", "neutral")).toBe("warning");
    expect(imageTheme("build_in_public", "neutral")).toBe("progress");
    expect(imageTheme("build_in_public", "warning")).toBe("progress");
    expect(imageTheme("opinion", "warning")).toBe("warning");
    expect(imageTheme("interaction", "neutral")).toBe("neutral");
  });
  test("accepts a readable two-line opinion headline produced at eighty-nine characters", () => {
    const headline = "A payment-pressure pattern may be a signal to verify, but it is not proof of fraud alone!";
    expect(Array.from(headline).length).toBe(89);
    expect(parseImageCopy({ ...copy, headline: pair(headline) }, input).headline.en).toBe(headline);
  });
  test("reports an overlong field with a Chinese UI label", () => {
    expect(() => parseImageCopy({ ...copy, headline: pair("Long ".repeat(30)) }, input)).toThrow("标题文案过长");
  });
});
