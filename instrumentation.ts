export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
    if (!/^claude-[a-z0-9-]+$/.test(model) || /^claude-3/.test(model)) throw new Error("ANTHROPIC_MODEL must identify a supported current Claude model");
    const { aiConfigured } = await import("./lib/ai-guard");
    const { logEvent } = await import("./lib/http");
    logEvent("ai_configuration", { enabled: aiConfigured(), model });
  }
}
