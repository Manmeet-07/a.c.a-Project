"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Scene 2: skills from a sample listing. `from` is where each one drifts in from
// on desktop; the resting layout is a plain wrapped row (also the static layout).
const KEYWORDS = [
  { label: "Python", have: true, from: [-430, -190] },
  { label: "Kubernetes", have: false, from: [-300, 200] },
  { label: "SQL", have: true, from: [390, -220] },
  { label: "Terraform", have: false, from: [-130, -270] },
  { label: "React", have: true, from: [470, 150] },
  { label: "AWS", have: true, from: [-530, 40] },
  { label: "GraphQL", have: false, from: [530, -40] },
  { label: "Docker", have: true, from: [250, 240] },
  { label: "TypeScript", have: true, from: [60, 290] },
  { label: "Spark", have: false, from: [-40, -310] },
] as const;

const STEPS = [
  { title: "Upload once.", body: "Drop in a PDF resume. ACA reads it in seconds." },
  { title: "See what you bring.", body: "Your contact details and skills, pulled out and ready. Correct anything it misses." },
  { title: "Know where you stand.", body: "Paste a job description for a match score, shared skills, what’s missing, and what to emphasize. ACA never invents skills." },
  { title: "Keep track.", body: "Save each role and follow it from first look to offer." },
];

const RING = 2 * Math.PI * 52;
const SCORE = 61;

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(min-width: 800px) and (prefers-reduced-motion: no-preference)", () => {
      const el = root.current!;
      el.classList.add("is-cinematic");

      // Smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync.
      const lenis = new Lenis({ anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      // Hero: content eases up and out as the next scene arrives.
      gsap.to(".lp-hero-content", {
        yPercent: -18, opacity: 0, ease: "none",
        scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "bottom top", scrub: true },
      });

      // Scene 2 (pinned): the listing's skills drift in, then sort themselves.
      const chips = gsap.utils.toArray<HTMLElement>(".keyword", el);
      const sort = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: { trigger: ".problem", start: "top top", end: "+=180%", pin: true, scrub: 1 },
      });
      sort.from(".problem-line", { yPercent: 110, opacity: 0, stagger: 0.15, duration: 0.6 })
        .from(chips, {
          x: (i) => KEYWORDS[i].from[0], y: (i) => KEYWORDS[i].from[1],
          opacity: 0, scale: 0.85, stagger: 0.04, duration: 1,
        }, "-=0.2")
        .from(".keyword-tint", { opacity: 0, stagger: 0.05, duration: 0.5 })
        .from(".problem-caption", { opacity: 0, y: 24, duration: 0.5 }, "-=0.2")
        .to({}, { duration: 0.4 });

      // Scene 3 (pinned): the product, one state at a time.
      const panels = gsap.utils.toArray<HTMLElement>(".demo-panel", el);
      const captions = gsap.utils.toArray<HTMLElement>(".step-caption", el);
      gsap.set([...panels.slice(1), ...captions.slice(1)], { opacity: 0 });
      gsap.set(panels.slice(1), { y: 16 });
      const score = { value: 0 };
      const scoreText = el.querySelector<HTMLElement>(".demo-score-number");
      const swap = (from: number, to: number, at: number) => {
        reveal.to(panels[from], { opacity: 0, y: -12, duration: 0.4 }, at)
          .to(panels[to], { opacity: 1, y: 0, duration: 0.5 }, at + 0.15)
          .to(captions[from], { opacity: 0, duration: 0.3 }, at)
          .to(captions[to], { opacity: 1, duration: 0.4 }, at + 0.2);
      };
      const reveal = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: { trigger: ".product", start: "top top", end: "+=260%", pin: true, scrub: 1 },
      });
      reveal.fromTo(".demo-progress span", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "none" }, 0);
      swap(0, 1, 1);
      reveal.from(".demo-profile .chip", { opacity: 0, y: 10, stagger: 0.06, duration: 0.3 }, 1.5);
      swap(1, 2, 2.4);
      reveal.fromTo(".demo-ring-value", { strokeDashoffset: RING }, { strokeDashoffset: RING * (1 - SCORE / 100), duration: 1, ease: "power1.out" }, 2.7)
        .fromTo(score, { value: 0 }, {
          value: SCORE, duration: 1, ease: "power1.out",
          onUpdate: () => { if (scoreText) scoreText.textContent = String(Math.round(score.value)); },
        }, 2.7)
        .from(".demo-match .chip", { opacity: 0, y: 10, stagger: 0.05, duration: 0.3 }, 3.1);
      swap(2, 3, 4.2);
      reveal.from(".demo-row", { opacity: 0, y: 14, duration: 0.4 }, 4.5)
        .to({}, { duration: 0.6 });

      // Calm sections: a single fade-up when they enter.
      const reveals = gsap.utils.toArray<HTMLElement>(".reveal", el);
      gsap.set(reveals, { opacity: 0, y: 28 });
      ScrollTrigger.batch(reveals, {
        start: "top 85%", once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 }),
      });

      return () => {
        gsap.ticker.remove(raf);
        lenis.destroy();
        el.classList.remove("is-cinematic");
      };
    });
  }, { scope: root });

  return (
    <div className="landing" ref={root}>
      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="ACA home">aca</Link>
        <Link href="/app" className="landing-btn landing-btn-small">Open ACA</Link>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-glow" aria-hidden="true"><span /><span /></div>
          <div className="lp-hero-content">
            <h1 id="lp-title" className="lp-title">
              <span className="line"><span>Apply with a resume</span></span>
              <span className="line"><span>that <em>fits</em>.</span></span>
            </h1>
            <p className="lp-sub">ACA reads your resume, compares it with any job description, and shows you what to highlight. It never invents skills, and you submit every application yourself.</p>
            <div className="lp-actions">
              <Link href="/app" className="landing-btn">Start with your resume</Link>
              <a href="#how" className="landing-link">See how it works</a>
            </div>
          </div>
        </section>

        <section className="problem" aria-labelledby="problem-title">
          <div className="scene">
            <h2 id="problem-title" className="scene-title">
              <span className="line"><span className="problem-line">Every job asks for</span></span>
              <span className="line"><span className="problem-line">something different.</span></span>
            </h2>
            <ul className="keywords" aria-label="Skills from a sample job listing">
              {KEYWORDS.map(k => (
                <li key={k.label} className={`keyword ${k.have ? "is-have" : "is-missing"}`}>
                  <span className="keyword-tint" aria-hidden="true" />
                  <span className="keyword-label">{k.label}</span>
                  <span className="sr-only">{k.have ? " (on your resume)" : " (missing)"}</span>
                </li>
              ))}
            </ul>
            <div className="problem-caption">
              <p>ACA sorts every listing into what’s already on your resume and what’s missing, so you know where you stand before you apply.</p>
              <p className="legend" aria-hidden="true"><span className="dot dot-have" />On your resume<span className="dot dot-missing" />Missing</p>
            </div>
          </div>
        </section>

        <section id="how" className="product" aria-labelledby="product-title">
          <div className="scene product-scene">
            <div className="product-copy">
              <h2 id="product-title" className="eyebrow">How ACA works</h2>
              <ol className="step-captions">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="step-caption">
                    <span className="step-index">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="device" aria-hidden="true">
              <div className="device-bar"><span /><span /><span /><em>aca / example resume</em></div>
              <div className="device-screen">
                <div className="demo-panel demo-upload">
                  <span className="demo-icon">↑</span>
                  <strong>Reading maya-chen-resume.pdf</strong>
                  <div className="demo-progress"><span /></div>
                </div>
                <div className="demo-panel demo-profile">
                  <div className="demo-person"><span className="avatar">MC</span><div><strong>Maya Chen</strong><small>maya@example.test · 202-555-0142</small></div></div>
                  <p className="demo-label">Skills found</p>
                  <div className="chips">{["AWS", "Docker", "Python", "React", "SQL", "TypeScript"].map(s => <span key={s} className="chip">{s}</span>)}</div>
                </div>
                <div className="demo-panel demo-match is-final">
                  <div className="demo-score">
                    <div className="score-ring">
                      <svg viewBox="0 0 120 120"><circle className="score-track" cx="60" cy="60" r="52" /><circle className="score-value demo-ring-value" cx="60" cy="60" r="52" strokeDasharray={RING} strokeDashoffset={RING * (1 - SCORE / 100)} /></svg>
                      <span className="score-number demo-score-number">{SCORE}</span>
                    </div>
                    <div><strong>Moderate match</strong><small>4 of 5 listed skills are on the resume.</small></div>
                  </div>
                  <div className="chips">
                    {["AWS", "Docker", "Python", "SQL"].map(s => <span key={s} className="chip chip-match">✓ {s}</span>)}
                    <span className="chip chip-missing">Kubernetes</span>
                  </div>
                  <p className="demo-tip">Highlight your Docker experience as related groundwork for Kubernetes. Don’t claim it.</p>
                </div>
                <div className="demo-panel demo-tracker">
                  <p className="demo-label">Applications</p>
                  <div className="demo-row"><div><strong>Junior Data Engineer</strong><small>Example Company</small></div><span className="pill pill-accent">61% match</span><span className="demo-status">Tailored</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="trust" aria-labelledby="trust-title">
          <h2 id="trust-title" className="section-title reveal">Built to be honest.</h2>
          <ul className="trust-grid">
            <li className="reveal"><h3>Stays in your browser</h3><p>Your profile and applications are saved on your device. Export a backup any time.</p></li>
            <li className="reveal"><h3>Never invents experience</h3><p>Suggestions only lean on skills that are already on your resume.</p></li>
            <li className="reveal"><h3>You stay in control</h3><p>Fill-Assist fills your contact details on application forms; you review and submit. AI suggestions are optional and off by default.</p></li>
          </ul>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <h2 id="lp-cta-title" className="lp-cta-title">Your next application<br />starts here.</h2>
          <p className="lp-cta-sub">No account needed. Your data stays on this device.</p>
          <Link href="/app" className="landing-btn">Open ACA</Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span>ACA · Autonomous Career Agent</span>
        <Link href="/app" className="landing-link">Open the app</Link>
      </footer>
    </div>
  );
}
