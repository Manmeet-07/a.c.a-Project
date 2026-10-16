import { NextResponse } from "next/server";
import { routeResponse } from "@/lib/http";
export async function GET() {
  return routeResponse("health", async () => NextResponse.json({ status: "ok" }));
}
