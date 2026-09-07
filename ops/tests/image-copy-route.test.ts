import { afterEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/image-copy/route";

const body = { text: "Pressure is not proof.", material: "Narrative notes without dialogue.", contentType: "anti_fraud", template: "dialogue", hypothetical: false };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("image copy route", () => {
  test("returns a Chinese 422 without contacting DeepSeek for unsupported real dialogue", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const response = await POST(new Request("http://localhost/api/image-copy", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/没有可引用的英文对话/);
    expect(provider).not.toHaveBeenCalled();
  });
});
