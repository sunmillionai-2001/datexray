import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { ImageCard } from "@/components/image-card";
import { ImageStudio } from "@/components/image-studio";
import { assertImageFits } from "@/lib/image/export";
import type { ImageCopy, ImageRequest, ImageResult } from "@/lib/image/schema";

const pair = (en: string, zh: string) => ({ en, zh });
const request: ImageRequest = { text: "Pressure is not proof.", material: "Pressure is not proof.", contentType: "anti_fraud", template: "insight", hypothetical: false };
const copy: ImageCopy = {
  headline: pair("Pressure is not proof.", "施压不等于证据。"),
  support: pair("Pause and verify the context.", "暂停并核实语境。"),
  quote: pair("", ""), evidence: pair("", ""), source: pair("", ""),
  hook: pair("Review patterns with DateXray.", "使用 DateXray 审视行为模式。"),
  signal: "payment_pressure", mood: "warning",
};

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

describe("image studio", () => {
  test("binds one generation request to the selected final English and original material", async () => {
    const user = userEvent.setup();
    const generate = vi.fn(async (input: ImageRequest): Promise<ImageResult> => ({ request: input, copy }));
    render(<ImageStudio text={request.text} material={request.material} contentType="anti_fraud" index={1} generate={generate} />);
    await user.click(screen.getByRole("button", { name: "生成配图" }));
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(request);
    expect(screen.getByText("施压不等于证据。")).toBeVisible();
    const canvas = document.querySelector("[data-image-canvas]") as HTMLElement;
    expect(canvas).toHaveAttribute("data-theme", "warning");
    expect(canvas.textContent).toContain("Pressure is not proof.");
    expect(canvas.textContent).not.toMatch(/[\u3400-\u9fff]/u);
    expect(canvas.textContent).not.toContain("Review patterns with DateXray.");
    expect(canvas.textContent).not.toContain("Notice patterns. Keep your agency.");
  });

  test("blocks a real dialogue request before AI when source has no dialogue", async () => {
    const user = userEvent.setup();
    const generate = vi.fn();
    render(<ImageStudio text={request.text} material="Narrative notes without a quote." contentType="anti_fraud" index={0} generate={generate} />);
    await user.selectOptions(screen.getByLabelText("配图模板"), "dialogue");
    await user.click(screen.getByRole("button", { name: "生成配图" }));
    expect(generate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("素材中没有可引用的英文对话");
  });

  test("puts the mandatory hypothetical label inside a fictional dialogue image", async () => {
    const user = userEvent.setup();
    const dialogueCopy: ImageCopy = { ...copy, quote: pair("If you care, pay now.", "如果你在乎，就现在付款。") };
    const generate = vi.fn(async (input: ImageRequest): Promise<ImageResult> => ({ request: input, copy: dialogueCopy }));
    render(<ImageStudio text={request.text} material="Teaching notes only." contentType="anti_fraud" index={0} generate={generate} />);
    await user.selectOptions(screen.getByLabelText("配图模板"), "dialogue");
    await user.click(screen.getByLabelText("明确使用虚构教学示例（图内强制标注）"));
    await user.click(screen.getByRole("button", { name: "生成配图" }));
    const canvas = document.querySelector("[data-image-canvas]") as HTMLElement;
    expect(within(canvas).getByText("Hypothetical example")).toBeVisible();
    expect(within(canvas).getByText(/If you care, pay now/)).toBeVisible();
  });

  test("preserves local edits when regeneration fails", async () => {
    const user = userEvent.setup();
    const generate = vi.fn()
      .mockImplementationOnce(async (input: ImageRequest): Promise<ImageResult> => ({ request: input, copy }))
      .mockRejectedValueOnce(new Error("DeepSeek request failed with status 503."));
    render(<ImageStudio text={request.text} material={request.material} contentType="anti_fraud" index={0} generate={generate} />);
    await user.click(screen.getByRole("button", { name: "生成配图" }));
    await user.clear(screen.getByLabelText("配图标题"));
    await user.type(screen.getByLabelText("配图标题"), "A careful review matters.");
    await user.click(screen.getByRole("button", { name: "重新生成配图" }));
    expect(screen.getByLabelText("配图标题")).toHaveValue("A careful review matters.");
    expect(screen.getByRole("alert")).toHaveTextContent("DeepSeek 请求失败");
  });

  test("marks an image stale and prevents downloading after English changes", async () => {
    const user = userEvent.setup();
    const generate = vi.fn(async (input: ImageRequest): Promise<ImageResult> => ({ request: input, copy }));
    const download = vi.fn();
    const view = render(<ImageStudio text={request.text} material={request.material} contentType="anti_fraud" index={0} generate={generate} download={download} />);
    await user.click(screen.getByRole("button", { name: "生成配图" }));
    view.rerender(<ImageStudio text="The English changed." material={request.material} contentType="anti_fraud" index={0} generate={generate} download={download} />);
    expect(screen.getByText(/当前图片已过期/)).toBeVisible();
    expect(screen.getByRole("button", { name: "下载 PNG（1200 × 675）" })).toBeDisabled();
  });

  test("marks an image stale when its source material or content type changes", async () => {
    const user = userEvent.setup();
    const generate = vi.fn(async (input: ImageRequest): Promise<ImageResult> => ({ request: input, copy }));
    const view = render(<ImageStudio text={request.text} material={request.material} contentType="anti_fraud" index={0} generate={generate} />);
    await user.click(screen.getByRole("button", { name: "生成配图" }));
    view.rerender(<ImageStudio text={request.text} material="A different source." contentType="build_in_public" index={0} generate={generate} />);
    expect(screen.getByText(/当前图片已过期/)).toBeVisible();
    expect(screen.getByRole("button", { name: "下载 PNG（1200 × 675）" })).toBeDisabled();
  });

  test("keeps Chinese out of image after editing and blocks invalid English copy", async () => {
    const user = userEvent.setup();
    const generate = vi.fn(async (input: ImageRequest): Promise<ImageResult> => ({ request: input, copy }));
    render(<ImageStudio text={request.text} material={request.material} contentType="anti_fraud" index={0} generate={generate} />);
    await user.click(screen.getByRole("button", { name: "生成配图" }));
    fireEvent.change(screen.getByLabelText("配图标题"), { target: { value: "中文标题" } });
    expect(screen.getByRole("button", { name: "下载 PNG（1200 × 675）" })).toBeDisabled();
    expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent("图内文字必须为英文");
  });

  test("renders progress and neutral themes without changing the brand skeleton", () => {
    const { rerender } = render(<ImageCard copy={{ ...copy, mood: "neutral" }} request={{ ...request, contentType: "build_in_public" }} showHook={false} />);
    expect(document.querySelector("[data-image-canvas]")).toHaveAttribute("data-theme", "progress");
    expect(screen.getByText("DateXray")).toBeVisible();
    rerender(<ImageCard copy={{ ...copy, mood: "neutral" }} request={{ ...request, contentType: "interaction" }} showHook={false} />);
    expect(document.querySelector("[data-image-canvas]")).toHaveAttribute("data-theme", "neutral");
    expect(screen.getByText("DateXray")).toBeVisible();
  });

  test("rejects a long layout instead of silently shrinking or clipping it", () => {
    const child = document.createElement("p");
    Object.defineProperties(child, { clientHeight: { value: 80 }, scrollHeight: { value: 110 }, clientWidth: { value: 200 }, scrollWidth: { value: 200 } });
    child.dataset.fit = "";
    const node = document.createElement("div");
    Object.defineProperties(node, { clientHeight: { value: 675 }, scrollHeight: { value: 675 }, clientWidth: { value: 1200 }, scrollWidth: { value: 1200 } });
    node.append(child);
    expect(() => assertImageFits(node)).toThrow("配图文案超出画布");
  });

  test("allows decorative layers to bleed outside the clipped canvas", () => {
    const child = document.createElement("p");
    Object.defineProperties(child, { clientHeight: { value: 80 }, scrollHeight: { value: 80 }, clientWidth: { value: 200 }, scrollWidth: { value: 200 } });
    child.dataset.fit = "";
    const node = document.createElement("div");
    Object.defineProperties(node, { clientHeight: { value: 675 }, scrollHeight: { value: 675 }, clientWidth: { value: 1200 }, scrollWidth: { value: 1300 } });
    node.append(child);
    expect(() => assertImageFits(node)).not.toThrow();
  });

  test("allows the small vertical glyph overhang reported by the local Geist font", () => {
    const child = document.createElement("h2");
    Object.defineProperties(child, { clientHeight: { value: 117 }, scrollHeight: { value: 122 }, clientWidth: { value: 1096 }, scrollWidth: { value: 1096 } });
    child.dataset.fit = "";
    const node = document.createElement("div");
    node.append(child);
    expect(() => assertImageFits(node)).not.toThrow();
  });
});
