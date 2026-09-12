/**
 * Optional AI-enhanced tailoring suggestions.
 *
 * The full spec calls for Gemini 1.5 Pro via Google Vertex AI. This build
 * has no Vertex/Gemini credentials available, so instead of leaving a dead
 * integration stub, this hooks up to the Anthropic API (Claude) using the
 * same system-prompt rules from the spec's "Context Prompt Strategy Block."
 * It's entirely optional: without an `ANTHROPIC_API_KEY` env var set, the
 * tailoring engine silently falls back to the rule-based suggestions in
 * `lib/ats.ts`, so the app works out of the box with zero configuration.
 *
 * To enable it, add to `.env.local`:
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

const SYSTEM_PROMPT = `You are an expert technical resume architect helping an early-career candidate tailor their resume to a specific job description.

CRITICAL RULES:
1. NEVER invent, hallucinate, or upscale job metrics, company names, titles, dates, or skills the candidate did not provide.
2. You may suggest changing descriptive action-verb highlights, technical stack phrasing, and bullet emphasis to reflect keywords found in the Job Description.
3. If a skill is missing from the candidate's profile, do NOT suggest adding it. Instead, suggest emphasizing adjacent transferable skills the candidate does have.
4. Return ONLY a JSON array of 3-6 short, concrete suggestion strings. No markdown, no prose wrapper, no keys other than the array itself.`;

interface AiSuggestionInput {
  resumeText: string;
  profileSkills: string[];
  jobDescription: string;
  matchedSkills: string[];
  missingSkills: string[];
}

export async function getAIEnhancedSuggestions(
  input: AiSuggestionInput
): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const userPrompt = `Base profile skills: ${input.profileSkills.join(", ") || "none detected"}
Matched JD keywords already on profile: ${input.matchedSkills.join(", ") || "none"}
JD keywords missing from profile: ${input.missingSkills.join(", ") || "none"}

Resume text (truncated):
${input.resumeText.slice(0, 4000)}

Job description (truncated):
${input.jobDescription.slice(0, 4000)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text: string | undefined = data?.content?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed;
    }
    return null;
  } catch {
    // Fail open: any network/parse error just falls back to the heuristic
    // suggestions rather than breaking the tailoring flow.
    return null;
  }
}
