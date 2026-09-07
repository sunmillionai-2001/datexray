import type { CSSProperties, Ref } from "react";
import { SIGNALS, imageTheme, type ImageCopy, type ImageRequest } from "@/lib/image/schema";
import styles from "./image-studio.module.css";

export function ImageCard({ copy, request, showHook, cardRef }: { copy: ImageCopy; request: ImageRequest; showHook: boolean; cardRef?: Ref<HTMLDivElement> }) {
  const theme = imageTheme(request.contentType, copy.mood);
  const accents = { warning: ["#ff8a3d", "#ff5869"], progress: ["#3cff8f", "#9dffcb"], neutral: ["#83ddff", "#b5a1ff"] };
  return <div ref={cardRef} className={styles.card} data-image-canvas data-theme={theme} lang="en" style={{ "--accent": accents[theme][0], "--accent-secondary": accents[theme][1] } as CSSProperties}>
    <div className={styles.orbit} aria-hidden="true" />
    <header className={styles.cardHeader}><span>DATEXRAY / {request.contentType.replaceAll("_", " ").toUpperCase()}</span><span>{request.hypothetical ? "Hypothetical example" : request.template === "dialogue" ? "Conversation excerpt" : copy.evidence.en ? "Evidence in context" : "A perspective to consider"}</span></header>
    <div className={styles.cardBody} data-fit>
      <h2 data-fit className={copy.evidence.en ? styles.numericHeadline : styles.headline}>{copy.headline.en}</h2>
      {request.template === "dialogue" ? <blockquote data-fit className={styles.quote}>“{copy.quote.en}”</blockquote> : null}
      {copy.evidence.en ? <div className={styles.evidence}><p data-fit>{copy.evidence.en}</p><small data-fit>Source: {copy.source.en}</small></div> : null}
      <p data-fit className={styles.support}>{copy.support.en}</p>
      {request.template === "dialogue" ? <div className={styles.signal}>{SIGNALS[copy.signal][0]} <span>· A signal, not a verdict</span></div> : null}
    </div>
    <footer className={styles.cardFooter}>
      <div className={styles.brand}><svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"><rect x="1" y="1" width="44" height="44" rx="14" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M11 14h6c10 0 10 18 0 18h-6V14Zm3 3v12h3c6 0 6-12 0-12h-3Zm11-3 4 6 4-6h4l-6 9 6 9h-4l-4-6-4 6h-4l6-9-6-9h4Z" fill="currentColor" /></svg><strong>DateXray</strong><span>datexray.com</span></div>
      {showHook && copy.hook.en ? <p data-fit>{copy.hook.en}</p> : null}
    </footer>
  </div>;
}
