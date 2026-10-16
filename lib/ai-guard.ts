import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { logEvent } from "./http";

export const SESSION_COOKIE = "aca-session";
const TTL = 3600;
// Accept the names Vercel's Upstash integration creates (current and legacy KV).
function redisUrl() { return process.env.REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL; }
function redisToken() { return process.env.REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN; }
export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY && (process.env.SESSION_SECRET?.length ?? 0) >= 32 &&
    redisUrl()?.startsWith("https://") && redisToken());
}
function sign(value: string) { return createHmac("sha256", process.env.SESSION_SECRET!).update(value).digest("hex"); }
export function newSession() {
  if (!aiConfigured()) return null;
  const payload = `${randomUUID()}.${Math.floor(Date.now() / 1000) + TTL}`;
  return `${payload}.${sign(payload)}`;
}
export function sessionId(token?: string) {
  if (!aiConfigured() || !token || token.length > 200) return null;
  const [id, expiry, signature, extra] = token.split(".");
  if (extra || !id || !/^\d+$/.test(expiry ?? "") || !/^[a-f0-9]{64}$/.test(signature ?? "")) return null;
  const seconds = Number(expiry) - Math.floor(Date.now() / 1000);
  if (seconds <= 0 || seconds > TTL) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${id}.${expiry}`))) ? id : null;
}
export async function redis(command: (string | number)[]): Promise<unknown> {
  const response = await fetch(redisUrl()!, {
    method: "POST", headers: { authorization: `Bearer ${redisToken()}`, "content-type": "application/json" },
    body: JSON.stringify(command), signal: AbortSignal.timeout(3000), cache: "no-store",
  });
  if (!response.ok) throw new Error("SharedStoreUnavailable");
  const data = await response.json();
  if (data.error) throw new Error("SharedStoreError");
  return data.result;
}
// Atomic reservation before the provider call. Failed calls consume budget too.
const RESERVE = `
local user = tonumber(redis.call('GET', KEYS[1]) or '0')
local daily = tonumber(redis.call('GET', KEYS[2]) or '0')
if user >= tonumber(ARGV[1]) or daily + 3 > tonumber(ARGV[2]) then return 0 end
redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 3600)
redis.call('INCRBY', KEYS[2], 3); redis.call('EXPIRE', KEYS[2], 172800)
return 1`;
export async function reserveCall(id: string) {
  const configured = Number(process.env.AI_DAILY_CALL_LIMIT || "100");
  const daily = Number.isSafeInteger(configured) && configured >= 0 ? configured : 0;
  try {
    return await redis(["EVAL", RESERVE, 2, `aca:ai:user:${id}`, `aca:ai:day:${new Date().toISOString().slice(0, 10)}`, 10, daily]) === 1;
  } catch { logEvent("ai_fallback", { reason: "shared_store_unavailable" }); return false; }
}
