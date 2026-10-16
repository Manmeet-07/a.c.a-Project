import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/pdf";
import { MAX_FILE_BYTES, MAX_FILE_LABEL, MAX_UPLOAD_BYTES, MAX_RESUME_CHARS } from "@/lib/limits";
import { checkRequest, readBounded, RequestError, routeResponse } from "@/lib/http";
import { CandidateProfile } from "@/types/profile";
import { extractSkills } from "@/lib/skills";

// pdf2json relies on Node's Buffer/stream APIs, so this route must run on
// the Node.js runtime rather than the (default-in-some-configs) Edge
// runtime -- being explicit avoids a hard-to-diagnose runtime crash.
export const runtime = "nodejs";

const SECTION_HEADER_WORDS = [
  "resume",
  "curriculum",
  "vitae",
  "objective",
  "summary",
  "contact",
  "email",
  "phone",
  "address",
  "profile",
  "education",
  "experience",
  "skills",
  "projects",
  "linkedin",
  "github",
  "portfolio",
];

function looksLikeName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/[@\d]/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every((w) => /^\p{Lu}[\p{L}\p{M}'’.-]*$/u.test(w))) return false;

  const lower = trimmed.toLowerCase();
  return !SECTION_HEADER_WORDS.some((h) => lower.includes(h));
}

function extractName(lines: string[]): string {
  // Stay within header lines. A document-wide fallback can mistake an
  // address or work-history entry for the applicant's name.
  return lines.slice(0, 8).find(looksLikeName) ?? "";
}

export async function POST(req: NextRequest) {
  return routeResponse("upload", async () => {
    checkRequest(req, "multipart/form-data");
    const bytesRead = await readBounded(req, MAX_UPLOAD_BYTES);
    let formData: FormData;
    try {
      formData = await new Response(bytesRead as BodyInit, { headers: { "content-type": req.headers.get("content-type")! } }).formData();
    } catch { throw new RequestError(400, "Invalid multipart form"); }
    const file = formData.get("resume");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return NextResponse.json(
        { success: false, error: "Only PDF resumes are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File is too large (${MAX_FILE_LABEL} max)` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json({ success: false, error: "Invalid PDF file" }, { status: 400 });
    }

    const extractedLines = await parsePdf(buffer);
    const text = extractedLines.join("\n").slice(0, MAX_RESUME_CHARS);
    const lines = extractedLines.slice(0, 30).filter(line => line.length <= 500);
    const header = lines.join("\n");

    if (!text.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No text could be extracted from this PDF. It may be a scanned image without a text layer.",
        },
        { status: 422 }
      );
    }

    const email = header.split(/\s+/).find(token => token.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(token)) || "";

    const phone =
      header.match(
        /(\+?\d{1,3})?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
      )?.[0]?.trim() || "";

    const name = extractName(lines);
    const skills = extractSkills(text);

    const urls = Array.from(
      new Set(
        Array.from(header.matchAll(/https?:\/\/[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?/gi),
          (match) => match[0].replace(/\/+$/, "")
        )
      )
    );

    const linkedin = urls.find((url) => /linkedin\.com/i.test(url));
    const github = urls.find((url) => /github\.com/i.test(url));
    const portfolio = urls.find((url) =>
      /(portfolio|behance\.net|dribbble\.com|codepen\.io|codesandbox\.io|personal-site|website)/i.test(
        url
      )
    );
    const website =
      portfolio ||
      urls.find(
        (url) => !/(linkedin\.com|github\.com|behance\.net|dribbble\.com|codepen\.io|codesandbox\.io)/i.test(url)
      );

    const locationLine = lines.find((line) =>
      /[A-Za-z ]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/.test(line)
    );

    let address = "";
    let city = "";
    let state = "";
    let postalCode = "";

    if (locationLine) {
      const locationMatch = locationLine.match(
        /([A-Za-z ]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/
      );
      if (locationMatch) {
        city = locationMatch[1].trim();
        state = locationMatch[2];
        postalCode = locationMatch[3];
      }
    }

    const addressLine = lines.find((line) =>
      /\d{1,5}\s+\w+(?:\s+\w+){0,5}\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Parkway|Pkwy|Terrace|Ter|Place|Pl)\b/i.test(
        line
      )
    );

    if (addressLine) {
      address = addressLine;
    } else if (locationLine) {
      address = locationLine;
    }

    const profile: CandidateProfile = {
      name,
      email,
      phone,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      postalCode: postalCode || undefined,
      linkedin: linkedin || undefined,
      github: github || undefined,
      portfolio: portfolio || undefined,
      website: website || undefined,
      skills,
      resumeText: text,
      fileName: file.name,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      profile,
    });
  });
}
