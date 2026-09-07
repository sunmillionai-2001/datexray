import { describe, expect, test, vi } from "vitest";

import { generateGitInsights, generateXDrafts, translateXText } from "@/lib/ai/generate";

const input = {
  contentType: "anti_fraud" as const,
  material: "Repeatedly avoiding live video while introducing an urgent crypto investment request.",
  context: { goal: "Teach one observable pattern without making a verdict." },
};

function deepSeekResponse(payload: unknown) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

const validDrafts = {
  drafts: [
    {
      angle: "证据优先",
      text: "A crypto pitch is not the only signal. Pair it with repeated video-call avoidance and sudden urgency, and the pattern deserves a slower, independent check—not a snap verdict.",
      zh_summary: "加密货币推销并非唯一信号。若同时反复回避视频通话并突然催促，这种组合值得放慢脚步、独立核验，而不是仓促下结论。",
      whyItWorks: "关联可观察线索，不给人贴标签。",
    },
    {
      angle: "故事切入",
      text: "The message changed from “I miss you” to “invest today.” That shift matters. Pause before irreversible payments, verify the person independently, and keep account access private.",
      zh_summary: "消息从“我想你”变成“今天就投资”，这个变化值得留意。在不可撤销的付款前暂停，独立核验身份，并保护账户访问权限。",
      whyItWorks: "用简短叙事呈现素材中的行为变化。",
    },
    {
      angle: "发起讨论",
      text: "Which would make you pause first: a month of avoided video calls, an urgent crypto pitch, or affection that suddenly becomes financial pressure? Patterns matter more than one line.",
      zh_summary: "连续一个月回避视频、紧急的加密货币推销、或突然变成经济施压的关心，哪种会让你先停下来？行为模式比一句话更重要。",
      whyItWorks: "邀请讨论，同时强调基于行为模式判断。",
    },
  ],
};

describe("X draft generation", () => {
  test("returns three distinct English drafts within 280 code points", async () => {
    const result = await generateXDrafts(input, {
      fetch: async () => deepSeekResponse(validDrafts),
      apiKey: "test-key",
      idFactory: () => "generation-one",
    });

    expect(result.generationId).toBe("generation-one");
    expect(result.drafts).toHaveLength(3);
    expect(new Set(result.drafts.map((draft) => draft.text)).size).toBe(3);
    expect(result.drafts.every((draft) => Array.from(draft.text).length <= 280)).toBe(true);
    expect(result.drafts.every((draft) => !/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(draft.text))).toBe(true);
    expect(result.drafts).toEqual(validDrafts.drafts);
  });

  test("sends the approved brand boundary and selected type to DeepSeek", async () => {
    const requestBodies: unknown[] = [];
    await generateXDrafts(input, {
      fetch: async (_url, init) => {
        requestBodies.push(JSON.parse(String(init?.body)));
        return deepSeekResponse(validDrafts);
      },
      apiKey: "test-key",
    });

    const body = requestBodies[0] as { messages: Array<{ content: string }> };
    expect(body.messages[0].content).toContain("You write English X posts");
    expect(body.messages[0].content).toContain("Write in en-US");
    expect(body.messages[0].content).toContain("zh_summary");
    expect(body.messages[0].content).toContain("negation");
    expect(body.messages[0].content).toContain("certainty");
    expect(requestBodies).toHaveLength(1);
    expect(body.messages[0].content).toContain("Never tell readers whether to leave, stay, date, trust, or reject someone.");
    expect(body.messages[0].content).toContain("Anti-fraud education");
    expect(body.messages[1].content).toContain(input.material);
  });

  test("makes one repair request after malformed output", async () => {
    const provider = vi.fn()
      .mockResolvedValueOnce(deepSeekResponse({ drafts: [{ angle: "Only one" }] }))
      .mockResolvedValueOnce(deepSeekResponse(validDrafts));

    const result = await generateXDrafts(input, { fetch: provider, apiKey: "test-key" });

    expect(result.drafts).toHaveLength(3);
    expect(provider).toHaveBeenCalledTimes(2);
  });

  test("rejects a second invalid response after one repair attempt", async () => {
    const invalid = {
      drafts: [
        { angle: "A", text: "相同内容", whyItWorks: "A" },
        { angle: "B", text: "相同内容", whyItWorks: "B" },
        { angle: "C", text: "相同内容", whyItWorks: "C" },
      ],
    };

    await expect(generateXDrafts(input, {
      fetch: async () => deepSeekResponse(invalid),
      apiKey: "test-key",
    })).rejects.toThrow("DeepSeek returned invalid X drafts after one repair attempt");
  });

  test("fails clearly when the server key is absent", async () => {
    await expect(generateXDrafts(input, { apiKey: "" })).rejects.toThrow("DEEPSEEK_API_KEY is not configured");
  });

  test.each(["zh_summary", "angle", "whyItWorks"])("repairs a missing Chinese %s field", async (field) => {
    const broken = structuredClone(validDrafts) as { drafts: Record<string, string>[] };
    delete broken.drafts[0][field];
    const provider = vi.fn().mockResolvedValueOnce(deepSeekResponse(broken)).mockResolvedValueOnce(deepSeekResponse(validDrafts));
    const result = await generateXDrafts(input, { fetch: provider, apiKey: "test-key" });
    expect(provider).toHaveBeenCalledTimes(2);
    expect(result.drafts).toEqual(validDrafts.drafts);
  });

  test.each(["zh_summary", "angle", "whyItWorks"])("rejects empty or English-only %s", async (field) => {
    for (const value of ["   ", "English only"]) {
      const broken = structuredClone(validDrafts) as { drafts: Record<string, string>[] };
      broken.drafts[0][field] = value;
      await expect(generateXDrafts(input, { fetch: async () => deepSeekResponse(broken), apiKey: "test-key" }))
        .rejects.toThrow("DeepSeek returned invalid X drafts");
    }
  });

  test("still rejects Chinese text when all Chinese review fields are valid", async () => {
    const broken = structuredClone(validDrafts);
    broken.drafts[0].text = "This is 可能 a signal.";
    await expect(generateXDrafts(input, { fetch: async () => deepSeekResponse(broken), apiKey: "test-key" }))
      .rejects.toThrow("DeepSeek returned invalid X drafts");
  });
});

describe("Chinese comparison refresh", () => {
  test("translates the exact edited text with numbers, negation and conditional wording", async () => {
    const text = "If someone asks for $500 within 24 hours, it may signal pressure—not proof of fraud.";
    const zh_summary = "如果有人要求在 24 小时内支付 500 美元，这可能是施压信号，并非诈骗的证据。";
    const provider = vi.fn().mockResolvedValue(deepSeekResponse({ zh_summary }));
    const result = await translateXText(text, { fetch: provider, apiKey: "test-key" });
    expect(result).toEqual({ text, zh_summary });
    expect(provider).toHaveBeenCalledOnce();
    const request = JSON.parse(String(provider.mock.calls[0][1].body));
    expect(request.messages[1].content).toContain(text);
    expect(request.messages[0].content).toContain("negation");
    expect(request.messages[0].content).toContain("certainty");
    expect(request.messages[0].content).toContain("untrusted");
  });

  test.each(["", "中文正文", "x".repeat(281)])("rejects invalid refresh text before requesting the provider", async (text) => {
    const provider = vi.fn();
    await expect(translateXText(text, { fetch: provider, apiKey: "test-key" })).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled();
  });

  test("repairs a missing translation, then fails clearly if still invalid", async () => {
    const provider = vi.fn().mockImplementation(async () => deepSeekResponse({ zh_summary: "" }));
    await expect(translateXText("A pattern is not proof.", { fetch: provider, apiKey: "test-key" }))
      .rejects.toThrow("DeepSeek returned invalid Chinese translation after one repair attempt.");
    expect(provider).toHaveBeenCalledTimes(2);
  });

  test("keeps the original English available during translation repair", async () => {
    const text = "If a request is urgent, it may indicate pressure. It does not prove fraud.";
    const provider = vi.fn().mockResolvedValueOnce(deepSeekResponse({})).mockResolvedValueOnce(deepSeekResponse({ zh_summary: "如果请求很紧急，这可能意味着施压，并不证明诈骗。" }));
    await translateXText(text, { fetch: provider, apiKey: "test-key" });
    const repairBody = JSON.parse(String(provider.mock.calls[1][1].body));
    expect(repairBody.messages[1].content).toContain(text);
  });
});

describe("Git insight generation", () => {
  test("keeps every cited hash inside the supplied commit set", async () => {
    const commits = [{
      hash: "ae3e92d",
      date: "2026-09-04T08:00:00+08:00",
      subject: "docs: switch audio transcription plan",
      files: ["product-spec.md"],
    }];
    const providerPayload = {
      insights: [{
        title: "A smaller integration decision",
        whatChanged: "The audio transcription plan moved to Alibaba Cloud Paraformer.",
        whyItMatters: "It aligns the planned provider with the available account setup.",
        lesson: "Infrastructure choices should reflect the accounts a small team can actually operate.",
        commitHashes: ["ae3e92d"],
      }],
    };

    const result = await generateGitInsights(commits, {
      fetch: async () => deepSeekResponse(providerPayload),
      apiKey: "test-key",
    });

    expect(result.insights[0].commitHashes).toEqual(["ae3e92d"]);
  });

  test("rejects an insight that cites a commit not supplied to the model", async () => {
    const commits = [{ hash: "known", date: "2026-09-04", subject: "Known", files: ["README.md"] }];
    const invalid = {
      insights: [{
        title: "Invented",
        whatChanged: "Something unsupported changed.",
        whyItMatters: "Unsupported impact.",
        lesson: "Unsupported lesson.",
        commitHashes: ["unknown"],
      }],
    };

    await expect(generateGitInsights(commits, {
      fetch: async () => deepSeekResponse(invalid),
      apiKey: "test-key",
    })).rejects.toThrow("DeepSeek returned invalid Git insights after one repair attempt");
  });
});
