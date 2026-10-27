"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import Logo from "../Logo";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

// Skills from a sample listing. `from` is where each one drifts in from on
// desktop; the resting layout is a plain wrapped row (also the static layout).
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
const PROFILE_SKILLS = ["AWS", "Docker", "Python", "React", "SQL", "TypeScript"];

const STEPS = [
  { title: "Upload once.", body: "Drop in a PDF resume. ACA reads it in seconds." },
  { title: "See what you bring.", body: "The skills a job asks for that are already on your resume, pulled out and ready." },
  { title: "Know where you stand.", body: "Paste a job description for a match score, what’s missing, and what to emphasize. ACA never invents skills." },
  { title: "Keep track.", body: "Save each role and follow it from first look to offer." },
];

const RING = 2 * Math.PI * 52;
const SCORE = 61;

// Real figures only: Fill-Assist's 13 contact fields are what the browser test
// checks; 4 MB is the upload limit (lib/limits.ts).
const FACTS = [
  { value: 13, from: 0, unit: "", label: "contact fields Fill-Assist fills on an application form" },
  { value: 0, from: 12, unit: "", label: "skills ACA will ever invent for you" },
  { value: 4, from: 0, unit: "MB", label: "PDF resumes, read on upload" },
];

// Layout offset of `el` inside `root`. offsetLeft/Top ignore transforms, so this
// is the element's resting position even while it is mid-animation.
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0, y = 0, node: HTMLElement | null = el;
  while (node && node !== root) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
  return { x, y };
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const wipeTl = useRef<gsap.core.Timeline | null>(null);
  // Leaving mid-wipe (Back, another link) must not still push to /login.
  useEffect(() => () => { wipeTl.current?.revert(); }, []);

  // Into the app: an ink circle spreads from the click and the sign-in page
  // (same ink background) takes over underneath it.
  const openApp = (e: MouseEvent<HTMLAnchorElement>) => {
    const wipe = root.current?.querySelector<HTMLElement>(".lp-wipe");
    if (!wipe || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    const at = `${e.clientX}px ${e.clientY}px`;
    const radius = Math.hypot(Math.max(e.clientX, innerWidth - e.clientX), Math.max(e.clientY, innerHeight - e.clientY));
    wipeTl.current?.revert();
    wipeTl.current = gsap.timeline({ onComplete: () => { if (location.pathname === "/") router.push("/login"); } })
      .set(wipe, { visibility: "visible", clipPath: `circle(0px at ${at})` })
      .to(wipe, { clipPath: `circle(${radius}px at ${at})`, duration: 0.75, ease: "power3.inOut" })
      .from(wipe.querySelector(".lp-wipe-ring"), { scale: 0.4, opacity: 0, duration: 0.6, ease: "power3.out" }, 0.25);
  };

  useGSAP(() => {
    const mm = gsap.matchMedia();

    // Every scene is "screen" only: printing reverts to the static resting layout.
    mm.add("screen and (min-width: 800px) and (prefers-reduced-motion: no-preference)", () => {
      const el = root.current!;
      const cleanups: (() => void)[] = [];
      el.classList.add("is-cinematic");
      const q = <T extends Element = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel, el);

      // Smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync.
      const lenis = new Lenis({ anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      // Hero, before scrolling: a soft light follows the cursor and the window
      // leans toward it (a gentle catch-up, never 1:1).
      if (window.matchMedia("(pointer: fine)").matches) {
        const spotX = gsap.quickTo(".lp-spot", "x", { duration: 0.8, ease: "power3" });
        const spotY = gsap.quickTo(".lp-spot", "y", { duration: 0.8, ease: "power3" });
        const tiltX = gsap.quickTo(".hero-tilt", "rotationX", { duration: 1, ease: "power3" });
        const tiltY = gsap.quickTo(".hero-tilt", "rotationY", { duration: 1, ease: "power3" });
        const hero = el.querySelector<HTMLElement>(".lp-hero")!;
        const onMove = (e: PointerEvent) => {
          const r = hero.getBoundingClientRect();
          spotX(e.clientX - r.left); spotY(e.clientY - r.top);
          tiltY(((e.clientX - r.left) / r.width - 0.5) * 8);
          tiltX(-((e.clientY - r.top) / r.height - 0.5) * 5);
        };
        hero.addEventListener("pointermove", onMove);
        gsap.set(".lp-spot", { opacity: 1 });
        cleanups.push(() => hero.removeEventListener("pointermove", onMove));
      }

      // Push-in: the hero pins, the headline lifts away and the window turns
      // flat, rises to the middle and grows until we pass through it. Its
      // match score fills on the way.
      const shot = el.querySelector<HTMLElement>(".hero-shot")!;
      const heroScore = { value: 0 };
      const heroScoreText = el.querySelector<HTMLElement>(".hero-score-number");
      gsap.set(".hero-ring-value", { strokeDashoffset: RING });
      if (heroScoreText) heroScoreText.textContent = "0";
      gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "+=130%", pin: true, scrub: 1, invalidateOnRefresh: true },
      })
        .to(".lp-hero-content", { y: -140, opacity: 0, scale: 0.96, duration: 0.45, ease: "power2.in" }, 0)
        .to(".lp-glow", { opacity: 0.35, duration: 0.6 }, 0)
        .to(shot, { y: () => innerHeight / 2 - (shot.offsetTop + shot.offsetHeight / 2), duration: 0.6 }, 0.05)
        .fromTo(".hero-window", { rotateX: 26 }, { rotateX: 0, duration: 0.6 }, 0.05)
        .to(".hero-ring-value", { strokeDashoffset: RING * (1 - SCORE / 100), duration: 0.45, ease: "power1.out" }, 0.25)
        .to(heroScore, { value: SCORE, duration: 0.45, ease: "power1.out", onUpdate: () => { if (heroScoreText) heroScoreText.textContent = String(Math.round(heroScore.value)); } }, 0.25)
        .to(shot, { scale: 1.9, duration: 0.45, ease: "power2.in" }, 0.72)
        .to(shot, { opacity: 0, duration: 0.25, ease: "none" }, 0.92);

      gsap.from(".story-line", {
        yPercent: 110, stagger: 0.12, ease: "power3.out",
        scrollTrigger: { trigger: ".story", start: "top 85%", end: "top 15%", scrub: 1 },
      });

      const stage = el.querySelector<HTMLElement>(".story-stage")!;
      const chips = q(".keyword");
      const have = chips.filter(c => c.dataset.have === "true");
      const missing = chips.filter(c => c.dataset.have !== "true");
      const targets = have.map(c => el.querySelector<HTMLElement>(`.demo-profile .chip[data-skill="${c.dataset.skill}"]`)!);
      const panels = q(".demo-panel");
      const captions = q(".step-caption");
      const capLines = captions.map(c => c.querySelectorAll(".line > span"));
      const score = { value: 0 };
      const scoreText = el.querySelector<HTMLElement>(".demo-score-number");

      gsap.set(".story-product", { autoAlpha: 0 });
      gsap.set(panels.slice(1), { autoAlpha: 0 });
      gsap.set(targets, { opacity: 0 });
      gsap.set(".demo-result", { opacity: 0 });
      gsap.set(".demo-cursor", { opacity: 0, x: 170, y: 120 });
      gsap.set(have, { transformOrigin: "0 0" });
      captions.forEach((_, i) => gsap.set(capLines[i], { yPercent: 105 }));
      gsap.set(".step-caption .step-index", { opacity: 0 });

      const captionIn = (i: number, at: number) => tl
        .to(capLines[i], { yPercent: 0, stagger: 0.06, duration: 0.5, ease: "power3.out" }, at)
        .to(captions[i].querySelector(".step-index"), { opacity: 1, duration: 0.3 }, at);
      const captionOut = (i: number, at: number) => tl
        .to(capLines[i], { yPercent: -105, stagger: 0.04, duration: 0.35, ease: "power2.in" }, at)
        .to(captions[i].querySelector(".step-index"), { opacity: 0, duration: 0.2 }, at);
      const swap = (from: number, to: number, at: number) => tl
        .to(panels[from], { autoAlpha: 0, y: -10, duration: 0.35 }, at)
        .fromTo(panels[to], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45 }, at + 0.15);

      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: { trigger: ".story", start: "top top", end: "+=560%", pin: true, scrub: 1, invalidateOnRefresh: true },
      });

      // Act 1: a listing's skills drift in and sort into have / missing.
      tl.from(chips, {
        x: (i) => KEYWORDS[i].from[0], y: (i) => KEYWORDS[i].from[1],
        opacity: 0, scale: 0.85, stagger: 0.04, duration: 1,
      }, 0)
        .from(".keyword-tint", { opacity: 0, stagger: 0.05, duration: 0.5 }, 1.1)
        .from(".problem-caption", { opacity: 0, y: 24, duration: 0.4 }, 1.5);

      // Act 2: the headline and missing skills step aside; the app window rises
      // in from below, tilted, and settles flat.
      tl.to([".story-problem .scene-title", ".problem-caption"], { opacity: 0, y: -40, duration: 0.4, ease: "power2.in" }, 2.4)
        .to(missing, { opacity: 0, scale: 0.9, duration: 0.5, stagger: 0.03 }, 2.4)
        // the matched skills lift clear of the captions and wait above the window
        .to(have, { y: (i) => -170 - (i % 2) * 14, scale: 0.9, duration: 0.7, stagger: 0.03, ease: "power2.inOut" }, 2.4)
        .set(".story-product", { autoAlpha: 1 }, 2.5)
        .fromTo(".device-wrap", { yPercent: 70, rotateX: 24, scale: 0.86 }, { yPercent: 0, rotateX: 0, scale: 1, duration: 1.2, ease: "power3.out" }, 2.5)
        .fromTo(".device-glow", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1.2 }, 2.5)
        .fromTo(".device-sheen", { xPercent: -120 }, { xPercent: 120, duration: 1.3, ease: "none" }, 2.9);
      captionIn(0, 3.0);
      tl.fromTo(".demo-progress span", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "none" }, 3.0);

      // Act 3: the matched skills fly out of the listing and land in the
      // window's "Skills found" list, becoming the real chips.
      swap(0, 1, 3.7);
      captionOut(0, 3.7); captionIn(1, 3.95);
      tl.to(have, {
        x: (i) => offsetIn(targets[i], stage).x - offsetIn(have[i], stage).x,
        y: (i) => offsetIn(targets[i], stage).y - offsetIn(have[i], stage).y,
        scale: (i) => targets[i].offsetWidth / have[i].offsetWidth,
        duration: 1, stagger: 0.06, ease: "power3.inOut",
      }, 3.9);
      have.forEach((chip, i) => {
        const land = 3.9 + i * 0.06 + 0.92;
        tl.to(chip, { opacity: 0, duration: 0.12 }, land).to(targets[i], { opacity: 1, duration: 0.12 }, land);
      });

      // Act 4: a cursor runs the match; the score fills.
      swap(1, 2, 5.6);
      captionOut(1, 5.6); captionIn(2, 5.85);
      tl.to(".demo-cursor", { opacity: 1, duration: 0.2 }, 5.9)
        .to(".demo-cursor", { x: 0, y: 0, duration: 0.7, ease: "power2.inOut" }, 5.9)
        .to(".demo-analyze", { scale: 0.95, duration: 0.08, yoyo: true, repeat: 1 }, 6.62)
        .to(".demo-cursor", { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1 }, 6.62)
        .to(".demo-result", { opacity: 1, duration: 0.3 }, 6.8)
        .fromTo(".demo-ring-value", { strokeDashoffset: RING }, { strokeDashoffset: RING * (1 - SCORE / 100), duration: 1, ease: "power1.out" }, 6.85)
        .fromTo(score, { value: 0 }, {
          value: SCORE, duration: 1, ease: "power1.out",
          onUpdate: () => { if (scoreText) scoreText.textContent = String(Math.round(score.value)); },
        }, 6.85)
        .from(".demo-result .chip", { opacity: 0, y: 8, stagger: 0.05, duration: 0.3 }, 7.1)
        .to(".demo-cursor", { opacity: 0, duration: 0.3 }, 7.3);

      // Act 5: saved to the tracker.
      swap(2, 3, 8.2);
      captionOut(2, 8.2); captionIn(3, 8.45);
      tl.from(".demo-row", { opacity: 0, y: 14, duration: 0.4 }, 8.5)
        .to({}, { duration: 0.7 });

      return () => {
        cleanups.forEach(fn => fn());
        gsap.ticker.remove(raf);
        lenis.destroy();
        el.classList.remove("is-cinematic");
      };
    });

    // Phones: no pinning, just a light reveal as each block scrolls into view.
    mm.add("screen and (max-width: 799px) and (prefers-reduced-motion: no-preference)", () => {
      const reveal = (targets: gsap.TweenTarget, trigger: string, vars: gsap.TweenVars = {}) =>
        gsap.from(targets, { opacity: 0, y: 24, duration: 0.8, ease: "power3.out", stagger: 0.06, ...vars, scrollTrigger: { trigger, start: "top 85%", once: true } });
      gsap.utils.toArray<HTMLElement>(".line > .story-line", root.current).forEach(line =>
        gsap.from(line, { yPercent: 105, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: line, start: "top 90%", once: true } }));
      reveal(".keyword", ".keywords", { y: 12, scale: 0.94, stagger: 0.04 });
      reveal(".problem-caption", ".problem-caption");
      reveal(".step-caption", ".step-captions", { stagger: 0.1 });
      reveal(".hero-window", ".hero-shot", { y: 40, scale: 0.96, duration: 1 });
      reveal(".device", ".device-wrap", { y: 48, scale: 0.96, duration: 1 });
      reveal([".lp-cta-sub", ".lp-cta .landing-btn"], ".lp-cta", { stagger: 0.1 });
    });

    // Every screen size: the closing scenes.
    mm.add("screen and (prefers-reduced-motion: no-preference)", () => {
      const el = root.current!;
      // Proof: each number counts to its real value once (0 counts down).
      gsap.utils.toArray<HTMLElement>(".fact", el).forEach((fact, i) => {
        const num = fact.querySelector<HTMLElement>(".fact-number")!;
        const counter = { value: Number(num.dataset.from) };
        num.textContent = String(counter.value);
        gsap.timeline({ scrollTrigger: { trigger: ".lp-facts", start: "top 78%", once: true }, delay: i * 0.12 })
          .from(fact, { opacity: 0, y: 40, duration: 0.9, ease: "power3.out" }, 0)
          .to(counter, { value: Number(num.dataset.to), duration: 1.6, ease: "power2.out", onUpdate: () => { num.textContent = String(Math.round(counter.value)); } }, 0.1);
      });

      // Statements light up word by word as you scroll through them.
      gsap.utils.toArray<HTMLElement>(".statement", el).forEach(statement => {
        const split = SplitText.create(statement.querySelector(".statement-text"), { type: "words", wordsClass: "word" });
        gsap.fromTo(split.words, { opacity: 0.14 }, {
          opacity: 1, stagger: 0.1, ease: "none",
          scrollTrigger: { trigger: statement, start: "top 78%", end: "bottom 50%", scrub: true },
        });
        gsap.from(statement.querySelector(".statement-note"), { opacity: 0, y: 16, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: statement, start: "bottom 70%", once: true } });
      });

      // Closing: the mark draws itself, then the headline rises in.
      const cta = gsap.timeline({ scrollTrigger: { trigger: ".lp-cta", start: "top 70%", once: true } });
      cta.from(".lp-cta-mark circle:nth-of-type(2)", { strokeDashoffset: 2 * Math.PI * 11, duration: 1.2, ease: "power3.inOut" })
        .from(".lp-cta-mark circle:nth-of-type(3)", { scale: 0, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(2.5)" }, 0.8);
      SplitText.create(".lp-cta-title", {
        type: "lines", mask: "lines", autoSplit: true,
        onSplit: self => gsap.from(self.lines, { yPercent: 110, stagger: 0.09, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: ".lp-cta", start: "top 60%", once: true } }),
      });
    });
  }, { scope: root });

  return (
    <div className="landing" ref={root}>
      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="ACA home"><Logo size={24} accent="#22d3ee" gap="#fb923c" track="#ffffff" />aca</Link>
        <Link href="/login" className="landing-btn landing-btn-small" onClick={openApp}>Open ACA</Link>
      </header>
      <div className="lp-wipe" aria-hidden="true"><span className="lp-wipe-ring"><Logo size={56} accent="#22d3ee" gap="#fb923c" track="#ffffff" /></span></div>

      <main>
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-glow" aria-hidden="true"><span /><span /></div>
          <div className="lp-spot" aria-hidden="true" />
          <div className="lp-hero-content">
            <h1 id="lp-title" className="lp-title">
              <span className="line"><span>Apply with a resume</span></span>
              <span className="line"><span>that <em className="accent">fits.</em></span></span>
            </h1>
            <p className="lp-sub">ACA reads your resume, compares it with any job description, and shows you what to highlight. It never invents skills, and you submit every application yourself.</p>
            <div className="lp-actions">
              <Link href="/login" className="landing-btn" onClick={openApp}>Start with your resume</Link>
              <a href="#how" className="landing-link">See how it works</a>
            </div>
          </div>
          <div className="hero-shot" aria-hidden="true">
            <div className="hero-tilt">
              <div className="hero-window">
                <div className="device-bar"><span /><span /><span /><em>aca / match</em></div>
                <div className="hero-screen">
                  <div className="hero-score">
                    <div className="score-ring">
                      <svg viewBox="0 0 120 120"><circle className="score-track" cx="60" cy="60" r="52" /><circle className="score-value hero-ring-value" cx="60" cy="60" r="52" strokeDasharray={RING} strokeDashoffset={RING * (1 - SCORE / 100)} /></svg>
                      <span className="score-number hero-score-number">{SCORE}</span>
                    </div>
                    <div><strong>Junior Data Engineer</strong><small>Example Company · moderate match</small></div>
                  </div>
                  <div className="chips">
                    {["AWS", "Docker", "Python", "SQL"].map(s => <span key={s} className="chip chip-match">✓ {s}</span>)}
                    <span className="chip chip-missing">Kubernetes</span>
                  </div>
                  <p className="demo-tip">Highlight your Docker experience as related groundwork for Kubernetes. Don’t claim it.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="story" aria-labelledby="story-title">
          <div className="story-stage">
            <div className="story-problem">
              <h2 id="story-title" className="scene-title">
                <span className="line"><span className="story-line">Every job asks for</span></span>
                <span className="line"><span className="story-line">something different.</span></span>
              </h2>
              <ul className="keywords" aria-label="Skills from a sample job listing">
                {KEYWORDS.map(k => (
                  <li key={k.label} className={`keyword ${k.have ? "is-have" : "is-missing"}`} data-have={k.have} data-skill={k.label}>
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

            <div className="story-product">
              <div className="product-copy">
                <p className="kicker">How ACA works</p>
                <ol className="step-captions">
                  {STEPS.map((s, i) => (
                    <li key={s.title} className="step-caption">
                      <span className="step-index">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="line"><span>{s.title}</span></h3>
                      <p className="line"><span>{s.body}</span></p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="device-wrap" aria-hidden="true">
                <div className="device-glow" />
                <div className="device">
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
                      <div className="chips">{PROFILE_SKILLS.map(s => <span key={s} className="chip" data-skill={s}>{s}</span>)}</div>
                    </div>
                    <div className="demo-panel demo-match is-final">
                      <div className="demo-job">
                        <div><strong>Junior Data Engineer</strong><small>Example Company · job description pasted</small></div>
                        <span className="demo-analyze">Analyze match
                          <svg className="demo-cursor" viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 7.5-6.2 1.6L9.6 18z" fill="#1d1d1f" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                        </span>
                      </div>
                      <div className="demo-result">
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
                    </div>
                    <div className="demo-panel demo-tracker">
                      <p className="demo-label">Applications</p>
                      <div className="demo-row"><div><strong>Junior Data Engineer</strong><small>Example Company</small></div><span className="pill pill-accent">61% match</span><span className="demo-status">Tailored</span></div>
                    </div>
                  </div>
                  <div className="device-sheen" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-facts" aria-labelledby="facts-title">
          <h2 id="facts-title" className="sr-only">ACA in numbers</h2>
          {FACTS.map(f => (
            <div key={f.label} className="fact">
              <p className="fact-value"><span className="fact-number" data-to={f.value} data-from={f.from}>{f.value}</span>{f.unit && <span className="fact-unit">{f.unit}</span>}</p>
              <p className="fact-label">{f.label}</p>
            </div>
          ))}
        </section>

        <section className="statements" aria-labelledby="trust-title">
          <h2 id="trust-title" className="sr-only">Built to be honest</h2>
          <div className="statement">
            <p className="statement-text">Your resume stays in your account, private to you.</p>
            <p className="statement-note">Your profile and applications sync securely to your private account. Export a backup any time.</p>
          </div>
          <div className="statement">
            <p className="statement-text">You stay in control. You review, you <em className="accent">submit.</em></p>
            <p className="statement-note">Fill-Assist fills your contact details on application forms; you review and submit. AI suggestions are optional and off by default.</p>
          </div>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <span className="lp-cta-mark" aria-hidden="true"><Logo size={72} accent="#22d3ee" gap="#fb923c" track="#ffffff" /></span>
          <h2 id="lp-cta-title" className="lp-cta-title">Your next application<br />starts <em className="accent">here.</em></h2>
          <p className="lp-cta-sub">Your own workspace. Ready on every device.</p>
          <Link href="/login" className="landing-btn" onClick={openApp}>Open ACA</Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span className="footer-brand"><Logo size={18} accent="#22d3ee" gap="#fb923c" track="#ffffff" />ACA · Autonomous Career Agent</span>
        <Link href="/login" className="landing-link" onClick={openApp}>Open the app</Link>
      </footer>
    </div>
  );
}
