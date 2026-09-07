"use client";

import { useEffect, useRef, useState } from "react";
import { ImageCard } from "@/components/image-card";
import { localizeErrorMessage } from "@/lib/i18n/zh-cn";
import { COPY_LIMITS, SIGNALS, validateImageCopy, validateImageRequest, type CopyField, type ImageCopy, type ImageRequest, type ImageResult } from "@/lib/image/schema";
import { downloadImagePng } from "@/lib/image/export";
import type { ContentTypeId } from "@/lib/types";
import styles from "./image-studio.module.css";

const labels: Record<CopyField, string> = { headline: "标题", support: "支撑说明", quote: "对话原文", evidence: "完整数字证据", source: "数据来源", hook: "产品钩子" };
async function requestImage(input: ImageRequest): Promise<ImageResult> {
  const response = await fetch("/api/image-copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const payload = await response.json();
  if (!response.ok || !payload.data) throw new Error(payload.error || "配图生成失败，请重试。");
  return payload.data;
}
export function ImageStudio({ text, material, contentType, index, generate = requestImage, download = downloadImagePng }: {
  text: string; material: string; contentType: ContentTypeId; index: number;
  generate?: (input: ImageRequest) => Promise<ImageResult>;
  download?: (node: HTMLElement, name: string) => Promise<void>;
}) {
  const [template, setTemplate] = useState<ImageRequest["template"]>("insight");
  const [hypothetical, setHypothetical] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [edited, setEdited] = useState<ImageCopy | null>(null);
  const [showHook, setShowHook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scale, setScale] = useState(1);
  const preview = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const currentText = useRef(text);
  const hasResult = Boolean(result);
  useEffect(() => { currentText.current = text; sequence.current += 1; }, [text, material, contentType]);
  useEffect(() => () => { sequence.current += 1; }, []);
  useEffect(() => {
    if (!preview.current) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / 1200)));
    observer.observe(preview.current);
    return () => observer.disconnect();
  }, [hasResult]);
  const stale = Boolean(result && (
    result.request.text !== text ||
    result.request.material !== material ||
    result.request.contentType !== contentType ||
    result.request.template !== template ||
    result.request.hypothetical !== hypothetical
  ));
  let validation = "";
  if (edited && result) { try { validateImageCopy(edited, result.request); } catch (reason) { validation = (reason as Error).message; } }
  async function create() {
    if (busy) return;
    const ticket = ++sequence.current;
    const input = { text, material, contentType, template, hypothetical };
    setError(""); setNotice("");
    try {
      validateImageRequest(input);
      setBusy(true);
      const next = await generate(input);
      if (ticket !== sequence.current || currentText.current !== input.text) return;
      if ((Object.keys(input) as (keyof ImageRequest)[]).some((key) => next.request[key] !== input[key])) throw new Error("配图返回与所选版本不匹配，请重试。");
      validateImageCopy(next.copy, input);
      setResult(next); setEdited(next.copy);
    } catch (reason) {
      if (ticket === sequence.current) setError(reason instanceof Error ? localizeErrorMessage(reason.message) : "配图生成失败，编辑内容已保留。");
    } finally { setBusy(false); }
  }
  async function save() {
    if (!canvas.current || !edited || !result || stale || exporting) return;
    setExporting(true); setError(""); setNotice("");
    try {
      validateImageCopy(edited, result.request);
      await download(canvas.current, `datexray-${result.request.template}-v${index + 1}.png`);
      setNotice("PNG 已下载（1200 × 675）。图片为独立附件，不会修改推文或台账。");
    } catch (reason) { setError(reason instanceof Error ? localizeErrorMessage(reason.message) : "PNG 导出失败，编辑内容已保留。"); }
    finally { setExporting(false); }
  }
  function edit(field: CopyField, en: string) {
    sequence.current += 1;
    setEdited((previous) => previous ? { ...previous, [field]: { ...previous[field], en } } : previous);
    setNotice("");
  }
  const fields = (Object.keys(COPY_LIMITS) as CopyField[]).filter((field) => edited && (edited[field].en || ["headline", "support", "hook"].includes(field)));
  return <section className={styles.studio} aria-label={`第 ${index + 1} 版配图工作区`}>
    <header><p className="eyebrow">04 · 配图工作区 · 版本 {String.fromCharCode(65 + index)}</p><h2>让观点有一张自己的名片。</h2><p>图内全英文，中文对照不入图。仅点击生成时向 DeepSeek 提交本版英文及原始素材；排版和导出在本机完成。</p></header>
    <div className={styles.controls}>
      <label>模板<select aria-label="配图模板" value={template} disabled={busy || exporting} onChange={(event) => { sequence.current += 1; setTemplate(event.target.value as ImageRequest["template"]); setHypothetical(false); }}><option value="insight">数据／观点卡</option><option value="dialogue">对话摘录卡</option></select></label>
      {template === "dialogue" ? <label className={styles.check}><input type="checkbox" checked={hypothetical} disabled={busy || exporting} onChange={(event) => { sequence.current += 1; setHypothetical(event.target.checked); }} />明确使用虚构教学示例（图内强制标注）</label> : null}
      <button type="button" onClick={create} disabled={busy || exporting}>{busy ? "正在提炼配图文案…" : result ? "重新生成配图" : "生成配图"}</button>
    </div>
    <details><summary>查看本版绑定素材与来源要求</summary><p>数字卡需单独一行完整英文数据句（保留单位、时间），另起一行写“Source: 英文来源”，否则使用无数字观点。真实对话需带引号或“姓名: 对话”的英文原文；请先移除隐私信息。</p><pre>{material}</pre><p lang="en">本版英文：{text}</p></details>
    {stale ? <p role="status" className={styles.warning}>英文或配图选项已修改，当前图片已过期；请重新生成后下载。旧编辑仍保留。</p> : null}
    {error ? <p role="alert" className={styles.warning}>{error}</p> : null}
    {result && edited ? <>
      <div ref={preview} className={styles.preview} style={{ height: 675 * scale }}><div style={{ width: 1200, transform: `scale(${scale})`, transformOrigin: "top left" }}><ImageCard copy={edited} request={result.request} showHook={showHook} cardRef={canvas} /></div></div>
      <div className={styles.editHeader}><h3>画布外 · 英文微调与中文审阅</h3><label className={styles.check}><input type="checkbox" checked={showHook} disabled={exporting} onChange={(event) => setShowHook(event.target.checked)} />显示产品钩子（默认仅品牌和网址）</label></div>
      <div className={styles.fields}>{fields.map((field) => {
        const locked = ["quote", "evidence", "source"].includes(field) || (field === "headline" && Boolean(edited.evidence.en));
        const changed = edited[field].en !== result.copy[field].en;
        return <div key={field} className={styles.field}><label>{labels[field]} · 英文{locked ? "（来源锁定）" : ""}<textarea aria-label={`配图${labels[field]}`} lang="en" rows={3} value={edited[field].en} readOnly={locked} disabled={exporting || busy} onChange={(event) => edit(field, event.target.value)} /><small>{Array.from(edited[field].en).length} / {COPY_LIMITS[field]}</small></label><div lang="zh-CN"><strong>中文对照{changed ? "（对应修改前英文）" : ""}</strong><p>{result.copy[field].zh || "无"}</p>{changed ? <p className={styles.warning}>英文已修改，旧中译仅供参考。请自行核对或重新生成；不会自动增加 AI 请求。</p> : null}</div></div>;
      })}</div>
      <p>行为标签：{SIGNALS[edited.signal][1]}。{result.request.hypothetical ? "虚构标识固定显示：Hypothetical example（虚构教学示例）。" : "证据与引用保持原样；如需修改，请回到原始素材重新生成。"}</p>
      {validation ? <p role="alert" className={styles.warning}>{validation}</p> : null}
      <button type="button" onClick={save} disabled={stale || Boolean(validation) || exporting || busy}>{exporting ? "正在导出 PNG…" : "下载 PNG（1200 × 675）"}</button>
    </> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </section>;
}
