# DateXray Operations Workbench Design

Date: 2026-09-04
Status: Draft for review

## 1. Scope and operating constraints

The operations workbench is an internal, local-only tool for running the `@DateXray` X account. It is isolated from the public DateXray application and lives entirely under `/ops`.

- Run locally in development mode, bound to `127.0.0.1:3100`.
- Store the ledger and content records as repository files under `/ops/data`.
- Do not add authentication, accounts, databases, cloud storage, online deployment, or X API publishing.
- Do not change DateXray's relationship-analysis logic, prompts, report schema, or public routes.
- Reuse the existing DeepSeek environment variable, API endpoint, model, and JSON request conventions through an ops-local adapter.
- Keep TikTok and Reddit as visible placeholders only; do not implement their channel workflows.

The X account voice should feel professional, opinionated, and story-driven. Its primary themes are anti-fraud education and transparent build-in-public updates, supported by useful opinions and genuine interaction. The target daily cadence is one anti-fraud post, one progress post, and one interaction post.

## 2. Page structure

`/ops` is a standalone Next.js application with its own dependencies, source tree, tests, and development command.

| Route | Page | Responsibilities |
| --- | --- | --- |
| `/` | Today dashboard | Show today's cadence: anti-fraud 1 + progress 1 + interaction 1. Distinguish not prepared, copied, and published states. Surface recent and high-performing content. |
| `/channels/x` | X generator | Accept source material, select a content type, import a topic or Git insight, generate three English posts, edit one, copy it, and automatically add it to the ledger. |
| `/library` | Content library | Provide tabs for brand voice, six content types, topic pool, and visual templates. Allow topics to be created, edited, archived, and sent to the generator. |
| `/ledger` | Content ledger | Search and filter by date, content type, status, keyword, and high-performance flag. Allow historical content to be viewed, edited, and reused as inspiration. |
| `/review` | Performance review | Record the X URL, publication date, impressions, likes, replies, reposts, bookmarks, and link clicks. Calculate engagement rate and allow manual high-performance marking. |
| `/channels/tiktok` | TikTok placeholder | Show a clear “Not implemented” state and preserve the channel module boundary. |
| `/channels/reddit` | Reddit placeholder | Show a clear “Not implemented” state and preserve the channel module boundary. |

### 2.1 Git material extraction

Git material extraction is part of the X generator rather than a separate tool.

1. Choose the last 7, 14, or 30 days.
2. Read the repository's committed Git history locally. Do not read uncommitted source files.
3. Display commit subjects, dates, and changed-file summaries.
4. Ask DeepSeek to extract supported facts in the form “what changed / why it matters / what we learned.”
5. Let the operator select an insight as build-in-public source material.

The tool never publishes to X. The operator reviews and posts content manually.

## 3. Data model

All files use UTF-8 and two-space formatted JSON. Writes use a same-directory temporary file followed by an atomic rename so an interrupted save cannot corrupt the main file.

The public repository must not expose operating history. Static configuration files (`brand-voice.json`, `content-types.json`, and `visual-templates.json`) are committed. Runtime files (`content-ledger.json`, `topics.json`, and atomic-write temporary files) are ignored by `/ops/.gitignore` and remain local. Committed `content-ledger.example.json` and `topics.example.json` files provide empty starter data; the server copies them to the ignored runtime filenames on first use.

### 3.1 Brand voice: `data/brand-voice.json`

```json
{
  "version": 1,
  "identity": "A professional, opinionated, story-driven dating safety builder.",
  "principles": [
    "Lead with observable evidence.",
    "Educate without creating panic.",
    "Offer reference actions without making decisions for the reader.",
    "Be transparent when speaking as the founder or product builder."
  ],
  "languageRules": {
    "language": "en-US",
    "tone": ["clear", "professional", "human", "specific"],
    "avoid": ["diagnosis", "absolute verdicts", "fear bait", "invented statistics"],
    "decisionBoundary": "Never tell readers whether to leave, stay, date, trust, or reject someone."
  }
}
```

### 3.2 Content types: `data/content-types.json`

The library contains exactly six content types:

```ts
type ContentTypeId =
  | "anti_fraud"
  | "product_demo"
  | "build_in_public"
  | "opinion"
  | "interaction"
  | "founder_pov";
```

Each type contains a stable ID, English display name, description, goal, example, and recommended call to action:

```json
{
  "id": "anti_fraud",
  "name": "Anti-fraud education",
  "description": "Explain observable romance-scam patterns and safer reference actions.",
  "goal": "Build trust and practical safety awareness.",
  "example": "A reviewed English example post.",
  "recommendedCta": "Save this and share it with someone who dates online."
}
```

### 3.3 Topic pool: `data/topics.json`

```json
{
  "version": 1,
  "topics": [
    {
      "id": "topic_uuid",
      "title": "Why refusing every video call matters",
      "angle": "Explain the pattern without declaring the person a scammer.",
      "contentTypes": ["anti_fraud", "opinion"],
      "tags": ["video-call", "romance-scam"],
      "source": "manual",
      "status": "backlog",
      "notes": "",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "lastUsedAt": null
    }
  ]
}
```

`status` is `backlog | used | archived`. Generating from a topic updates `lastUsedAt`, but does not force archival, so the operator can reuse the underlying idea from another angle.

### 3.4 Visual templates: `data/visual-templates.json`

The library mirrors the two implemented 16:9, 1200×675 generator templates: `insight-card` and `dialogue-card`. Each definition contains `id`, `name`, `aspectRatio`, `recommendedTypes`, `layout`, `copySlots`, `colors`, and `exampleContent`.

### 3.5 Content ledger: `data/content-ledger.json`

```json
{
  "version": 1,
  "entries": [
    {
      "id": "entry_uuid",
      "channel": "x",
      "contentType": "build_in_public",
      "source": {
        "kind": "git",
        "topicId": null,
        "material": "Original source material",
        "commitHashes": ["ae3e92d"]
      },
      "generation": {
        "generationId": "generation_uuid",
        "variantIndex": 1,
        "originalText": "AI-generated version before editing"
      },
      "finalText": "Edited text copied by the operator",
      "status": "copied",
      "copyCount": 1,
      "firstCopiedAt": "ISO-8601",
      "lastCopiedAt": "ISO-8601",
      "publishedAt": null,
      "postUrl": null,
      "metrics": {
        "impressions": 0,
        "likes": 0,
        "replies": 0,
        "reposts": 0,
        "bookmarks": 0,
        "linkClicks": 0
      },
      "isTopPerformer": false,
      "reviewNotes": "",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ]
}
```

Ledger rules:

- `status` is `copied | published | archived`.
- Write to the ledger only after clipboard copying succeeds.
- Re-copying the same `generationId + variantIndex` updates the final text, timestamps, and `copyCount` instead of creating a duplicate.
- Supplying a publication time or X post URL changes the status to `published`.
- Engagement rate is calculated at read time and is not stored: `(likes + replies + reposts + bookmarks) / impressions`.
- The dashboard derives each daily cadence state from the ledger and displays copied and published separately.

## 4. AI generation flow

### 4.1 X post generation

```text
Manual material / topic / Git insight
                ↓
       Select one content type
                ↓
Load brand voice and content-type rules
                ↓
       POST /api/generate → DeepSeek
                ↓
Validate fixed JSON, English, 3 variants, ≤280 characters each
                ↓
       Display, select, and edit
                ↓
Clipboard copy succeeds → upsert ledger entry
```

Implementation constraints:

- Use an ops-local DeepSeek adapter.
- Reuse `DEEPSEEK_API_KEY`, the endpoint, model, and JSON response convention from the existing provider.
- Do not import or change the public product's relationship-analysis prompt, schema, or validator.
- Read the API key on the server only. Never send it to the browser or write it to logs.
- Return an actionable configuration error when the key is absent. Do not present mock copy as an AI result.
- Use a low but non-zero creative temperature, initially `0.6`, so the three drafts differ meaningfully.
- Do not browse or supplement source facts. Statistics, product progress, user feedback, and results must come from operator input or reviewed built-in material.
- Treat source material and Git history as untrusted content that cannot override system rules.

Request:

```json
{
  "contentType": "anti_fraud",
  "material": "Source material supplied by the operator",
  "topicId": "optional",
  "context": {
    "goal": "optional operator instruction"
  }
}
```

Fixed response:

```json
{
  "drafts": [
    {
      "angle": "证据优先",
      "text": "English post, maximum 280 characters",
      "zh_summary": "忠实中文对照译文，保留数字、否定、条件和语气强度",
      "whyItWorks": "中文表达策略说明，不承担翻译"
    },
    {
      "angle": "故事切入",
      "text": "English post, maximum 280 characters",
      "zh_summary": "忠实中文对照译文，保留数字、否定、条件和语气强度",
      "whyItWorks": "中文表达策略说明，不承担翻译"
    },
    {
      "angle": "发起讨论",
      "text": "English post, maximum 280 characters",
      "zh_summary": "忠实中文对照译文，保留数字、否定、条件和语气强度",
      "whyItWorks": "中文表达策略说明，不承担翻译"
    }
  ]
}
```

Server validation:

- Require exactly three drafts.
- Require non-empty `angle`, `text`, `zh_summary`, and `whyItWorks` fields. Require Chinese content in the three operator-facing fields; apply the English check to `text` only.
- Count Unicode characters and require `text` to be at most 280 characters.
- Reject three identical drafts.
- Reject fields outside the schema.
- If the first response is invalid, make one repair request containing the validation errors. If repair also fails, return a readable error and do not write to the ledger.

### 4.2 Bilingual review refresh

The bilingual review extension adds `POST /api/translate` with `{ text }`, returning `{ data: { text, zh_summary } }`. The server echoes the exact submitted English and only asks DeepSeek for its Chinese translation. Editing invalidates pending translation requests; each card and generation batch is isolated. See [bilingual review](bilingual-review.md) for synchronization and acceptance details. This does not change the Git insight contract below.

### 4.3 Image copy generation

`POST /api/image-copy` accepts the selected final English, the immutable source material for its generation batch, content type, template and explicit hypothetical consent. One user click makes one DeepSeek call at temperature 0; the server does not silently repair or retry image copy.

The fixed response contains bilingual pairs for `headline`, `support`, `quote`, `evidence`, `source` and `hook`, plus an allowlisted observable-behavior `signal` and `mood`. Only English enters the canvas. Server validation rejects Chinese image text, unsupported numbers, partial or rewritten numeric evidence, invented real dialogue, personality labels and overlong fields. See [image generation](image-generation.md) for the complete operator contract.

### 4.4 Git insight generation

The local server calls Git with an argument array instead of constructing a shell string. The date range is selected from a fixed allowlist.

```text
git log --since=<controlled-range> --date=iso-strict
```

DeepSeek returns:

```json
{
  "insights": [
    {
      "title": "Short build update",
      "whatChanged": "Fact supported by commits",
      "whyItMatters": "Product or engineering significance",
      "lesson": "A defensible lesson, or empty when commits do not support one",
      "commitHashes": ["ae3e92d"]
    }
  ]
}
```

The prompt forbids invented user counts, revenue, performance claims, outcomes, or personal stories that are not present in the commit data.

## 5. Error handling and local safety

- Bind the development server to loopback only.
- Validate all API request bodies and impose practical text limits before calling DeepSeek.
- Keep the allowed data filenames and Git date ranges in code; never accept arbitrary filesystem paths or Git arguments from the browser.
- Serialize writes per data file and use atomic replacement.
- Show separate messages for clipboard success, ledger failure, AI configuration failure, invalid AI output, and Git command failure.
- If clipboard copying succeeds but ledger persistence fails, retain the edited draft in the page and offer a retry button.
- Never log source material, generated posts, API keys, or full DeepSeek responses.

## 6. Test strategy

Use Vitest, React Testing Library, and a temporary data directory. All DeepSeek tests inject a fake `fetch`; tests never call the real API or consume credits.

### 6.1 Unit tests

- Brand rules and all six content-type definitions load successfully.
- The AI prompt contains the brand decision boundary, chosen content type, and original source material.
- AI output contains exactly three drafts and every draft is at most 280 Unicode characters.
- Non-JSON responses, missing fields, duplicate variants, extra fields, and overlong posts trigger one repair attempt or a clear failure.
- Git ranges accept only 7, 14, or 30 days.
- Git output parsing preserves commit date, hash, subject, and changed-file summary.
- Ledger create, update, repeated-copy deduplication, and atomic persistence work as specified.
- Keyword search, content-type filters, date filters, and high-performance filters return correct entries.
- Engagement rate safely returns zero when impressions are zero.
- The daily cadence derives `empty`, `copied`, and `published` correctly.

### 6.2 Component tests

- The generator selects a content type and displays three drafts.
- The edited text, rather than the original AI text, is copied and recorded.
- Clipboard failure does not create a ledger entry.
- Updating metrics refreshes the review values.
- TikTok and Reddit show placeholder states without misleading publishing actions.

### 6.3 Verification commands

```bash
cd /Users/sunbaogangdemac/dateradar/ops
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

Manual acceptance checks:

- `http://localhost:3100` opens successfully.
- The public application's `npm run build` does not read `/ops` and is unaffected by the workbench.
- Generate, edit, copy, and automatic ledger recording form a complete flow.
- Ledger records remain available after restarting the local application.
- Git insights contain only facts supported by actual commits.
- `.env.local`, API keys, and temporary data files are never committed.

## 7. Proposed directory structure

```text
ops/
├── docs/
│   └── design.md
├── data/
│   ├── brand-voice.json
│   ├── content-types.json
│   ├── topics.json
│   ├── visual-templates.json
│   └── content-ledger.json
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/
│   │   │   ├── git-insights/
│   │   │   ├── ledger/
│   │   │   └── topics/
│   │   ├── channels/
│   │   │   ├── x/
│   │   │   ├── tiktok/
│   │   │   └── reddit/
│   │   ├── ledger/
│   │   ├── library/
│   │   ├── review/
│   │   └── page.tsx
│   ├── components/
│   └── lib/
│       ├── ai/
│       ├── data/
│       ├── git/
│       └── ledger/
├── tests/
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

This structure keeps every operations concern under `/ops`, makes the X implementation explicit, and preserves clean channel boundaries for future TikTok and Reddit work.
