"use client";

import { useEffect, useRef, useState } from "react";
import { CandidateProfile } from "@/types/profile";
import { buildAutofillBookmarklet } from "@/lib/bookmarklet";

export default function AutofillBookmarklet({
  profile,
}: {
  profile: CandidateProfile | null;
}) {
  const bookmarkletRef = useRef<HTMLAnchorElement | null>(null);
  const bookmarkletHref = profile ? buildAutofillBookmarklet(profile) : "";
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute("href", bookmarkletHref);
    }
  }, [bookmarkletHref]);

  async function copyBookmarklet() {
    if (!bookmarkletHref) return;
    try {
      await navigator.clipboard.writeText(bookmarkletHref);
      setCopied(true); setCopyError(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch { setCopied(false); setCopyError(true); }
  }

  if (!profile) return null;

  return (
    <section className="card">
      <div className="card-head"><h3>Fill-Assist</h3></div>
      <p className="muted">Fills your name, email, phone, address and links on job application forms. Drag the button below to your bookmarks bar, then click it on an application page. Nothing is submitted for you; review every field before you apply.</p>
      <div className="button-row">
        <a
          ref={bookmarkletRef}
          href="#"
          className="btn btn-primary bookmarklet"
          onClick={(e) => e.preventDefault()}
        >
          ACA Fill-Assist
        </a>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={copyBookmarklet}
          disabled={!bookmarkletHref}
        >
          {copied ? "Copied" : "Copy bookmarklet"}
        </button>
      </div>
      {copyError && <div className="notice notice-warning" role="alert"><p>Copy failed. Select the code below and copy it yourself.</p><textarea className="input code" aria-label="Bookmarklet code" readOnly value={bookmarkletHref} onFocus={e => e.target.select()} /></div>}
      <p className="fine-print">The bookmark contains your contact details. Copying puts them on your clipboard, and browser bookmark sync may store them in your browser account. Only use it on sites you trust. Custom form controls and work history still need your attention.</p>
    </section>
  );
}
