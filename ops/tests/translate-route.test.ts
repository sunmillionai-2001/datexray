import { afterEach, describe, expect, test, vi } from "vitest";

import { POST } from "@/app/api/translate/route";

function request(body: unknown) {
  return new Request("http://localhost/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Chinese comparison API", () => {
  test.each([{}, { text: 123 }, { text: "" }, { text: "中文正文" }, { text: "x".repeat(281) }])("rejects invalid input with a Chinese error before provider work", async (body) => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/[\u3400-\u9fff]/u);
    expect(provider).not.toHaveBeenCalled();
  });

  test("reports the missing key in Chinese", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const response = await POST(request({ text: "A pattern is not proof." }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "尚未配置 DEEPSEEK_API_KEY。" });
  });

  test("returns the exact source English and Chinese translation, without model fields", async () => {
    const text = "If a request arrives within 24 hours, it may be pressure—not proof.";
    const zh_summary = "如果请求在 24 小时内到来，这可能是施压，并非证据。";
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ zh_summary }) } }] })));
    vi.stubGlobal("fetch", provider);
    const response = await POST(request({ text }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { text, zh_summary } });
    expect(provider).toHaveBeenCalledOnce();
  });

  test("returns a Chinese provider error without leaking provider output", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private provider details", { status: 429 })));
    const response = await POST(request({ text: "A pattern is not proof." }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "DeepSeek 请求失败，状态码：429." });
  });
});
