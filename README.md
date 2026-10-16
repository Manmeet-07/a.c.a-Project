# Autonomous Career Agent (ACA) -- Phases 1-3

A resume parsing, ATS tailoring, and application-tracking tool, built as a
single Next.js app.

## Scope vs. the original spec

The full product spec (`Autonomous_Career_Agent_Specification.pdf`)
describes a much larger system: a separate Python FastAPI backend,
Postgres + pgvector, Redis/BullMQ job queues, Gemini via Vertex AI, and a
Playwright automation cluster that headlessly submits applications while
evading anti-bot detection on Greenhouse/Lever/Workday/Ashby.

This build implements the same *user-facing* value entirely inside the
Next.js app, with two deliberate deviations:

1. **No separate backend/DB/queue infrastructure.** Everything runs as
   Next.js Route Handlers, and all user data (profile, applications) is
   persisted to the browser's `localStorage` instead of Postgres. There's
   nothing to provision -- `npm ci && npm run dev` is enough.
2. **No stealth/anti-bot-evasion automation.** The spec's Phase 3 calls for
   headless browser workers that rotate IPs and spoof fingerprints to
   auto-submit applications unattended. That's built specifically to defeat
   a platform's bot defenses, which is very likely a violation of those
   platforms' terms of service -- so it isn't included. Instead, Phase 3
   here is an application tracker plus a **fill-assist bookmarklet** that
   pre-fills common fields (name/email/phone) on a job page inside your own
   browser tab, when you click it. You still review and submit yourself.

## Phases

- **Phase 1 -- Profile**: upload a PDF resume; it's parsed server-side
  (`app/api/upload/route.ts`) into name/email/phone/skills plus the full
  extracted text.
- **Phase 2 -- Tailor**: paste a job description; `app/api/tailor/route.ts`
  computes a 0-100 ATS-style match score using cosine similarity over
  term-frequency vectors (`Similarity = (A·B) / (||A|| ||B||)`, per the
  spec) blended with explicit skill-keyword coverage, then returns
  matched/missing skills and rule-based tailoring suggestions that never
  invent skills or experience you don't have.
- **Phase 3 -- Track**: a status pipeline for applications
  (discovered → tailored → applied → interviewing → offer/rejected), plus
  the fill-assist bookmarklet described above.

## Optional AI-enhanced suggestions

The tailoring engine's *score* is always the deterministic heuristic above.
Its suggestion phrasing can optionally use Anthropic after the user explicitly opts in. Paid calls require a signed visitor session, shared Redis rate/budget guards, and server-side credentials. Without all prerequisites, the app uses local suggestions.

See [DEPLOYMENT.md](DEPLOYMENT.md) for configuration, request/resource limits, account spend limits, monitoring, privacy, and the tracked dev-dependency advisory. Do not enable paid AI using an API key alone.

## Getting Started

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Known limitations

- PDF text extraction (`pdf2json`) reconstructs line layout from text
  coordinates, which works well for standard single/two-column resumes but
  can still struggle on heavily designed, multi-column, or scanned/image
  PDFs (the spec's own noted Phase 1 risk).
- The skill vocabulary in `lib/skills.ts` and the ATS scoring in
  `lib/ats.ts` are heuristics, not a trained model -- treat scores as
  directional, not authoritative.
- All data lives in `localStorage` in your browser; there's no multi-device
  sync or backend persistence. Clearing browser data clears your profile
  and tracker unless you export a backup first. The app supports JSON export/import and preserves unreadable records for recovery.
