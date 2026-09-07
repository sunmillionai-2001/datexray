import { localizeErrorMessage } from "@/lib/i18n/zh-cn";

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json() as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error("Request body must be a JSON object.");
  }
}

export function dataResponse(data: unknown, status = 200) {
  return Response.json({ data }, { status });
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to complete local request.";
  const localized = localizeErrorMessage(message);
  if (message === "DEEPSEEK_API_KEY is not configured.") return Response.json({ error: localized }, { status: 503 });
  if (message.includes("DeepSeek returned") || message.includes("DeepSeek request failed")) {
    return Response.json({ error: localized }, { status: 502 });
  }
  if (message.includes("not found")) return Response.json({ error: localized }, { status: 404 });
  const validationMessages = [
    "Choose one of the six supported content types.",
    "Range must be 7, 14, or 30 days.",
    "Request body must be a JSON object.",
    "Source material",
    "Final text",
    "Translation text",
    "Topic title",
    "Topic angle",
    "Topic content types",
    "Invalid topic status",
    "Invalid ledger entry",
  ];
  if (validationMessages.some((candidate) => message.startsWith(candidate))) {
    return Response.json({ error: localized }, { status: 400 });
  }
  return Response.json({ error: "无法完成本地请求。" }, { status: 500 });
}
