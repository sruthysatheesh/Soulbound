import Link from 'next/link';
import { ArrowLeft, Shield, FileText, BadgeCheck, Code } from 'lucide-react';

export default function HowItWorksPage() {
    return (
        <main className="page">
            <div style={{ marginBottom: '3rem' }}>
                <Link href="/" className="btn-ghost" style={{ padding: '0.4rem 0.8rem', marginBottom: '1.5rem', display: 'inline-flex' }}>
                    <ArrowLeft size={16} /> Back
                </Link>
                <h1 className="section-title">How SOULBOUND Works</h1>
                <p className="section-sub" style={{ maxWidth: '600px', fontSize: '1rem' }}>
                    SOULBOUND bridges the gap between off-chain AI analysis and on-chain verifiable trust. Here is the step-by-step lifecycle of a smart contract audit on our platform.
                </p>
            </div>

            <div className="grid-2" style={{ gap: '2rem' }}>
                {/* Step 1 */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--grey-900)', border: '1px solid var(--grey-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)' }}>
                            <Code size={20} />
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 300, color: 'var(--white)' }}>
                            1. Reconnaissance
                        </h2>
                    </div>
                    <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                        Researchers input a GitHub repository URL into the SOULBOUND Scanner. The system immediately clones the repository and runs a dual-layer analysis:
                    </p>
                    <ul style={{ color: 'var(--grey-300)', fontSize: '0.85rem', marginTop: '1rem', paddingLeft: '1.5rem', lineHeight: 1.6 }}>
                        <li><strong>Semgrep:</strong> Static analysis rules identify common Solidity anti-patterns and known vulnerabilities.</li>
                        <li><strong>LLM Analysis:</strong> An AI agent reviews the code contextually to identify logical flaws, reentrancy vectors, and access control issues that static analysis might miss.</li>
                    </ul>
                </div>

                {/* Step 2 */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--grey-900)', border: '1px solid var(--grey-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)' }}>
                            <Shield size={20} />
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 300, color: 'var(--white)' }}>
                            2. Encryption & IPFS
                        </h2>
                    </div>
                    <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                        Zero-day vulnerabilities are highly sensitive. SOULBOUND never stores raw reports in a centralized database.
                    </p>
                    <ul style={{ color: 'var(--grey-300)', fontSize: '0.85rem', marginTop: '1rem', paddingLeft: '1.5rem', lineHeight: 1.6 }}>
                        <li>The AI report is encrypted using the target organization's public RSA key.</li>
                        <li>The encrypted payload is pinned to the InterPlanetary File System (IPFS).</li>
                        <li>This ensures the report is immutable and decentralized, but only readable by the affected organization.</li>
                    </ul>
                </div>

                {/* Step 3 */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--grey-900)', border: '1px solid var(--grey-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)' }}>
                            <FileText size={20} />
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 300, color: 'var(--white)' }}>
                            3. Org Portal & Patching
                        </h2>
                    </div>
                    <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                        Organizations use the SOULBOUND Org Portal to manage inbound vulnerability reports securely.
                    </p>
                    <ul style={{ color: 'var(--grey-300)', fontSize: '0.85rem', marginTop: '1rem', paddingLeft: '1.5rem', lineHeight: 1.6 }}>
                        <li>The organization inputs their private RSA key (client-side only) to decrypt the IPFS payload.</li>
                        <li>They review the vulnerabilities and assign the issue to a researcher (or internal developer) to fix.</li>
                        <li>The researcher submits a Pull Request (PR) on GitHub referencing the assigned IPFS issue.</li>
                    </ul>
                </div>

                {/* Step 4 */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--grey-900)', border: '1px solid var(--grey-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)' }}>
                            <BadgeCheck size={20} />
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 300, color: 'var(--white)' }}>
                            4. Minting Soulbound Badges
                        </h2>
                    </div>
                    <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                        Once the patch is merged, the organization verifies the PR through the SOULBOUND portal.
                    </p>
                    <ul style={{ color: 'var(--grey-300)', fontSize: '0.85rem', marginTop: '1rem', paddingLeft: '1.5rem', lineHeight: 1.6 }}>
                        <li>An AI agent evaluates the merged patch for optimality and security.</li>
                        <li>If successful, a non-transferable Soulbound Token (SBT) is minted on-chain to the researcher's wallet.</li>
                        <li>This SBT serves as an immutable, verifiable badge of trust and competence on their hacker profile.</li>
                    </ul>
                </div>
            </div>
        </main>
    );
}
