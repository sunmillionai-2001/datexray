export const CONTENT_TYPE_IDS = [
  "anti_fraud",
  "product_demo",
  "build_in_public",
  "opinion",
  "interaction",
  "founder_pov",
] as const;

export type ContentTypeId = (typeof CONTENT_TYPE_IDS)[number];

export type BrandVoice = {
  version: number;
  identity: string;
  principles: string[];
  languageRules: {
    language: string;
    tone: string[];
    avoid: string[];
    decisionBoundary: string;
  };
};

export type ContentType = {
  id: ContentTypeId;
  name: string;
  shortName: string;
  description: string;
  goal: string;
  example: string;
  recommendedCta: string;
};

export type VisualTemplate = {
  id: string;
  name: string;
  aspectRatio: string;
  recommendedTypes: ContentTypeId[];
  layout: string;
  copySlots: string[];
  colors: string[];
  exampleContent: Record<string, string>;
};

export type TopicStatus = "backlog" | "used" | "archived";

export type Topic = {
  id: string;
  title: string;
  angle: string;
  contentTypes: ContentTypeId[];
  tags: string[];
  source: "manual" | "git";
  status: TopicStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

export type TopicsData = {
  version: 1;
  topics: Topic[];
};

export type ContentMetrics = {
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  bookmarks: number;
  linkClicks: number;
};

export type LedgerSource = {
  kind: "manual" | "topic" | "git" | "reuse";
  topicId: string | null;
  material: string;
  commitHashes: string[];
};

export type LedgerGeneration = {
  generationId: string;
  variantIndex: number;
  originalText: string;
};

export type LedgerStatus = "copied" | "published" | "archived";

export type LedgerEntry = {
  id: string;
  channel: "x";
  contentType: ContentTypeId;
  source: LedgerSource;
  generation: LedgerGeneration;
  finalText: string;
  status: LedgerStatus;
  copyCount: number;
  firstCopiedAt: string;
  lastCopiedAt: string;
  publishedAt: string | null;
  postUrl: string | null;
  metrics: ContentMetrics;
  isTopPerformer: boolean;
  reviewNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type LedgerData = {
  version: 1;
  entries: LedgerEntry[];
};

export type LedgerEntryPatch = {
  finalText?: string;
  status?: LedgerStatus;
  publishedAt?: string | null;
  postUrl?: string | null;
  metrics?: Partial<ContentMetrics>;
  isTopPerformer?: boolean;
  reviewNotes?: string;
};

export type CopyLedgerInput = Pick<LedgerEntry, "channel" | "contentType" | "source" | "generation" | "finalText">;

export type GenerationDraft = {
  angle: string;
  text: string;
  zh_summary: string;
  whyItWorks: string;
};

export type TranslationResult = {
  text: string;
  zh_summary: string;
};

export type GenerationResult = {
  generationId: string;
  drafts: GenerationDraft[];
};

export type GitCommit = {
  hash: string;
  date: string;
  subject: string;
  files: string[];
};

export type GitInsight = {
  title: string;
  whatChanged: string;
  whyItMatters: string;
  lesson: string;
  commitHashes: string[];
};

export type BootstrapData = {
  brand: BrandVoice;
  contentTypes: ContentType[];
  templates: VisualTemplate[];
  ledger: LedgerData;
  topics: Topic[];
};
