const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-pro";
const REQUEST_TIMEOUT_MS = 55_000;

type DeepSeekPayload = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

export type DeepSeekDependencies = {
  apiKey?: string;
  fetch?: typeof fetch;
};

export type DeepSeekRequestOptions = { maxTokens?: number; temperature?: number };

export async function requestDeepSeekJson(
  system: string,
  user: string,
  dependencies: DeepSeekDependencies = {},
  options: DeepSeekRequestOptions = {},
): Promise<unknown> {
  const apiKey = dependencies.apiKey === undefined ? process.env.DEEPSEEK_API_KEY?.trim() : dependencies.apiKey.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured.");
  const fetchImplementation = dependencies.fetch ?? fetch;
  const response = await fetchImplementation(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 1600,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`DeepSeek request failed with status ${response.status}.`);
  const payload = await response.json() as DeepSeekPayload;
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("DeepSeek returned no JSON content.");
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("DeepSeek returned malformed JSON.");
  }
}
