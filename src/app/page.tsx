"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth";
import {
  ChevronRight,
  Target,
  TrendingUp,
  Users,
  BarChart3,
  BookOpen,
  Camera,
  Flag,
  Star,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  const auth = useAuth();
  const router = useRouter();

  // Redirect already-onboarded users straight to the dashboard.
  useEffect(() => {
    if (auth.status === "authed" && auth.profile?.onboarded) {
      router.replace("/dashboard");
    }
  }, [auth.status, auth.profile?.onboarded, router]);

  return (
    <div className="landing">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="hero">
        <video
          className="hero-video"
          src="/hero.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="hero-overlay" />

        <nav className="hero-nav">
          <div className="hero-nav-brand">
            <div className="hero-logo">m</div>
            <span>myTraqr</span>
          </div>
          <div className="hero-nav-links">
            <Link href="/auth" className="hero-nav-signin">
              Sign in
            </Link>
            <Link href="/onboard" className="hero-cta-sm">
              Get started
            </Link>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-badge">Golf performance tracking, reimagined</div>
          <h1 className="hero-headline">
            Track every shot.
            <br />
            <span className="hero-accent">Know your game.</span>
          </h1>
          <p className="hero-sub">
            myTraqr gives you the data-driven edge serious golfers need — shot-by-shot
            stats, strokes gained breakdowns, and pinpoint insights on exactly where
            to improve.
          </p>
          <div className="hero-actions">
            <Link href="/onboard" className="hero-cta-primary">
              Start onboarding <ChevronRight size={18} />
            </Link>
            <Link href="/auth" className="hero-cta-ghost">
              I already have an account
            </Link>
          </div>
        </div>

        <div className="hero-scroll-hint">
          <div className="scroll-dot" />
          <span>Scroll to learn more</span>
        </div>
      </section>

      {/* ── Mission ───────────────────────────────────────────── */}
      <section className="section mission-section">
        <div className="container">
          <p className="mission-eyebrow">Our mission</p>
          <h2 className="section-title">
            Real improvement starts with
            <br />
            real data.
          </h2>
          <p className="section-desc">
            Most golfers play round after round without truly understanding why their
            scores aren't dropping. myTraqr bridges that gap — turning every shot into
            a data point, every round into a lesson, and every session into measurable
            progress.
          </p>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="section alt-section">
        <div className="container">
          <p className="section-eyebrow">How it works</p>
          <h2 className="section-title">Three steps to better golf</h2>
          <div className="steps-grid">
            <StepCard
              num="01"
              icon={<Flag size={22} />}
              title="Log your round"
              body="Enter each hole's shots with rich detail — distance, lie, club, outcome. Or scan a scorecard photo and let AI fill in the basics for you."
            />
            <StepCard
              num="02"
              icon={<BarChart3 size={22} />}
              title="See your stats"
              body="Instantly see strokes gained by category, fairways, GIR, scrambling, putts per round — all filterable by date range and course."
            />
            <StepCard
              num="03"
              icon={<Target size={22} />}
              title="Know what to practice"
              body="The insights engine surfaces your single biggest opportunity, so you never walk into a practice session without a purpose."
            />
          </div>
        </div>
      </section>

      {/* ── Player benefits ───────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="audience-grid">
            <div className="audience-copy">
              <p className="section-eyebrow">For players</p>
              <h2 className="audience-title">Your entire game, in one place.</h2>
              <p className="audience-desc">
                Whether you're a weekend warrior or a competitive amateur, myTraqr
                adapts to how deeply you want to track your game.
              </p>
              <ul className="benefit-list">
                <BenefitItem text="Shot-by-shot entry — tee shot, approach, greenside, putt" />
                <BenefitItem text="Strokes gained vs. tour benchmarks" />
                <BenefitItem text="Self-reflection notes after every round" />
                <BenefitItem text="AI scorecard image import (BYOK)" />
                <BenefitItem text="Metric or imperial — metres, yards, feet" />
                <BenefitItem text="Works offline, all data stays on your device" />
              </ul>
              <Link href="/onboard" className="cta-link">
                Get started as a player <ChevronRight size={16} />
              </Link>
            </div>
            <div className="audience-visual player-visual">
              <div className="stat-card-demo">
                <div className="demo-label">Strokes Gained · Avg per round</div>
                <div className="demo-bars">
                  <DemoBar label="Off tee" value={0.4} max={2} />
                  <DemoBar label="Approach" value={-0.8} max={2} />
                  <DemoBar label="Around green" value={0.2} max={2} />
                  <DemoBar label="Putting" value={-1.1} max={2} />
                </div>
                <div className="demo-insight">
                  Approach game is your biggest opportunity.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Coach benefits ────────────────────────────────────── */}
      <section className="section alt-section">
        <div className="container">
          <div className="audience-grid reverse">
            <div className="audience-visual coach-visual">
              <div className="coach-card-demo">
                <div className="demo-label">Coach dashboard · 3 players</div>
                <div className="player-rows">
                  <PlayerRow name="James H." score={74} trend="up" />
                  <PlayerRow name="Sofia M." score={81} trend="up" />
                  <PlayerRow name="Tom K." score={88} trend="down" />
                </div>
                <div className="pair-badge">
                  <Star size={12} />
                  Generate pairing code to add new players
                </div>
              </div>
            </div>
            <div className="audience-copy">
              <p className="section-eyebrow">For coaches</p>
              <h2 className="audience-title">See the full picture for every player.</h2>
              <p className="audience-desc">
                Connect with your players via a simple pairing code. From your coach
                dashboard, view and analyse their round history, spot patterns, and
                deliver targeted sessions.
              </p>
              <ul className="benefit-list">
                <BenefitItem text="One-tap pairing via 6-digit code" />
                <BenefitItem text="View and edit any paired player's stats" />
                <BenefitItem text="Compare progress over custom date ranges" />
                <BenefitItem text="Coach profile with credentials" />
                <BenefitItem text="Separate coach portal and player portal" />
              </ul>
              <Link href="/onboard" className="cta-link">
                Get started as a coach <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature highlights ────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <p className="section-eyebrow">Features</p>
          <h2 className="section-title center-title">
            Everything you need, nothing you don't.
          </h2>
          <div className="features-grid">
            <FeatureCard
              icon={<Camera size={20} />}
              title="Scorecard AI import"
              body="Photograph a scorecard and let your preferred AI model extract hole distances and pars automatically."
            />
            <FeatureCard
              icon={<TrendingUp size={20} />}
              title="Strokes Gained analytics"
              body="Industry-standard SG calculations across all four categories. See exactly what's costing you strokes."
            />
            <FeatureCard
              icon={<BookOpen size={20} />}
              title="Round reflections"
              body="Capture what you're proud of, what surprised you, and what to work on while it's still fresh."
            />
            <FeatureCard
              icon={<Users size={20} />}
              title="Coach & player pairing"
              body="Coaches get a live window into their players' stats. Players stay focused on playing."
            />
            <FeatureCard
              icon={<Flag size={20} />}
              title="Community course library"
              body="Add your course to the shared library so the whole community can benefit from accurate yardages."
            />
            <FeatureCard
              icon={<Target size={20} />}
              title="Insights engine"
              body="Deterministic, always-on analysis of your weakest area — no AI hallucinations, just maths."
            />
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="section final-cta-section">
        <div className="container center-content">
          <h2 className="final-cta-title">
            Start tracking. Start improving.
          </h2>
          <p className="final-cta-sub">
            Free to use. No credit card required. Your data lives on your device.
          </p>
          <div className="final-cta-actions">
            <Link href="/onboard" className="hero-cta-primary">
              I'm a player <ChevronRight size={18} />
            </Link>
            <Link href="/onboard" className="hero-cta-primary coach-cta">
              I'm a coach <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <div className="hero-logo sm">m</div>
            <span>myTraqr</span>
          </div>
          <div className="footer-links">
            <Link href="/auth">Sign in</Link>
            <Link href="/onboard">Sign up</Link>
            <Link href="/settings">Settings</Link>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} myTraqr. All rights reserved.</p>
        </div>
      </footer>

      <style jsx>{`
        /* ── Reset / base ──────────────────────────────────────── */
        .landing {
          font-family: 'Inter', system-ui, sans-serif;
          color: #0f1117;
          background: #fff;
          overflow-x: hidden;
        }

        /* ── Hero ─────────────────────────────────────────────── */
        .hero {
          position: relative;
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          background: #0a0f0a;
          overflow: hidden;
        }
        .hero-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.78;
        }
        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            160deg,
            rgba(0,0,0,0.32) 0%,
            rgba(5,20,10,0.48) 60%,
            rgba(0,0,0,0.65) 100%
          );
        }
        .hero-nav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 2.5rem;
        }
        .hero-nav-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          color: #fff;
          font-weight: 700;
          font-size: 1.05rem;
          letter-spacing: -0.01em;
        }
        .hero-logo {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: #22c55e;
          color: #fff;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 1rem;
        }
        .hero-logo.sm {
          width: 1.5rem;
          height: 1.5rem;
          font-size: 0.8rem;
        }
        .hero-nav-links {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .hero-nav-signin {
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.15s;
        }
        .hero-nav-signin:hover { color: #fff; }
        .hero-cta-sm {
          background: rgba(255,255,255,0.12);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.25);
          padding: 0.45rem 1rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 500;
          text-decoration: none;
          transition: background 0.15s;
        }
        .hero-cta-sm:hover { background: rgba(255,255,255,0.2); }

        .hero-content {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding: 4rem 2.5rem 6rem;
          max-width: 760px;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.35);
          color: #86efac;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 0.35rem 0.85rem;
          border-radius: 9999px;
          margin-bottom: 1.5rem;
        }
        .hero-headline {
          font-size: clamp(2.5rem, 6vw, 4.25rem);
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin: 0 0 1.25rem;
        }
        .hero-accent { color: #4ade80; }
        .hero-sub {
          color: rgba(255,255,255,0.72);
          font-size: clamp(1rem, 2vw, 1.175rem);
          line-height: 1.65;
          max-width: 560px;
          margin: 0 0 2.25rem;
        }
        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
        }
        .hero-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #22c55e;
          color: #fff;
          font-weight: 700;
          font-size: 0.95rem;
          padding: 0.75rem 1.65rem;
          border-radius: 9999px;
          text-decoration: none;
          transition: background 0.15s, transform 0.1s;
          box-shadow: 0 4px 20px rgba(34,197,94,0.35);
        }
        .hero-cta-primary:hover { background: #16a34a; transform: translateY(-1px); }
        .hero-cta-ghost {
          color: rgba(255,255,255,0.65);
          font-size: 0.875rem;
          text-decoration: none;
          transition: color 0.15s;
        }
        .hero-cta-ghost:hover { color: #fff; }
        .hero-scroll-hint {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: center;
          padding-bottom: 2rem;
          color: rgba(255,255,255,0.35);
          font-size: 0.75rem;
        }
        .scroll-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.35);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.9; }
        }

        /* ── Sections ─────────────────────────────────────────── */
        .section { padding: 5rem 0; }
        .alt-section { background: #f8faf8; }
        .container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 2rem;
        }
        .section-eyebrow {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #16a34a;
          margin: 0 0 0.85rem;
        }
        .section-title {
          font-size: clamp(1.75rem, 4vw, 2.75rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0a1008;
          line-height: 1.15;
          margin: 0 0 1.25rem;
        }
        .center-title { text-align: center; }
        .section-desc {
          font-size: 1.05rem;
          color: #4b5563;
          line-height: 1.7;
          max-width: 640px;
          margin: 0 auto;
          text-align: center;
        }

        /* ── Mission ──────────────────────────────────────────── */
        .mission-section { text-align: center; }
        .mission-section .section-title { margin-bottom: 1.25rem; }

        /* ── Steps ────────────────────────────────────────────── */
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 3rem;
        }
        .step-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 1rem;
          padding: 2rem;
          position: relative;
          transition: box-shadow 0.2s;
        }
        .step-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
        .step-num {
          font-size: 3rem;
          font-weight: 800;
          color: #d1fae5;
          line-height: 1;
          margin-bottom: 0.75rem;
          letter-spacing: -0.04em;
        }
        .step-icon {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.6rem;
          background: #dcfce7;
          color: #16a34a;
          display: grid;
          place-items: center;
          margin-bottom: 1rem;
        }
        .step-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #0a1008;
          margin-bottom: 0.5rem;
        }
        .step-body {
          font-size: 0.9rem;
          color: #6b7280;
          line-height: 1.65;
        }

        /* ── Audience sections ────────────────────────────────── */
        .audience-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          align-items: center;
        }
        .audience-grid.reverse { direction: rtl; }
        .audience-grid.reverse > * { direction: ltr; }
        .audience-title {
          font-size: clamp(1.5rem, 3vw, 2.25rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0a1008;
          line-height: 1.2;
          margin: 0 0 1rem;
        }
        .audience-desc {
          font-size: 0.975rem;
          color: #4b5563;
          line-height: 1.7;
          margin-bottom: 1.5rem;
        }
        .benefit-list {
          list-style: none;
          padding: 0;
          margin: 0 0 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .benefit-item {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          font-size: 0.9rem;
          color: #374151;
        }
        .benefit-icon {
          color: #22c55e;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .cta-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: #16a34a;
          font-weight: 600;
          font-size: 0.9rem;
          text-decoration: none;
          transition: gap 0.15s;
        }
        .cta-link:hover { gap: 0.55rem; }

        /* ── Demo UI cards ────────────────────────────────────── */
        .audience-visual {
          display: flex;
          justify-content: center;
        }
        .stat-card-demo, .coach-card-demo {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 1.25rem;
          padding: 1.5rem;
          width: 100%;
          max-width: 380px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.08);
        }
        .demo-label {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-bottom: 1.25rem;
        }
        .demo-bars { display: flex; flex-direction: column; gap: 0.85rem; }
        .demo-bar-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .demo-bar-label {
          font-size: 0.8rem;
          color: #6b7280;
          width: 100px;
          flex-shrink: 0;
        }
        .demo-bar-track {
          flex: 1;
          height: 6px;
          background: #f3f4f6;
          border-radius: 9999px;
          position: relative;
          overflow: hidden;
        }
        .demo-bar-fill {
          position: absolute;
          top: 0;
          height: 100%;
          border-radius: 9999px;
        }
        .demo-bar-val {
          font-size: 0.78rem;
          font-weight: 600;
          width: 36px;
          text-align: right;
        }
        .demo-insight {
          margin-top: 1.25rem;
          padding: 0.65rem 0.85rem;
          background: #fef3c7;
          color: #92400e;
          font-size: 0.8rem;
          font-weight: 500;
          border-radius: 0.5rem;
        }
        .player-rows { display: flex; flex-direction: column; gap: 0.85rem; }
        .player-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 0.75rem;
          background: #f9fafb;
          border-radius: 0.6rem;
        }
        .player-row-name { font-size: 0.875rem; font-weight: 500; color: #111827; }
        .player-row-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .player-row-score { font-size: 0.85rem; font-weight: 700; color: #374151; }
        .trend-up { color: #22c55e; font-size: 0.7rem; }
        .trend-down { color: #ef4444; font-size: 0.7rem; }
        .pair-badge {
          margin-top: 1rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: #6b7280;
          border: 1px dashed #d1d5db;
          border-radius: 0.6rem;
          padding: 0.6rem 0.75rem;
        }

        /* ── Features grid ────────────────────────────────────── */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
          gap: 1.25rem;
          margin-top: 3rem;
        }
        .feature-card {
          border: 1px solid #e5e7eb;
          border-radius: 1rem;
          padding: 1.5rem;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .feature-card:hover {
          box-shadow: 0 8px 30px rgba(0,0,0,0.07);
          border-color: #bbf7d0;
        }
        .feature-icon {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 0.5rem;
          background: #dcfce7;
          color: #16a34a;
          display: grid;
          place-items: center;
          margin-bottom: 0.85rem;
        }
        .feature-title {
          font-size: 0.975rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 0.4rem;
        }
        .feature-body { font-size: 0.875rem; color: #6b7280; line-height: 1.6; }

        /* ── Final CTA ────────────────────────────────────────── */
        .final-cta-section {
          background: #0a1008;
          color: #fff;
        }
        .center-content { text-align: center; }
        .final-cta-title {
          font-size: clamp(1.75rem, 4vw, 3rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #fff;
          margin: 0 0 1rem;
        }
        .final-cta-sub {
          color: rgba(255,255,255,0.55);
          font-size: 1rem;
          margin-bottom: 2.5rem;
        }
        .final-cta-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: center;
        }
        .coach-cta { background: #1d4ed8; box-shadow: 0 4px 20px rgba(29,78,216,0.35); }
        .coach-cta:hover { background: #1e40af; }

        /* ── Footer ───────────────────────────────────────────── */
        .landing-footer {
          background: #0a1008;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 2rem 0;
        }
        .footer-inner {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .footer-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #fff;
          font-weight: 700;
          font-size: 0.9rem;
        }
        .footer-links {
          display: flex;
          gap: 1.5rem;
        }
        .footer-links a {
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.15s;
        }
        .footer-links a:hover { color: rgba(255,255,255,0.85); }
        .footer-copy {
          color: rgba(255,255,255,0.25);
          font-size: 0.8rem;
          margin: 0;
        }

        /* ── Responsive ───────────────────────────────────────── */
        @media (max-width: 768px) {
          .hero-nav { padding: 1rem 1.25rem; }
          .hero-content { padding: 3rem 1.25rem 5rem; }
          .section { padding: 3.5rem 0; }
          .container { padding: 0 1.25rem; }
          .audience-grid, .audience-grid.reverse {
            grid-template-columns: 1fr;
            direction: ltr;
            gap: 2.5rem;
          }
          .audience-grid.reverse > * { direction: ltr; }
          .footer-inner { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function StepCard({
  num,
  icon,
  title,
  body,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="step-card">
      <div className="step-num">{num}</div>
      <div className="step-icon">{icon}</div>
      <div className="step-title">{title}</div>
      <p className="step-body">{body}</p>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="benefit-item">
      <CheckCircle2 size={15} className="benefit-icon" />
      <span>{text}</span>
    </li>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <div className="feature-title">{title}</div>
      <p className="feature-body">{body}</p>
    </div>
  );
}

function DemoBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const positive = value >= 0;
  const pct = (Math.abs(value) / max) * 50;
  const color = positive ? "#22c55e" : "#ef4444";
  return (
    <div className="demo-bar-row">
      <span className="demo-bar-label">{label}</span>
      <div className="demo-bar-track">
        <div
          className="demo-bar-fill"
          style={{
            background: color,
            width: `${pct}%`,
            left: positive ? "50%" : `${50 - pct}%`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 1,
            background: "#e5e7eb",
          }}
        />
      </div>
      <span className="demo-bar-val" style={{ color }}>
        {positive ? "+" : ""}
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function PlayerRow({
  name,
  score,
  trend,
}: {
  name: string;
  score: number;
  trend: "up" | "down";
}) {
  return (
    <div className="player-row">
      <span className="player-row-name">{name}</span>
      <div className="player-row-right">
        <span className="player-row-score">{score}</span>
        <span className={trend === "up" ? "trend-up" : "trend-down"}>
          {trend === "up" ? "▲" : "▼"}
        </span>
      </div>
    </div>
  );
}
