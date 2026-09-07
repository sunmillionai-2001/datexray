import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { GET as getBootstrap } from "@/app/api/bootstrap/route";
import { POST as generate } from "@/app/api/generate/route";
import { POST as getGitInsights } from "@/app/api/git-insights/route";
import { GET as getLedger, POST as copyToLedger } from "@/app/api/ledger/route";
import { PATCH as updateTopic } from "@/app/api/topics/[id]/route";
import { GET as getTopics, POST as createTopic } from "@/app/api/topics/route";

let dataDir = "";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "datexray-ops-routes-"));
  process.env.OPS_DATA_DIR = dataDir;
  delete process.env.DEEPSEEK_API_KEY;
  await Promise.all([
    writeFile(path.join(dataDir, "content-ledger.example.json"), '{"version":1,"entries":[]}\n'),
    writeFile(path.join(dataDir, "topics.example.json"), '{"version":1,"topics":[]}\n'),
  ]);
});

afterEach(async () => {
  delete process.env.OPS_DATA_DIR;
  delete process.env.DEEPSEEK_API_KEY;
  await rm(dataDir, { recursive: true, force: true });
});

describe("local operations API", () => {
  test("bootstrap initializes local runtime files and returns static libraries", async () => {
    const response = await getBootstrap();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.contentTypes).toHaveLength(6);
    expect(payload.data.templates).toHaveLength(2);
    expect(payload.data.ledger.entries).toEqual([]);
    expect(payload.data.topics).toEqual([]);
  });

  test("generate rejects an unknown content type before provider work", async () => {
    const response = await generate(jsonRequest("http://localhost/api/generate", {
      contentType: "unknown",
      material: "Useful source material",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "请选择六种受支持的内容类型之一。" });
  });

  test("generate reports a missing server key as unavailable", async () => {
    const response = await generate(jsonRequest("http://localhost/api/generate", {
      contentType: "opinion",
      material: "Evidence-first tools should show their work.",
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "尚未配置 DEEPSEEK_API_KEY。" });
  });

  test("copy endpoint records the final edited text", async () => {
    const response = await copyToLedger(jsonRequest("http://localhost/api/ledger", {
      channel: "x",
      contentType: "build_in_public",
      source: { kind: "git", topicId: null, material: "Shipped safer unlocks", commitHashes: ["df723e7"] },
      generation: { generationId: "generation-one", variantIndex: 0, originalText: "Original" },
      finalText: "Edited final text",
    }));
    const ledgerResponse = await getLedger();
    const ledger = await ledgerResponse.json();

    expect(response.status).toBe(201);
    expect(ledger.data.entries).toHaveLength(1);
    expect(ledger.data.entries[0].finalText).toBe("Edited final text");
  });

  test("topic endpoints create and archive an idea", async () => {
    const createdResponse = await createTopic(jsonRequest("http://localhost/api/topics", {
      title: "Video-call avoidance",
      angle: "Explain why repeated avoidance matters as part of a pattern.",
      contentTypes: ["anti_fraud", "opinion"],
      tags: ["verification", "video-call"],
      notes: "Use an invented example.",
    }));
    const created = (await createdResponse.json()).data;
    const updatedResponse = await updateTopic(
      jsonRequest(`http://localhost/api/topics/${created.id}`, { status: "archived" }, "PATCH"),
      { params: Promise.resolve({ id: created.id }) },
    );
    const topicsResponse = await getTopics();
    const topics = (await topicsResponse.json()).data;

    expect(createdResponse.status).toBe(201);
    expect(updatedResponse.status).toBe(200);
    expect(topics[0]).toMatchObject({ id: created.id, status: "archived" });
  });

  test("Git insight endpoint rejects ranges outside the allowlist", async () => {
    const response = await getGitInsights(jsonRequest("http://localhost/api/git-insights", { rangeDays: 365 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Git 时间范围只能选择 7、14 或 30 天。" });
  });
});
