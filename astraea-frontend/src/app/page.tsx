'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const VoronoiCube = dynamic(() => import('@/components/VoronoiCube'), {
  ssr: false,
  loading: () => (
    <div className="cube-loader">
      <div className="cube-loader-ring" />
    </div>
  ),
});

export default function HomePage() {
  return (
    <main className="hero-page">
      {/* Ambient orbs */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />

      {/* Floating particles */}
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="particle" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>

      {/* ── CENTRAL STAGE ── */}
      <div className="hero-stage">

        {/* ASTRAEA title — sits on top the cube */}
        <div className="hero-title-wrap">
          <h1 className="hero-title typewriter">ASTRAEA</h1>
          <p className="hero-subtitle">On-Chain Security Intelligence</p>
        </div>

        {/* 3D Cube — centred */}
        <div className="hero-canvas-wrap">
          <div className="canvas-glow-ring" />
          <div className="canvas-container">
            <VoronoiCube />
          </div>
        </div>

        {/* Tagline — beneath cube */}
        <p className="hero-tagline">
          AI-powered smart contract auditing. Vulnerabilities detected,<br />
          findings pinned to IPFS, trust verified on-chain.
        </p>

        {/* CTAs */}
        <div className="hero-ctas">
          <Link href="/scanner" className="cta-primary">Launch Scanner</Link>
          <Link href="/trust-graph" className="cta-secondary">Trust Graph →</Link>
        </div>

        {/* Stats row */}
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-value">Semgrep + LLM</div>
            <div className="hero-stat-label">Analysis Engine</div>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <div className="hero-stat-value">IPFS</div>
            <div className="hero-stat-label">Immutable Reports</div>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <div className="hero-stat-value">Soulbound SBT</div>
            <div className="hero-stat-label">Verified Badges</div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="scroll-cue" aria-hidden="true">
        <div className="scroll-cue-line" />
        <span>scroll</span>
      </div>
    </main>
  );
}
