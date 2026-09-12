import { NextRequest, NextResponse } from "next/server";
import { buildTailorResult } from "@/lib/ats";
import { getAIEnhancedSuggestions } from "@/lib/ai";

export const runtime = "nodejs";

interface TailorRequestBody {
  resumeText?: string;
  profileSkills?: string[];
  jobDescription?: string;
}

export async function POST(req: NextRequest) {
  let body: TailorRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const resumeText = (body.resumeText ?? "").trim();
  const jobDescription = (body.jobDescription ?? "").trim();
  const profileSkills = Array.isArray(body.profileSkills)
    ? body.profileSkills
    : [];

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

  const aiSuggestions = await getAIEnhancedSuggestions({
    resumeText,
    profileSkills,
    jobDescription,
    matchedSkills: heuristicResult.matchedSkills,
    missingSkills: heuristicResult.missingSkills,
  });

  const result = aiSuggestions
    ? { ...heuristicResult, suggestions: aiSuggestions, aiEnhanced: true }
    : heuristicResult;

  return NextResponse.json({ success: true, result });
}
