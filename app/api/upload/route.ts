import { requireUser } from "@/lib/firebase-server";
import { NextRequest, NextResponse } from "next/server";
import { parseResumePdf } from "@/lib/pdf";
import { MAX_FILE_BYTES, MAX_FILE_LABEL, MAX_UPLOAD_BYTES, MAX_RESUME_CHARS } from "@/lib/limits";
import { checkRequest, readBounded, RequestError, routeResponse } from "@/lib/http";
import { CandidateProfile } from "@/types/profile";
import { extractSkills, JOB_TITLE } from "@/lib/skills";
import { extractProfileLinks } from "@/lib/profile-links";

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

const CREDENTIAL = /,?\s+(?:Ph\.?D|MBA|M\.?D|CPA|P\.?E|PMP|CFA|M\.?Sc?|B\.?Sc?|M\.?A|B\.?A|J\.?D|RN|Esq)\.?$/;
const NAME_PARTICLES = new Set(["de", "la", "del", "van", "von", "der", "den", "bin", "da", "di", "le", "du", "dos"]);

function nameFrom(line: string): string {
  let name = line.trim();
  while (CREDENTIAL.test(name)) name = name.replace(CREDENTIAL, "");
  if (!name || name.length > 40 || /[@\d]/.test(name) || JOB_TITLE.test(name)) return "";

  const words = name.split(/\s+/);
  if (words.length < 2 || words.length > 5) return "";
  if (!words.every((w, i) => /^\p{Lu}[\p{L}\p{M}'’.-]*$/u.test(w) || (i > 0 && i < words.length - 1 && NAME_PARTICLES.has(w)))) return "";

  const lower = name.toLowerCase();
  return SECTION_HEADER_WORDS.some((h) => lower.includes(h)) ? "" : name;
}

function extractName(lines: string[]): string {
  // Stay within header lines. A document-wide fallback can mistake an
  // address or work-history entry for the applicant's name.
  for (const line of lines.slice(0, 8)) {
    const name = nameFrom(line);
    if (name) return name;
  }
  return "";
}

const EMAIL = /(?<![\w.%+-])[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// Per line, so a ZIP or street number on the previous line cannot join the number.
const PHONE = /(?<![\w/-])(?:\+\d{1,3}[-. ]?|1[-. ])?(?:\(\d{3}\)|\d{3})[-. ]?\d{3}[-. ]?\d{4}(?!\d)/;
const STREET = /^\s*\d{1,6}\s+(?:[\p{L}\d][\p{L}\p{M}\d'’.-]*\s+){0,5}?(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Parkway|Pkwy|Terrace|Ter|Place|Pl|Way|Highway|Hwy)\b\.?/u;
const STATE_ZIP = /,\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)(?!\d)/;
const CITY_WORD = "(?:d['’])?\\p{Lu}[\\p{L}\\p{M}'’.]*";
const CITY = new RegExp(`${CITY_WORD}(?:(?:[ \\t]+|-)(?:(?:de|del|la|le|du|des|of|upon|on|y)(?:[ \\t]+|-))*${CITY_WORD})*(?=\\s*$)`, "u");

export async function POST(req: NextRequest) {
  return routeResponse("upload", async () => {
    checkRequest(req, "multipart/form-data");
    await requireUser(req);
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

    const { lines: extractedLines, links: embeddedLinks } = await parseResumePdf(buffer);
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

    const email = Array.from(header.matchAll(EMAIL), match => match[0]).find(value => value.length <= 254) || "";
    const phone = lines.map(line => line.match(PHONE)?.[0]).find(Boolean) || "";

    const name = extractName(lines);
    const skills = extractSkills(text);

    const { github, linkedin, portfolio, website } = extractProfileLinks(header, embeddedLinks);

    const locationLine = lines.find((line) => STATE_ZIP.test(line));

    let address = "";
    let city = "";
    let state = "";
    let postalCode = "";
    let cityStart = -1;

    if (locationLine) {
      const locationMatch = locationLine.match(STATE_ZIP)!;
      state = locationMatch[1];
      postalCode = locationMatch[2];
      const before = locationLine.slice(0, locationMatch.index);
      const segment = before.split(/[,|•·;]/).pop()!;
      const street = segment.match(STREET)?.[0] || "";
      const cityMatch = segment.slice(street.length).match(CITY);
      if (cityMatch) {
        city = cityMatch[0];
        cityStart = before.length - segment.length + street.length + cityMatch.index!;
      }
    }

    const addressLine = lines.find((line) => STREET.test(line));

    if (addressLine) {
      // Keep the street, not the city or contact details sharing its line.
      const end = addressLine === locationLine && cityStart >= 0 ? cityStart : addressLine.length;
      address = addressLine.slice(0, end).split(/\s[|•·]\s/)[0].replace(/[\s,]+$/, "").trim();
    } else if (locationLine) {
      address = [city, `${state} ${postalCode}`].filter(Boolean).join(", ");
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
