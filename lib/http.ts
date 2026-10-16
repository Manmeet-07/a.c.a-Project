import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function checkRequest(req: Request, contentType: string) {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== contentType) {
    throw new RequestError(415, `Expected ${contentType}`);
  }
  const origin = req.headers.get("origin");
  const allowed = (process.env.APP_ORIGINS || new URL(req.url).origin).split(",").map(s => s.trim());
  if (!origin || !allowed.includes(origin) || req.headers.get("sec-fetch-site") === "cross-site") {
    throw new RequestError(403, "Request must come from this application");
  }
}

// Count bytes even when Content-Length is missing or dishonest. Never call
// formData()/json() on the original unbounded incoming stream.
export async function readBounded(req: Request, limit: number): Promise<Uint8Array> {
  const declared = req.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new RequestError(413, "Request is too large");
  if (!req.body) throw new RequestError(400, "Missing request body");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new RequestError(408, "Upload timed out")); }, 15_000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) { void reader.cancel().catch(() => {}); throw new RequestError(413, "Request is too large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally { clearTimeout(timer!); reader.releaseLock(); }
}

export function logEvent(event: string, fields: Record<string, string | number | boolean> = {}) {
  // Only explicitly supplied metadata; never log inputs, exception messages,
  // cookies, provider response bodies, or uploaded filenames.
  console.info(JSON.stringify({ event, time: new Date().toISOString(), ...fields }));
}

const activeRequests = new Map<string, number>();
export async function routeResponse(route: string, run: () => Promise<NextResponse>) {
  const requestId = randomUUID();
  const start = Date.now();
  let response: NextResponse;
  let admitted = false;
  try {
    const active = activeRequests.get(route) || 0;
    const limit = route === "upload" ? 2 : 16;
    if (active >= limit) throw new RequestError(503, "Service is busy. Please try again shortly.");
    activeRequests.set(route, active + 1); admitted = true;
    response = await run();
  }
  catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    logEvent("request_error", { route, requestId, status, errorClass: error instanceof Error ? error.name : "Unknown" });
    response = NextResponse.json({ success: false, error: error instanceof RequestError ? error.message : "An unexpected server error occurred", requestId }, { status });
  }
  finally { if (admitted) activeRequests.set(route, (activeRequests.get(route) || 1) - 1); }
  response.headers.set("x-request-id", requestId);
  response.headers.set("cache-control", "no-store");
  logEvent("request_complete", { route, requestId, status: response.status, durationMs: Date.now() - start });
  return response;
}
