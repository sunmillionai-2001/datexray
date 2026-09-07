import { generateImageCopy } from "@/lib/ai/image-copy";
import { ImageValidationError } from "@/lib/image/schema";
import { dataResponse, errorResponse, readJsonBody } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return dataResponse(await generateImageCopy(await readJsonBody(request))); }
  catch (error) {
    if (error instanceof ImageValidationError) return Response.json({ error: error.message }, { status: 422 });
    return errorResponse(error);
  }
}
