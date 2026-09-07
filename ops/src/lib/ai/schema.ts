import type { GenerationDraft, GitInsight } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasExactKeys(record: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function requiredText(value: unknown, field: string, maxLength = 800) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  const text = value.replace(/\s+/g, " ").trim();
  if (Array.from(text).length > maxLength) throw new Error(`${field} is too long.`);
  return text;
}

function looksEnglish(text: string) {
  return /[A-Za-z]/.test(text) && !/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(text);
}

export function validateTranslationText(text: string) {
  if (!text.trim() || Array.from(text).length > 280) {
    throw new Error("Translation text must contain between 1 and 280 characters.");
  }
  if (!looksEnglish(text)) throw new Error("Translation text must be written in English.");
}

function requiredChinese(value: unknown, field: string, maxLength: number) {
  const text = requiredText(value, field, maxLength);
  if (!/[\u3400-\u9fff]/u.test(text)) throw new Error(`${field} must be written in Simplified Chinese.`);
  return text;
}

export function parseChineseTranslation(value: unknown): string {
  const root = asRecord(value);
  if (!root || !hasExactKeys(root, ["zh_summary"])) {
    throw new Error("Response must contain only zh_summary.");
  }
  return requiredChinese(root.zh_summary, "zh_summary", 800);
}

export function parseXDrafts(value: unknown): GenerationDraft[] {
  const root = asRecord(value);
  if (!root || !hasExactKeys(root, ["drafts"]) || !Array.isArray(root.drafts) || root.drafts.length !== 3) {
    throw new Error("Response must contain exactly three drafts.");
  }

  const drafts = root.drafts.map((candidate, index) => {
    const draft = asRecord(candidate);
    if (!draft || !hasExactKeys(draft, ["angle", "text", "zh_summary", "whyItWorks"])) {
      throw new Error(`Draft ${index + 1} has an invalid shape.`);
    }
    const text = requiredText(draft.text, `Draft ${index + 1} text`, 280);
    if (!looksEnglish(text)) throw new Error(`Draft ${index + 1} must be written in English.`);
    return {
      angle: requiredChinese(draft.angle, `Draft ${index + 1} angle`, 100),
      text,
      zh_summary: requiredChinese(draft.zh_summary, `Draft ${index + 1} zh_summary`, 800),
      whyItWorks: requiredChinese(draft.whyItWorks, `Draft ${index + 1} whyItWorks`, 240),
    };
  });

  if (new Set(drafts.map((draft) => draft.text.toLocaleLowerCase())).size !== drafts.length) {
    throw new Error("Draft text must be distinct.");
  }
  return drafts;
}

export function parseGitInsights(value: unknown, allowedHashes: Set<string>): GitInsight[] {
  const root = asRecord(value);
  if (!root || !hasExactKeys(root, ["insights"]) || !Array.isArray(root.insights)) {
    throw new Error("Response must contain an insights array.");
  }
  if (root.insights.length < 1 || root.insights.length > 5) {
    throw new Error("Response must contain between one and five insights.");
  }

  return root.insights.map((candidate, index) => {
    const insight = asRecord(candidate);
    if (!insight || !hasExactKeys(insight, ["title", "whatChanged", "whyItMatters", "lesson", "commitHashes"])) {
      throw new Error(`Insight ${index + 1} has an invalid shape.`);
    }
    if (!Array.isArray(insight.commitHashes) || insight.commitHashes.length < 1) {
      throw new Error(`Insight ${index + 1} must cite at least one commit.`);
    }
    const commitHashes = insight.commitHashes.map((hash) => requiredText(hash, "Commit hash", 64));
    if (commitHashes.some((hash) => !allowedHashes.has(hash))) {
      throw new Error(`Insight ${index + 1} cites an unavailable commit.`);
    }
    return {
      title: requiredText(insight.title, `Insight ${index + 1} title`, 120),
      whatChanged: requiredText(insight.whatChanged, `Insight ${index + 1} whatChanged`, 500),
      whyItMatters: requiredText(insight.whyItMatters, `Insight ${index + 1} whyItMatters`, 500),
      lesson: typeof insight.lesson === "string" ? insight.lesson.replace(/\s+/g, " ").trim().slice(0, 500) : "",
      commitHashes,
    };
  });
}
