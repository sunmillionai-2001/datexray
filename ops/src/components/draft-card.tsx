"use client";

import { useEffect, useId, useRef, useState } from "react";

import { validateTranslationText } from "@/lib/ai/schema";
import { localizeErrorMessage } from "@/lib/i18n/zh-cn";
import type { GenerationDraft, TranslationResult } from "@/lib/types";

export function DraftCard({
  draft,
  index,
  text,
  busy,
  onChange,
  onCopy,
  translate,
}: {
  draft: GenerationDraft;
  index: number;
  text: string;
  busy: boolean;
  onChange: (text: string) => void;
  onCopy: () => void;
  translate: (input: { text: string }) => Promise<TranslationResult>;
}) {
  const length = Array.from(text).length;
  const fieldId = useId();
  const requestId = useRef(0);
  const [translation, setTranslation] = useState<TranslationResult>({ text: draft.text, zh_summary: draft.zh_summary });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const stale = translation.text !== text;
  let validationError = "";
  try {
    validateTranslationText(text);
  } catch (reason) {
    validationError = reason instanceof Error ? localizeErrorMessage(reason.message) : "请检查英文正文。";
  }

  useEffect(() => () => { requestId.current += 1; }, []);

  function editText(value: string) {
    // An edit invalidates in-flight translations even if the user later restores the same text.
    requestId.current += 1;
    setRefreshing(false);
    setError("");
    onChange(value);
  }

  async function refreshTranslation() {
    if (refreshing || !stale || validationError) return;
    const currentRequest = ++requestId.current;
    const sourceText = text;
    setRefreshing(true);
    setError("");
    try {
      const result = await translate({ text: sourceText });
      if (requestId.current !== currentRequest) return;
      if (result.text !== sourceText || !result.zh_summary?.trim()) {
        throw new Error("中文对照与当前英文不匹配，请重试。");
      }
      setTranslation(result);
    } catch (reason) {
      if (requestId.current !== currentRequest) return;
      setError(reason instanceof Error ? localizeErrorMessage(reason.message) : "中文对照更新失败，请重试。");
    } finally {
      if (requestId.current === currentRequest) setRefreshing(false);
    }
  }

  return (
    <article className="draft-card">
      <header><span>版本 {String.fromCharCode(65 + index)}</span><strong>{draft.angle}</strong></header>
      <div className="draft-text-label"><label htmlFor={fieldId}>英文正文 · 用于 X</label><span className={length > 280 ? "over-limit" : undefined}>{length} / 280</span></div>
      <textarea
        id={fieldId}
        lang="en"
        aria-label={`编辑第 ${index + 1} 版推文`}
        value={text}
        onChange={(event) => editText(event.target.value)}
        rows={7}
      />
      {validationError && text ? <p className="draft-validation">{validationError}</p> : null}
      <section className={`draft-translation${stale ? " is-stale" : ""}`} aria-labelledby={`${fieldId}-translation`} aria-busy={refreshing}>
        <h3 id={`${fieldId}-translation`}>忠实中文对照</h3>
        {stale ? <p className="translation-status" role="status">英文已修改，中文对照待更新</p> : <span className="translation-current">已与当前英文同步</span>}
        {stale ? <small>上次译文（对应修改前正文）</small> : null}
        <p className="translation-copy" lang="zh-CN">{translation.zh_summary}</p>
        <button type="button" onClick={refreshTranslation} disabled={!stale || refreshing || Boolean(validationError)}>{refreshing ? "正在更新中文对照…" : "更新中文对照"}</button>
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
      </section>
      <div className="draft-meta"><h3>{text === draft.text ? "表达策略" : "表达策略（基于初稿）"}</h3><p>{draft.whyItWorks}</p></div>
      <p className="draft-copy-note">复制和入账仅包含英文正文。</p>
      <button
        type="button"
        aria-label={`复制并记入台账：第 ${index + 1} 版`}
        onClick={onCopy}
        disabled={busy || Boolean(validationError)}
      >
        {busy ? "保存中…" : `复制并记入台账：第 ${index + 1} 版`} <span aria-hidden="true">↗</span>
      </button>
    </article>
  );
}
