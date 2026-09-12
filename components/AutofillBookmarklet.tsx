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
  const [bookmarkletHref, setBookmarkletHref] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const href = buildAutofillBookmarklet(profile);
    setBookmarkletHref(href);
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute("href", href);
    }
  }, [profile]);

  async function copyBookmarklet() {
    if (!bookmarkletHref) return;
    await navigator.clipboard.writeText(bookmarkletHref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  if (!profile) return null;

  return (
    <div className="bookmarklet-card">
      <h3 className="font-semibold mb-2">Fill-assist bookmarklet</h3>
      <p className="text-sm text-gray-300 mb-3">
        Drag the button below to your bookmarks bar. When you&apos;re on a
        real application page (Greenhouse, Lever, Workday, etc.), click it to
        fill in your name, email, and phone from your profile. It runs once,
        in your own signed-in browser tab -- it never submits the form or
        touches anything else on the page. Always review before you hit
        submit.
      </p>
      <p className="text-sm text-gray-400 mb-3">
        Note: this bookmarklet only fills standard contact fields like name,
        email, phone, address, LinkedIn/GitHub/website URLs, etc. It does not
        automatically fill job experience entries such as company, title, or
        location on later application steps.
      </p>
      <a
        ref={bookmarkletRef}
        href="#"
        className="bookmarklet-btn"
        onClick={(e) => e.preventDefault()}
      >
        📎 ACA Fill-Assist
      </a>
      <button
        type="button"
        className="secondary-btn ml-3"
        onClick={copyBookmarklet}
        disabled={!bookmarkletHref}
      >
        {copied ? "Copied!" : "Copy bookmarklet"}
      </button>
      <p className="text-xs text-gray-500 mt-2">
        (Clicking this link here does nothing -- it only works when dragged
        to your bookmarks bar and clicked from a job application page.)
      </p>
    </div>
  );
}
