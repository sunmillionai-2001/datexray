import { translateXText } from "@/lib/ai/generate";
import { dataResponse, errorResponse, readJsonBody } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    return dataResponse(await translateXText(typeof body.text === "string" ? body.text : ""));
  } catch (error) {
    return errorResponse(error);
  }
}
