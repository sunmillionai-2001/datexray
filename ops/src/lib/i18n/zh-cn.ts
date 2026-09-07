import type { ContentMetrics, ContentTypeId, LedgerStatus, TopicStatus } from "@/lib/types";

export const CONTENT_TYPE_ZH: Record<ContentTypeId, {
  name: string;
  description: string;
  goal: string;
  recommendedCta: string;
}> = {
  anti_fraud: {
    name: "反诈教育",
    description: "讲解可观察到的恋爱诈骗模式和更安全的核验动作，不武断认定某个人是骗子。",
    goal: "通过实用的约会安全教育建立信任。",
    recommendedCta: "建议收藏，并分享给正在使用约会软件的人。",
  },
  product_demo: {
    name: "产品演示",
    description: "使用虚构的约会对话，展示 DateXray 如何以证据为先分析风险信号。",
    goal: "在不暴露真实用户对话的前提下，让产品能力更直观。",
    recommendedCta: "前往 datexray.com 体验私密对话检查。",
  },
  build_in_public: {
    name: "公开构建",
    description: "分享已经上线的改动、背后的产品原因，以及构建 DateXray 的具体经验。",
    goal: "通过透明、基于事实的进展更新建立可信度。",
    recommendedCta: "你希望我们下一步开发什么？",
  },
  opinion: {
    name: "观点",
    description: "围绕约会安全、AI 判断、隐私或负责任的产品设计表达清晰且可辩护的观点。",
    goal: "建立鲜明的账号观点，并邀请有价值的讨论。",
    recommendedCta: "你会把边界画在哪里？",
  },
  interaction: {
    name: "互动",
    description: "提出一个聚焦的问题，帮助读者比较经历或检验安全观点，不索取私人对话。",
    goal: "获得有价值的回复，了解受众真正关心的问题。",
    recommendedCta: "回复你认为最容易被忽视的风险模式。",
  },
  founder_pov: {
    name: "创始人视角",
    description: "以 DateXray 构建者身份，讲述产品选择、不确定性或经验，不虚构客户故事。",
    goal: "让账号更有人格，同时保持身份和事实透明。",
    recommendedCta: "我们会继续构建，也期待你的看法。",
  },
};

export function contentTypeLabel(id: ContentTypeId, includeId = true) {
  const name = CONTENT_TYPE_ZH[id].name;
  return includeId ? `${name}（${id}）` : name;
}

export const LEDGER_STATUS_ZH: Record<LedgerStatus, string> = {
  copied: "已复制",
  published: "已发布",
  archived: "已归档",
};

export const TOPIC_STATUS_ZH: Record<TopicStatus, string> = {
  backlog: "待创作",
  used: "已使用",
  archived: "已归档",
};

export const METRIC_LABELS_ZH: Record<keyof ContentMetrics, string> = {
  impressions: "浏览量",
  likes: "点赞",
  replies: "回复",
  reposts: "转帖",
  bookmarks: "收藏",
  linkClicks: "链接点击",
};

export const BRAND_VOICE_ZH = {
  identity: "一个专业、有观点、用故事表达的约会安全产品构建者。",
  principles: [
    "从可观察的证据出发。",
    "提供教育价值，不制造恐慌。",
    "给出可参考的行动建议，不替读者做决定。",
    "以创始人或产品构建者身份发言时保持透明。",
  ],
  decisionBoundary: "绝不替读者决定是否离开、留下、约会、信任或拒绝某个人。",
  tones: ["清晰", "专业", "有人情味", "具体"],
};

export const VISUAL_TEMPLATE_ZH: Record<string, { name: string; layout: string }> = {
  "scam-pattern-card": {
    name: "诈骗模式卡片",
    layout: "风险信号标签、一句警示语、三个可观察检查点，以及参考行动页脚。",
  },
  "build-log-card": {
    name: "构建日志卡片",
    layout: "小号构建编号、大号上线改动、一句价值说明，以及一条经验总结。",
  },
  "conversation-prompt-card": {
    name: "互动提问卡片",
    layout: "简短引导标签、一个核心问题、两个对比选项，以及回复提示。",
  },
};

const EXACT_ERRORS: Record<string, string> = {
  "Translation text must contain between 1 and 280 characters.": "需要更新中译的英文正文必须为 1 到 280 个字符。",
  "Translation text must be written in English.": "请保持推文正文为英文，再更新中文对照。",
  "DeepSeek returned invalid Chinese translation after one repair attempt.": "中文对照更新失败：DeepSeek 修复一次后仍未返回有效中译，请重试。",
  "Request body must be a JSON object.": "请求内容必须是 JSON 对象。",
  "Choose one of the six supported content types.": "请选择六种受支持的内容类型之一。",
  "Range must be 7, 14, or 30 days.": "Git 时间范围只能选择 7、14 或 30 天。",
  "DEEPSEEK_API_KEY is not configured.": "尚未配置 DEEPSEEK_API_KEY。",
  "No commits were found in the selected range.": "所选时间范围内没有找到 Git 提交。",
  "DeepSeek returned no JSON content.": "DeepSeek 未返回 JSON 内容。",
  "DeepSeek returned malformed JSON.": "DeepSeek 返回的 JSON 格式有误。",
  "DeepSeek returned invalid X drafts after one repair attempt.": "DeepSeek 修复一次后仍未返回有效的 X 推文。",
  "DeepSeek returned invalid Git insights after one repair attempt.": "DeepSeek 修复一次后仍未返回有效的 Git 素材。",
  "Invalid ledger entry.": "台账记录格式无效。",
  "Ledger entry not found.": "未找到该台账记录。",
  "Topic not found.": "未找到该选题。",
  "Invalid topic status.": "选题状态无效。",
  "Topic content types must use the supported library.": "选题必须使用内容库支持的内容类型。",
  "Unable to save copied content.": "无法保存已复制的推文。",
  "Unable to complete local request.": "无法完成本地请求。",
};

export function localizeErrorMessage(message: string) {
  if (EXACT_ERRORS[message]) return EXACT_ERRORS[message];
  if (message.startsWith("DeepSeek request failed with status ")) {
    return message.replace("DeepSeek request failed with status ", "DeepSeek 请求失败，状态码：");
  }
  if (message.startsWith("Source material must contain at least ")) return "素材内容至少需要 3 个字符。";
  if (message.startsWith("Source material must contain at most ")) return "素材内容不能超过 12,000 个字符。";
  if (message.startsWith("Operator goal must contain at most ")) return "运营目标不能超过 500 个字符。";
  if (message.startsWith("Final text must contain between ")) return "最终推文必须为 1 到 280 个字符。";
  if (message.startsWith("Topic title is required")) return "请输入选题标题。";
  if (message.startsWith("Topic title is too long")) return "选题标题过长。";
  if (message.startsWith("Topic angle is required")) return "请输入选题角度。";
  if (message.startsWith("Topic angle is too long")) return "选题角度过长。";
  if (message.startsWith("Unable to read Git history")) return "无法读取本地 Git 历史。";
  if (/[\u3400-\u9fff]/u.test(message)) return message;
  return "操作失败，请检查本地服务后重试。";
}
