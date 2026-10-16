import { NextRequest, NextResponse } from "next/server";
import { buildTailorResult } from "@/lib/ats";
import { getAIEnhancedSuggestions } from "@/lib/ai";

import { MAX_RESUME_CHARS, MAX_JOB_CHARS } from "@/lib/limits";
import { extractSkills, SKILL_DEFINITIONS } from "@/lib/skills";
import { checkRequest, readBounded, routeResponse } from "@/lib/http";
import { sessionId, SESSION_COOKIE } from "@/lib/ai-guard";

export const runtime = "nodejs";

interface TailorRequestBody {
  useAI?: boolean;
  resumeText?: string;
  profileSkills?: string[];
  jobDescription?: string;
}

export async function POST(req: NextRequest) {
  return routeResponse("tailor", async () => {
  checkRequest(req, "application/json");
  const bytes = await readBounded(req, 700_000);
  let body: TailorRequestBody;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid body");
    body = value as TailorRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if ((body.useAI !== undefined && typeof body.useAI !== "boolean") || typeof body.resumeText !== "string" || typeof body.jobDescription !== "string" ||
      (body.profileSkills !== undefined && (!Array.isArray(body.profileSkills) ||
        body.profileSkills.length > 200 || body.profileSkills.some((s) => typeof s !== "string" || s.length > 100)))) {
    return NextResponse.json({ success: false, error: "Invalid tailoring fields" }, { status: 400 });
  }
  if (body.jobDescription.length > MAX_JOB_CHARS) {
    return NextResponse.json({ success: false, error: "Resume or job description is too long" }, { status: 413 });
  }
  const resumeText = body.resumeText.slice(0, MAX_RESUME_CHARS).trim();
  const jobDescription = (body.jobDescription ?? "").trim();
  const vocabulary = new Set(SKILL_DEFINITIONS.map(skill => skill.canonical));
  const profileSkills = [...new Set([...extractSkills(resumeText), ...(body.profileSkills || []).filter(skill => vocabulary.has(skill))])];

  if (!resumeText) {
    return NextResponse.json(
      { success: false, error: "Upload a resume before tailoring" },
      { status: 400 }
    );
  }

  if (!jobDescription || jobDescription.length < 20) {
    return NextResponse.json(
      { success: false, error: "Paste a fuller job description" },
      { status: 400 }
    );
  }

  // Compute the heuristic score/breakdown first (always available, free,
  // instant). Only escalate to the optional AI provider for suggestion
  // *phrasing* -- the score itself is never AI-generated so it stays
  // deterministic and auditable.
  const heuristicResult = buildTailorResult(
    resumeText,
    profileSkills,
    jobDescription,
    null
  );

  const id = sessionId(req.cookies.get(SESSION_COOKIE)?.value);
  const aiSuggestions = body.useAI === true && id ? await getAIEnhancedSuggestions({
    resumeText,
    profileSkills,
    jobDescription,
    matchedSkills: heuristicResult.matchedSkills,
    missingSkills: heuristicResult.missingSkills,
  }, id) : null;

  const result = aiSuggestions
    ? { ...heuristicResult, suggestions: aiSuggestions, aiEnhanced: true }
    : heuristicResult;

  return NextResponse.json({ success: true, result });
  });
}
