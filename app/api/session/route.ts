import { NextRequest, NextResponse } from "next/server";
import { checkRequest, routeResponse } from "@/lib/http";
import { newSession, sessionId, SESSION_COOKIE } from "@/lib/ai-guard";

export async function POST(req: NextRequest) {
  return routeResponse("session", async () => {
    checkRequest(req, "application/json");
    const existing = req.cookies.get(SESSION_COOKIE)?.value;
    const token = sessionId(existing) ? existing : newSession();
    const response = NextResponse.json({ aiAvailable: Boolean(token) });
    if (token) response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "strict", path: "/api", maxAge: 3600 });
    return response;
  });
}
