'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

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
      {/* ── SPLIT LAYOUT ── */}
      <div className="hero-split">

        {/* Left Side: Content */}
        <div className="hero-content fade-in-left">
          <h1 className="hero-title typewriter">SOULBOUND</h1>
          <p className="hero-subtitle">On-Chain Security Intelligence</p>

          <p className="hero-tagline">
            AI-powered smart contract auditing. Vulnerabilities detected,
            findings pinned to IPFS, and trust verified on-chain.
          </p>

          <div className="hero-ctas">
            <Link href="/scanner" className="cta-primary">Launch Scanner</Link>
            <Link href="/how-it-works" className="cta-secondary">How it works <ArrowRight size={14} /></Link>
          </div>

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

        {/* Right Side: 3D Model */}
        <div className="hero-visual fade-in">
          <div className="canvas-glow-ring" />
          <div className="canvas-container">
            <VoronoiCube />
          </div>
        </div>

      </div>
    </main>
  );
}
