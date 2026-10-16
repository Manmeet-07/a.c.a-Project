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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute("href", bookmarkletHref);
    }
  }, [bookmarkletHref]);

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
      <p className="text-sm text-gray-300 mb-3">A little less typing for your next application. Drag ACA Fill-Assist to your bookmarks bar, then use it on an application page to fill your contact details. Review and submit yourself.</p>
      <details className="bookmarklet-details"><summary>What can it fill?</summary><p>Name, email, phone, address, and professional links in standard fields. Work history and custom application controls still need your attention.</p></details>
      <a
        ref={bookmarkletRef}
        href="#"
        className="bookmarklet-btn"
        onClick={(e) => e.preventDefault()}
      >
        ↗ ACA Fill-Assist
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
        Drag to your bookmarks bar, or copy the bookmarklet to create a bookmark.
      </p>
    </div>
  );
}
