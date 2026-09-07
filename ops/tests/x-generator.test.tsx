import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { XGenerator, type XGeneratorApi } from "@/components/x-generator";
import type { BootstrapData, GenerationResult } from "@/lib/types";

const generation: GenerationResult = {
  generationId: "generation-one",
  drafts: [
    { angle: "证据优先", text: "Draft one", zh_summary: "第一版中文对照", whyItWorks: "呈现清晰证据。" },
    { angle: "故事切入", text: "Draft two", zh_summary: "第二版中文对照", whyItWorks: "用简短故事表达。" },
    { angle: "发起讨论", text: "Draft three", zh_summary: "第三版中文对照", whyItWorks: "邀请读者回复。" },
  ],
};

const initialData = {
  contentTypes: [
    {
      id: "anti_fraud" as const,
      name: "Anti-fraud education",
      shortName: "Anti-fraud",
      description: "Explain observable scam patterns.",
      goal: "Educate",
      example: "Example",
      recommendedCta: "Save this.",
    },
    {
      id: "build_in_public" as const,
      name: "Build in public",
      shortName: "Build progress",
      description: "Share factual progress.",
      goal: "Build trust",
      example: "Example",
      recommendedCta: "What next?",
    },
  ],
  topics: [],
} satisfies Pick<BootstrapData, "contentTypes" | "topics">;

function createApi(overrides: Partial<XGeneratorApi> = {}): XGeneratorApi {
  return {
    generate: vi.fn().mockResolvedValue(generation),
    translate: vi.fn().mockImplementation(async ({ text }) => ({ text, zh_summary: "更新后的中文对照" })),
    log: vi.fn().mockResolvedValue({ id: "entry-one" }),
    gitInsights: vi.fn().mockResolvedValue({
      commits: [{ hash: "ae3e92d", date: "2026-09-04", subject: "docs: switch provider plan", files: ["product-spec.md"] }],
      insights: [{
        title: "Provider plan changed",
        whatChanged: "The planned audio provider moved to Alibaba Cloud Paraformer.",
        whyItMatters: "The setup matches the accounts available to the builder.",
        lesson: "Infrastructure choices must be operable.",
        commitHashes: ["ae3e92d"],
      }],
    }),
    ...overrides,
  };
}

describe("X generator", () => {
  test("records the edited draft only after clipboard success", async () => {
    const user = userEvent.setup();
    const api = createApi();
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    render(<XGenerator initialData={initialData} api={api} clipboard={clipboard} />);

    expect(screen.getByRole("button", { name: /反诈教育（anti_fraud）/ })).toBeVisible();
    await user.type(screen.getByLabelText("素材内容"), "A real product change");
    await user.click(screen.getByRole("button", { name: "生成 3 版推文" }));
    expect(screen.getByDisplayValue("Draft one")).toBeVisible();
    expect(screen.getByText("第一版中文对照")).toBeVisible();
    expect(screen.getByText("呈现清晰证据。")).toBeVisible();
    await user.clear(screen.getByLabelText("编辑第 1 版推文"));
    await user.type(screen.getByLabelText("编辑第 1 版推文"), "Edited final post");
    await user.click(screen.getByRole("button", { name: "复制并记入台账：第 1 版" }));

    expect(clipboard.writeText).toHaveBeenCalledWith("Edited final post");
    expect(api.log).toHaveBeenCalledOnce();
    expect(vi.mocked(api.log).mock.calls[0][0].finalText).toBe("Edited final post");
    expect(JSON.stringify(vi.mocked(api.log).mock.calls[0][0])).not.toMatch(/zh_summary|whyItWorks|第一版中文对照/);
  });

  test("does not log when clipboard copying fails", async () => {
    const user = userEvent.setup();
    const api = createApi();
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error("denied")) };
    render(<XGenerator initialData={initialData} api={api} clipboard={clipboard} />);

    await user.type(screen.getByLabelText("素材内容"), "A real product change");
    await user.click(screen.getByRole("button", { name: "生成 3 版推文" }));
    await user.click(screen.getByRole("button", { name: "复制并记入台账：第 1 版" }));

    expect(api.log).not.toHaveBeenCalled();
    expect(screen.getByText("无法访问剪贴板，未写入台账。")).toBeVisible();
  });

  test("offers ledger retry without copying twice", async () => {
    const user = userEvent.setup();
    const log = vi.fn().mockRejectedValueOnce(new Error("disk busy")).mockResolvedValueOnce({ id: "entry-one" });
    const api = createApi({ log });
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    render(<XGenerator initialData={initialData} api={api} clipboard={clipboard} />);

    await user.type(screen.getByLabelText("素材内容"), "A real product change");
    await user.click(screen.getByRole("button", { name: "生成 3 版推文" }));
    await user.click(screen.getByRole("button", { name: "复制并记入台账：第 1 版" }));
    expect(screen.getByText("已复制，但未写入台账。")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重试写入台账" }));

    expect(log).toHaveBeenCalledTimes(2);
    expect(clipboard.writeText).toHaveBeenCalledOnce();
    expect(screen.getByText("已复制并记录到本地台账。")).toBeVisible();
  });

  test("disables copying when an edit exceeds 280 code points", async () => {
    const user = userEvent.setup();
    const api = createApi();
    render(<XGenerator initialData={initialData} api={api} clipboard={{ writeText: vi.fn() }} />);

    await user.type(screen.getByLabelText("素材内容"), "A real product change");
    await user.click(screen.getByRole("button", { name: "生成 3 版推文" }));
    await user.clear(screen.getByLabelText("编辑第 1 版推文"));
    await user.type(screen.getByLabelText("编辑第 1 版推文"), "x".repeat(281));

    expect(screen.getByRole("button", { name: "复制并记入台账：第 1 版" })).toBeDisabled();
    expect(screen.getByText("281 / 280")).toBeVisible();
  });

  test("imports a fact-supported Git insight into source material", async () => {
    const user = userEvent.setup();
    const api = createApi();
    render(<XGenerator initialData={initialData} api={api} clipboard={{ writeText: vi.fn() }} />);

    await user.click(screen.getByRole("button", { name: "提炼 Git 素材" }));
    await user.click(screen.getByRole("button", { name: "使用：Provider plan changed" }));

    const source = (screen.getByLabelText("素材内容") as HTMLTextAreaElement).value;
    expect(source).toContain("The planned audio provider moved");
    expect(source).toContain("ae3e92d");
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

type Translation = { text: string; zh_summary: string };

async function generatedStudio(api = createApi()) {
  const user = userEvent.setup();
  render(<XGenerator initialData={initialData} api={api} clipboard={{ writeText: vi.fn() }} />);
  await user.type(screen.getByLabelText("素材内容"), "Original evidence");
  await user.click(screen.getByRole("button", { name: "生成 3 版推文" }));
  return user;
}

function card(index = 1) {
  return within(screen.getByLabelText(`编辑第 ${index} 版推文`).closest("article")!);
}

function edit(text: string, index = 1) {
  fireEvent.change(screen.getByLabelText(`编辑第 ${index} 版推文`), { target: { value: text } });
}

describe("bilingual review synchronization", () => {
  test("disables copy and translation for Chinese, empty or overlong edited text", async () => {
    await generatedStudio();
    for (const invalid of ["混入中文的 text", "", "x".repeat(281)]) {
      edit(invalid);
      expect(card().getByRole("button", { name: "复制并记入台账：第 1 版" })).toBeDisabled();
      expect(card().getByRole("button", { name: "更新中文对照" })).toBeDisabled();
    }
  });

  test("keeps a late translation stale when editing continues without another refresh", async () => {
    const pending = deferred<Translation>();
    const user = await generatedStudio(createApi({ translate: vi.fn().mockReturnValue(pending.promise) }));
    edit("First revision");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    edit("Second revision");
    await act(async () => pending.resolve({ text: "First revision", zh_summary: "已经过期的译文" }));
    expect(card().getByText("英文已修改，中文对照待更新")).toBeVisible();
    expect(screen.queryByText("已经过期的译文")).not.toBeInTheDocument();
    expect(card().getByText("第一版中文对照")).toBeVisible();
  });

  test("a late failure cannot overwrite a successful newer translation", async () => {
    const pending = deferred<Translation>();
    const user = await generatedStudio(createApi({ translate: vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ text: "Second revision", zh_summary: "有效新译文" }) }));
    edit("First revision");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    edit("Second revision");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    await act(async () => pending.reject(new Error("Late error")));
    expect(card().getByText("有效新译文")).toBeVisible();
    expect(card().queryByRole("alert")).not.toBeInTheDocument();
  });

  test("generation failure preserves the edited English and its current Chinese comparison", async () => {
    const api = createApi({ generate: vi.fn().mockResolvedValueOnce(generation).mockRejectedValueOnce(new Error("Network error")) });
    const user = await generatedStudio(api);
    edit("Edited English");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    await user.click(screen.getByRole("button", { name: "生成 3 版推文" }));
    expect(screen.getByLabelText("编辑第 1 版推文")).toHaveValue("Edited English");
    expect(card().getByText("更新后的中文对照")).toBeVisible();
  });

  test("marks only the edited version stale and refreshes without changing English", async () => {
    const api = createApi();
    const user = await generatedStudio(api);
    edit("It may be a signal, not proof.");
    expect(card().getByText("英文已修改，中文对照待更新")).toBeVisible();
    expect(card(2).queryByText("英文已修改，中文对照待更新")).not.toBeInTheDocument();
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    expect(api.translate).toHaveBeenCalledWith({ text: "It may be a signal, not proof." });
    expect(card().getByText("更新后的中文对照")).toBeVisible();
    expect(screen.getByLabelText("编辑第 1 版推文")).toHaveValue("It may be a signal, not proof.");
    expect(card().queryByText("英文已修改，中文对照待更新")).not.toBeInTheDocument();
  });

  test("restoring the corresponding English clears the stale mark without a request", async () => {
    const api = createApi();
    await generatedStudio(api);
    edit("Temporary edit");
    edit("Draft one");
    expect(card().queryByText("英文已修改，中文对照待更新")).not.toBeInTheDocument();
    expect(api.translate).not.toHaveBeenCalled();
  });

  test("ignores a late response after another edit and a newer translation", async () => {
    const old = deferred<Translation>();
    const fresh = deferred<Translation>();
    const api = createApi({ translate: vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise) });
    const user = await generatedStudio(api);
    edit("Older English");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    edit("Newest English");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    await act(async () => fresh.resolve({ text: "Newest English", zh_summary: "最新译文" }));
    await act(async () => old.resolve({ text: "Older English", zh_summary: "过期译文" }));
    expect(card().getByText("最新译文")).toBeVisible();
    expect(screen.queryByText("过期译文")).not.toBeInTheDocument();
  });

  test("keeps simultaneous translations tied to their own versions", async () => {
    const first = deferred<Translation>();
    const second = deferred<Translation>();
    const api = createApi({ translate: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) });
    const user = await generatedStudio(api);
    edit("Version A edited");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    edit("Version B edited", 2);
    await user.click(card(2).getByRole("button", { name: "更新中文对照" }));
    await act(async () => second.resolve({ text: "Version B edited", zh_summary: "只属于乙版的译文" }));
    await act(async () => first.resolve({ text: "Version A edited", zh_summary: "只属于甲版的译文" }));
    expect(card().getByText("只属于甲版的译文")).toBeVisible();
    expect(card(2).getByText("只属于乙版的译文")).toBeVisible();
  });

  test("ignores a translation from the previous generation", async () => {
    const old = deferred<Translation>();
    const nextGeneration = { ...generation, generationId: "generation-two", drafts: generation.drafts.map((draft) => ({ ...draft, text: `${draft.text} new`, zh_summary: "新一批中文对照" })) };
    const api = createApi({ translate: vi.fn().mockReturnValue(old.promise), generate: vi.fn().mockResolvedValueOnce(generation).mockResolvedValueOnce(nextGeneration) });
    const user = await generatedStudio(api);
    edit("Older batch edited");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    await user.click(screen.getByRole("button", { name: "生成 3 版推文" }));
    await act(async () => old.resolve({ text: "Older batch edited", zh_summary: "旧批次译文" }));
    expect(screen.getByLabelText("编辑第 1 版推文")).toHaveValue("Draft one new");
    expect(card().getByText("新一批中文对照")).toBeVisible();
    expect(screen.queryByText("旧批次译文")).not.toBeInTheDocument();
  });

  test("preserves the English and old translation after failure and supports retry", async () => {
    const api = createApi({ translate: vi.fn().mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValueOnce({ text: "Edited English", zh_summary: "重试成功译文" }) });
    const user = await generatedStudio(api);
    edit("Edited English");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    expect(card().getByText("第一版中文对照")).toBeVisible();
    expect(card().getByRole("alert")).toHaveTextContent(/中文|失败/);
    expect(screen.getByLabelText("编辑第 1 版推文")).toHaveValue("Edited English");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    expect(card().getByText("重试成功译文")).toBeVisible();
  });

  test("refuses a translation response for different English", async () => {
    const api = createApi({ translate: vi.fn().mockResolvedValue({ text: "Wrong English", zh_summary: "不该显示的译文" }) });
    const user = await generatedStudio(api);
    edit("Edited English");
    await user.click(card().getByRole("button", { name: "更新中文对照" }));
    expect(card().getByText("英文已修改，中文对照待更新")).toBeVisible();
    expect(screen.queryByText("不该显示的译文")).not.toBeInTheDocument();
  });

  test("records the generation source and type even after the input form changes", async () => {
    const api = createApi();
    const user = await generatedStudio(api);
    await user.click(screen.getByRole("button", { name: /公开构建（build_in_public）/ }));
    fireEvent.change(screen.getByLabelText("素材内容"), { target: { value: "Different source" } });
    await user.click(card().getByRole("button", { name: "复制并记入台账：第 1 版" }));
    expect(api.log).toHaveBeenCalledWith(expect.objectContaining({ contentType: "anti_fraud", source: expect.objectContaining({ material: "Original evidence" }), finalText: "Draft one" }));
  });
});
