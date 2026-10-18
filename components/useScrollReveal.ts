"use client";

import { useEffect, type RefObject } from "react";

// Cards rise into place as they scroll into view (the ones already on screen
// come in at once, a beat apart). New cards, such as a match result, are
// picked up as they appear. Without JS or with reduced motion nothing hides.
export function useScrollReveal(root: RefObject<HTMLElement | null>, selector: string) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(entries => {
      entries.filter(e => e.isIntersecting).forEach((entry, i) => {
        const target = entry.target as HTMLElement;
        target.style.transitionDelay = `${Math.min(i, 5) * 70}ms`;
        target.dataset.reveal = "in";
        io.unobserve(target);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    const watch = () => el.querySelectorAll<HTMLElement>(selector).forEach(node => {
      if (node.dataset.reveal) return;
      node.dataset.reveal = "out";
      io.observe(node);
    });
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [root, selector]);
}

// Adds `is-scrolled` to the element once the page has moved, for nav styling.
export function useScrolledClass(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const update = () => el.classList.toggle("is-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [target]);
}
