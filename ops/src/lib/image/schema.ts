import { CONTENT_TYPE_IDS, type ContentTypeId } from "@/lib/types";
import { validateTranslationText } from "@/lib/ai/schema";

export type ImageRequest = { text: string; material: string; contentType: ContentTypeId; template: "insight" | "dialogue"; hypothetical: boolean };
export type BilingualCopy = { en: string; zh: string };
export const COPY_LIMITS = { headline: 95, support: 160, quote: 220, evidence: 220, source: 85, hook: 75 } as const;
export type CopyField = keyof typeof COPY_LIMITS;
const COPY_FIELD_ZH: Record<CopyField, string> = { headline: "标题", support: "支撑说明", quote: "对话原文", evidence: "数字证据", source: "数据来源", hook: "产品钩子" };
export const SIGNALS = {
  payment_pressure: ["Payment pressure", "付款施压"],
  urgency: ["Urgency pressure", "催促施压"],
  investment_push: ["Investment prompting", "投资引导"],
  avoidance: ["Avoiding verification", "回避核实"],
  guilt_pressure: ["Guilt-based pressure", "内疚施压"],
  none: ["Context matters", "需要结合语境"],
} as const;
export type ImageCopy = Record<CopyField, BilingualCopy> & { signal: keyof typeof SIGNALS; mood: "warning" | "progress" | "neutral" };
export type ImageResult = { request: ImageRequest; copy: ImageCopy };
export class ImageValidationError extends Error {}
function fail(message: string): never { throw new ImageValidationError(message); }
export function isImageEnglish(value: string) {
  return /[A-Za-z]/.test(value) && !/[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Symbol}\s]/u.test(value);
}
export function dialogueExcerpts(material: string): string[] {
  const quoted = Array.from(material.matchAll(/["“]([^"”\n]+)["”]/g), (match) => match[1]);
  const lines = material.split("\n").flatMap((line) => {
    const match = line.match(/^\s*[A-Za-z][A-Za-z .'-]{0,35}:\s*(.+)$/);
    return match && !/^(source|note|notes|title|fact|data|url|https?):/i.test(line.trim()) ? [match[1]] : [];
  });
  return [...new Set([...quoted, ...lines].filter(isImageEnglish))];
}
export function validateImageRequest(value: unknown): ImageRequest {
  if (!value || typeof value !== "object") fail("配图请求格式不正确。");
  const input = value as ImageRequest;
  try { validateTranslationText(typeof input.text === "string" ? input.text : ""); } catch { fail("请先填写不超过 280 字符的英文推文。"); }
  if (typeof input.material !== "string" || !input.material.trim() || input.material.length > 12000) fail("配图需要本版原始素材，且不能超过 12,000 字符。");
  if (!CONTENT_TYPE_IDS.includes(input.contentType) || !["insight", "dialogue"].includes(input.template) || typeof input.hypothetical !== "boolean") fail("请选择有效的配图类型。");
  if (input.template === "insight" && input.hypothetical) fail("虚构教学示例只适用于对话模板。");
  if (input.template === "dialogue" && !input.hypothetical && !dialogueExcerpts(input.material).length) fail("素材中没有可引用的英文对话。请补充带引号或“姓名: 对话”的英文原文后重新生成推文，或明确选择虚构教学示例。");
  return { text: input.text, material: input.material, contentType: input.contentType, template: input.template, hypothetical: input.hypothetical };
}
const NUMBER_WORD_PATTERN = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?";
const numeric = new RegExp(`\\d|\\b${NUMBER_WORD_PATTERN}\\b`, "i");
function numericContextTokens(text: string) {
  const tokens = new RegExp(`[$€£]?\\d+(?:[.,]\\d+)*(?:%|\\s*(?:USD|dollars?))?|\\b${NUMBER_WORD_PATTERN}\\b|\\b(?:hours?|days?|weeks?|months?|years?|percent|per\\s+(?:hour|day|week|month|year))\\b`, "gi");
  return [...text.matchAll(tokens)].map((match) => match[0].toLowerCase());
}
export function validateImageCopy(copy: ImageCopy, input: ImageRequest) {
  for (const field of Object.keys(COPY_LIMITS) as CopyField[]) {
    const value = copy[field]?.en;
    if (typeof value !== "string" || (value && !isImageEnglish(value))) fail("图内文字必须为英文，请检查所有字段。");
    const length = Array.from(value).length;
    if (length > COPY_LIMITS[field]) fail(`${COPY_FIELD_ZH[field]}文案过长（${length} / ${COPY_LIMITS[field]}），请缩短并保留条件、否定和限定语。`);
  }
  if (!copy.headline.en.trim() || !copy.support.en.trim()) fail("请填写英文标题和支撑说明。");
  if (!Object.hasOwn(SIGNALS, copy.signal) || !["warning", "progress", "neutral"].includes(copy.mood)) fail("信号标签只能描述预设行为，不能给人贴标签。");
  if (input.template === "insight") {
    if (copy.quote.en) fail("观点卡不能包含伪造的对话引用。");
    if (copy.evidence.en) {
      const lines = input.material.split("\n").map((line) => line.trim());
      const sources = lines.flatMap((line) => { const match = line.match(/^(?:Source|来源):\s*(.+)$/i); return match ? [match[1]] : []; });
      if (!numeric.test(copy.evidence.en) || !lines.includes(copy.evidence.en) || !copy.source.en || !sources.includes(copy.source.en)) fail("数字证据必须是素材中的完整一行，来源必须匹配“Source: 来源”行；缺少完整依据时请使用无数字观点卡。");
      if (!copy.evidence.en.includes(copy.headline.en)) fail("数字卡标题必须直接取自证据，不能改写数字或单位。");
      if (numericContextTokens(copy.evidence.en).some((token) => !copy.headline.en.toLowerCase().includes(token))) fail("数字卡标题必须保留证据中的数字、单位和时间上下文。");
    } else if (numeric.test(copy.headline.en + " " + copy.support.en + " " + copy.hook.en) || copy.source.en) fail("没有原始数字证据时只能生成无数字观点卡。");
  } else {
    if (copy.evidence.en || copy.source.en) fail("对话卡不能附加无关数据。");
    if (!copy.quote.en.trim()) fail("请提供对话内容。");
    if (!input.hypothetical && !dialogueExcerpts(input.material).includes(copy.quote.en)) fail("真实对话必须逐字匹配原始素材，不能改写或伪造引用。");
  }
  // Numeric facts belong in the immutable evidence/quote, never in a free-form caption.
  if (numeric.test(copy.support.en + " " + copy.hook.en) || (input.template === "dialogue" && numeric.test(copy.headline.en))) fail("请将数字保留在证据或对话中，不要在可编辑说明中新增数字。");
}
export function parseImageCopy(value: unknown, input: ImageRequest): ImageCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("AI 配图响应格式不正确，请重试。");
  const record = value as Record<string, unknown>;
  const keys = [...Object.keys(COPY_LIMITS), "signal", "mood"];
  if (Object.keys(record).length !== keys.length || keys.some((key) => !(key in record))) fail("AI 配图字段缺失或多余，请重试。");
  for (const field of Object.keys(COPY_LIMITS) as CopyField[]) {
    const pair = record[field] as BilingualCopy | undefined;
    if (!pair || typeof pair.en !== "string" || typeof pair.zh !== "string" || Object.keys(pair).sort().join(",") !== "en,zh" || pair.zh.length > 1000 || (pair.en && !/[\u3400-\u9fff]/u.test(pair.zh))) fail("AI 配图缺少忠实中文对照，请重试。");
    const zhNumbers = pair.zh.replaceAll(",", "");
    if ((pair.en.replaceAll(",", "").match(/\d+(?:\.\d+)?/g) ?? []).some((number) => !zhNumbers.includes(number))) fail("AI 配图中文对照丢失了英文中的数字，请重试。");
  }
  const copy = record as ImageCopy;
  validateImageCopy(copy, input);
  return copy;
}
export function imageTheme(type: ContentTypeId, mood: ImageCopy["mood"]) {
  if (type === "anti_fraud") return "warning";
  if (type === "build_in_public") return "progress";
  if (mood === "warning") return "warning";
  if (mood === "progress") return "progress";
  return "neutral";
}
