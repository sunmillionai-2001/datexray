"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DraftCard } from "@/components/draft-card";
import { GitImporter } from "@/components/git-importer";
import { ImageStudio } from "@/components/image-studio";
import { CONTENT_TYPE_ZH, contentTypeLabel, localizeErrorMessage } from "@/lib/i18n/zh-cn";
import type {
  BootstrapData,
  ContentTypeId,
  CopyLedgerInput,
  GenerationResult,
  GitCommit,
  GitInsight,
  LedgerEntry,
  LedgerSource,
  TranslationResult,
} from "@/lib/types";

export type XGeneratorApi = {
  generate: (input: { contentType: ContentTypeId; material: string; topicId?: string; context?: { goal?: string } }) => Promise<GenerationResult>;
  translate: (input: { text: string }) => Promise<TranslationResult>;
  log: (input: CopyLedgerInput) => Promise<Pick<LedgerEntry, "id"> | { id: string }>;
  gitInsights: (rangeDays: number) => Promise<{ commits: GitCommit[]; insights: GitInsight[] }>;
};

type ClipboardWriter = { writeText: (text: string) => Promise<void> };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { data?: T; error?: string };
  if (!response.ok || !payload.data) throw new Error(payload.error || "本地 API 请求失败。");
  return payload.data;
}

const browserApi: XGeneratorApi = {
  generate: (input) => postJson<GenerationResult>("/api/generate", input),
  translate: (input) => postJson<TranslationResult>("/api/translate", input),
  log: (input) => postJson<LedgerEntry>("/api/ledger", input),
  gitInsights: (rangeDays) => postJson<{ commits: GitCommit[]; insights: GitInsight[] }>("/api/git-insights", { rangeDays }),
};

type DraftBatch = GenerationResult & {
  batchId: number;
  contentType: ContentTypeId;
  source: LedgerSource;
};

export function XGenerator({
  initialData,
  api = browserApi,
  clipboard,
  initialType,
  initialMaterial = "",
  initialTopicId,
}: {
  initialData: Pick<BootstrapData, "contentTypes" | "topics">;
  api?: XGeneratorApi;
  clipboard?: ClipboardWriter;
  initialType?: ContentTypeId;
  initialMaterial?: string;
  initialTopicId?: string;
}) {
  const fallbackType = initialData.contentTypes[0]?.id ?? "anti_fraud";
  const [contentType, setContentType] = useState<ContentTypeId>(initialType ?? fallbackType);
  const [material, setMaterial] = useState(initialMaterial);
  const [goal, setGoal] = useState("");
  const [topicId, setTopicId] = useState<string | undefined>(initialTopicId);
  const [sourceKind, setSourceKind] = useState<"manual" | "topic" | "git" | "reuse">(initialTopicId ? "topic" : initialMaterial ? "reuse" : "manual");
  const [commitHashes, setCommitHashes] = useState<string[]>([]);
  const [generation, setGeneration] = useState<DraftBatch | null>(null);
  const generationRequest = useRef(0);
  const [editedDrafts, setEditedDrafts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [copyingIndex, setCopyingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingLog, setPendingLog] = useState<CopyLedgerInput | null>(null);
  const [imageIndex, setImageIndex] = useState<number | null>(null);

  useEffect(() => () => { generationRequest.current += 1; }, []);

  const selectedType = useMemo(
    () => initialData.contentTypes.find((candidate) => candidate.id === contentType),
    [contentType, initialData.contentTypes],
  );

  function chooseTopic(id: string) {
    const topic = initialData.topics.find((candidate) => candidate.id === id);
    if (!topic) return;
    setTopicId(topic.id);
    setSourceKind("topic");
    setCommitHashes([]);
    setContentType(topic.contentTypes[0] ?? fallbackType);
    setMaterial(`${topic.title}\nAngle: ${topic.angle}${topic.notes ? `\nNotes: ${topic.notes}` : ""}`);
  }

  async function generate() {
    const batchId = ++generationRequest.current;
    const source: LedgerSource = { kind: sourceKind, topicId: topicId ?? null, material, commitHashes: [...commitHashes] };
    setBusy(true);
    setError("");
    setMessage("");
    setPendingLog(null);
    try {
      const result = await api.generate({
        contentType,
        material,
        topicId,
        context: goal.trim() ? { goal: goal.trim() } : undefined,
      });
      if (batchId !== generationRequest.current) return;
      setGeneration({ ...result, batchId, contentType, source });
      setEditedDrafts(result.drafts.map((draft) => draft.text));
      setImageIndex(null);
    } catch (reason) {
      if (batchId !== generationRequest.current) return;
      setError(reason instanceof Error ? localizeErrorMessage(reason.message) : "无法生成推文。");
    } finally {
      if (batchId === generationRequest.current) setBusy(false);
    }
  }

  function buildLedgerInput(index: number): CopyLedgerInput {
    if (!generation) throw new Error("请先生成推文，再执行复制。");
    return {
      channel: "x",
      contentType: generation.contentType,
      source: generation.source,
      generation: {
        generationId: generation.generationId,
        variantIndex: index,
        originalText: generation.drafts[index].text,
      },
      finalText: editedDrafts[index],
    };
  }

  async function saveLedger(input: CopyLedgerInput) {
    try {
      await api.log(input);
      setPendingLog(null);
      setError("");
      setMessage("已复制并记录到本地台账。");
    } catch {
      setPendingLog(input);
      setMessage("");
      setError("已复制，但未写入台账。");
    }
  }

  async function copyDraft(index: number) {
    const input = buildLedgerInput(index);
    setCopyingIndex(index);
    setError("");
    setMessage("");
    try {
      const writer = clipboard ?? navigator.clipboard;
      await writer.writeText(input.finalText);
    } catch {
      setError("无法访问剪贴板，未写入台账。");
      setCopyingIndex(null);
      return;
    }
    await saveLedger(input);
    setCopyingIndex(null);
  }

  function useGitInsight(insight: GitInsight) {
    setContentType(initialData.contentTypes.some((item) => item.id === "build_in_public") ? "build_in_public" : fallbackType);
    setTopicId(undefined);
    setSourceKind("git");
    setCommitHashes(insight.commitHashes);
    setMaterial([
      `Build update: ${insight.title}`,
      `What changed: ${insight.whatChanged}`,
      `Why it matters: ${insight.whyItMatters}`,
      insight.lesson ? `Lesson: ${insight.lesson}` : "",
      `Commits: ${insight.commitHashes.join(", ")}`,
    ].filter(Boolean).join("\n"));
    document.getElementById("source-material")?.focus();
  }

  return (
    <main className="page-shell studio-page">
      <section className="page-intro studio-intro"><div><p className="eyebrow">X 生成器 · @DATEXRAY</p><h1>写出鲜明的<br /><em>专业观点。</em></h1><p className="lede">提供事实，选择类型，DeepSeek 将生成三版可编辑的英文推文。只有你亲自发布后，内容才会出现在 X。</p></div></section>

      <div className="studio-layout">
        <section className="composer-panel">
          <div className="form-section">
            <div className="form-number">01</div><div><p className="eyebrow">选择内容类型</p><h2>这条推文要完成什么任务？</h2></div>
            <div className="type-grid">
              {initialData.contentTypes.map((type) => <button type="button" key={type.id} className={contentType === type.id ? "selected" : ""} onClick={() => setContentType(type.id)}><strong>{contentTypeLabel(type.id)}</strong><span>{CONTENT_TYPE_ZH[type.id].description}</span></button>)}
            </div>
          </div>

          <div className="form-section">
            <div className="form-number">02</div><div><p className="eyebrow">添加事实素材</p><h2>给它真实、可核验的内容。</h2></div>
            {initialData.topics.length ? <label className="field-label">使用已保存选题<select value={topicId ?? ""} onChange={(event) => event.target.value && chooseTopic(event.target.value)}><option value="">从选题池选择</option>{initialData.topics.filter((topic) => topic.status !== "archived").map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label> : null}
            <label className="field-label" htmlFor="source-material">素材内容<textarea id="source-material" aria-label="素材内容" value={material} onChange={(event) => { setMaterial(event.target.value); if (sourceKind === "manual") setTopicId(undefined); }} rows={8} placeholder="粘贴事实、产品更新、已核验数据或故事片段……内容建议使用英文。" /><small>{Array.from(material).length} / 12,000</small></label>
            <label className="field-label">运营目标（可选）<input value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} placeholder="例如：发起有价值的讨论，不使用话题标签" /></label>
          </div>

          <div className="generate-bar"><div><span className="signal-light" />{selectedType ? contentTypeLabel(selectedType.id) : "未选择内容类型"}<small>英文 · 3 个版本 · 不超过 280 字符</small></div><button type="button" aria-label="生成 3 版推文" onClick={generate} disabled={busy || material.trim().length < 3}>{busy ? "生成中…" : "生成 3 版推文"}<span>→</span></button></div>
          {error ? <div className="studio-alert error" role="alert"><span>!</span><p>{error}</p>{pendingLog ? <button type="button" onClick={() => saveLedger(pendingLog)}>重试写入台账</button> : null}</div> : null}
          {message ? <div className="studio-alert success" role="status"><span>✓</span><p>{message}</p></div> : null}
        </section>

        <aside className="voice-card"><p className="eyebrow">品牌声音检查</p><h2>提供证据，<br />不替人下结论。</h2><ul><li>专业，但不显得冷冰冰</li><li>有用，但不制造恐慌</li><li>观点清晰，同时保留语境空间</li><li>给出参考行动，不替用户做关系决定</li></ul><div>参考表达（英文）<br /><strong>“Here is what this pattern may signal—and what you can verify next.”</strong></div></aside>
      </div>

      {generation ? <section className="drafts-section"><div className="section-heading"><div><p className="eyebrow">03 · 中英对照审阅</p><h2>同一组事实，三种英文表达。</h2><p className="drafts-description">中文帮助你理解英文；编辑正文后，可单独更新对应中译。角度与策略说明基于生成时的初稿。</p><span className="type-chip">本批内容：{contentTypeLabel(generation.contentType)}</span></div><span className="generation-id">生成 ID {generation.generationId.slice(0, 8)}</span></div><div className="draft-grid">{generation.drafts.map((draft, index) => <DraftCard key={`${generation.batchId}-${index}`} draft={draft} index={index} text={editedDrafts[index] ?? ""} busy={copyingIndex === index} onChange={(text) => setEditedDrafts((current) => current.map((value, currentIndex) => currentIndex === index ? text : value))} onCopy={() => copyDraft(index)} translate={api.translate} onImage={() => { setImageIndex(index); setTimeout(() => document.getElementById(`image-studio-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} />)}</div>
        {generation.drafts.map((_, index) => <div key={`image-${generation.batchId}-${index}`} id={`image-studio-${index}`} hidden={imageIndex !== index}><ImageStudio index={index} text={editedDrafts[index] ?? ""} material={generation.source.material} contentType={generation.contentType} /></div>)}
      </section> : null}

      <GitImporter api={api} onSelect={useGitInsight} />
    </main>
  );
}
