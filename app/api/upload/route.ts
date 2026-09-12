import { NextRequest, NextResponse } from "next/server";
import PDFParser from "pdf2json";
import { CandidateProfile } from "@/types/profile";
import { extractSkills } from "@/lib/skills";

// pdf2json relies on Node's Buffer/stream APIs, so this route must run on
// the Node.js runtime rather than the (default-in-some-configs) Edge
// runtime -- being explicit avoids a hard-to-diagnose runtime crash.
export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
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

interface PdfTextRun {
  T: string;
}
interface PdfTextObject {
  x: number;
  y: number;
  R: PdfTextRun[];
}
interface PdfPage {
  Texts: PdfTextObject[];
}
interface PdfData {
  Pages: PdfPage[];
}

function decodeRun(run: PdfTextRun): string {
  try {
    return decodeURIComponent(run.T);
  } catch {
    return run.T;
  }
}

/**
 * pdf2json returns text as a flat list of positioned runs per page, not
 * lines. The original implementation concatenated every run on a page into
 * one long string with no line breaks, which destroyed layout structure and
 * made line-sensitive heuristics (like "the name is usually its own line
 * near the top") unusable. This reconstructs line structure by grouping
 * runs that share a y-coordinate and sorting them left-to-right.
 */
function extractLines(pdfData: PdfData): string[] {
  const lines: string[] = [];

  for (const page of pdfData.Pages ?? []) {
    const rows = new Map<number, { x: number; text: string }[]>();

    for (const textObj of page.Texts ?? []) {
      const y = Math.round(textObj.y * 10) / 10;
      const text = textObj.R.map(decodeRun).join("");
      const row = rows.get(y) ?? [];
      row.push({ x: textObj.x, text });
      rows.set(y, row);
    }

    const sortedYs = Array.from(rows.keys()).sort((a, b) => a - b);
    for (const y of sortedYs) {
      const line = rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
  }

  return lines;
}

function looksLikeName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/[@\d]/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w))) return false;

  const lower = trimmed.toLowerCase();
  return !SECTION_HEADER_WORDS.some((h) => lower.includes(h));
}

function extractName(lines: string[], fullText: string): string {
  const nearTop = lines.slice(0, 8).find(looksLikeName);
  if (nearTop) return nearTop;

  // Fall back to the original best-effort regex if nothing near the top
  // matches (e.g. an unusual layout the y-grouping didn't reconstruct well).
  return fullText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/)?.[0] ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
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
        { success: false, error: "File is too large (10MB max)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const pdfData = await new Promise<PdfData>((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      pdfParser.on("pdfParser_dataReady", (data: PdfData) => {
        resolve(data);
      });

      pdfParser.parseBuffer(buffer);
    });

    const lines = extractLines(pdfData);
    const text = lines.join("\n");

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

    const email =
      text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] || "";

    const phone =
      text.match(
        /(\+?\d{1,3})?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
      )?.[0] || "";

    const name = extractName(lines, text);
    const skills = extractSkills(text);

    const urls = Array.from(
      new Set(
        Array.from(text.matchAll(/https?:\/\/[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?/gi),
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
  } catch (error) {
    console.error("PDF Parse Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to parse PDF",
      },
      { status: 500 }
    );
  }
}
