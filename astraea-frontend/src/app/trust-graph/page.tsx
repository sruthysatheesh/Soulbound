'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import contractData from '@/lib/contract.json';

interface SBTMetadata {
    tokenId: number;
    name: string;
    severity: string;
    description: string;
    auditor_ai: string;
    timestamp: string;
    ipfs_uri: string;
}

// Severity to icon/class mapping
const severityMap: Record<string, { icon: string; cls: string }> = {
    High: { icon: '🔴', cls: 'high' },
    Medium: { icon: '🟡', cls: 'medium' },
    Low: { icon: '🟢', cls: 'low' },
};

// Demo badges to show when wallet has no tokens
const DEMO_BADGES: SBTMetadata[] = [
    {
        tokenId: 0,
        name: 'Reentrancy Exploit',
        severity: 'High',
        description: 'Identified critical reentrancy vulnerability in DeFi vault contract.',
        auditor_ai: 'Astraea Agent v1.0',
        timestamp: '1710500000',
        ipfs_uri: 'ipfs://QmDemo1...',
    },
    {
        tokenId: 1,
        name: 'Integer Overflow',
        severity: 'Medium',
        description: 'Unchecked arithmetic in token minting logic.',
        auditor_ai: 'Astraea Agent v1.0',
        timestamp: '1710600000',
        ipfs_uri: 'ipfs://QmDemo2...',
    },
    {
        tokenId: 2,
        name: 'Access Control Bypass',
        severity: 'High',
        description: 'Missing onlyOwner modifier on privileged liquidity function.',
        auditor_ai: 'Astraea Agent v1.0',
        timestamp: '1710700000',
        ipfs_uri: 'ipfs://QmDemo3...',
    },
];

function BadgeCard({ badge }: { badge: SBTMetadata }) {
    const { icon, cls } = severityMap[badge.severity] || { icon: '⚪', cls: 'low' };
    const date = new Date(Number(badge.timestamp) * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    });

    return (
        <div className={`badge-card severity-${cls.toLowerCase()} fade-in`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className={`badge-icon ${cls}`}>{icon}</div>
                <span className={`pill pill-${cls}`}>{badge.severity}</span>
            </div>

            <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                    {badge.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {badge.description}
                </div>
            </div>

            <div className="divider" style={{ margin: '0.5rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <div className="report-field-label">Auditor</div>
                    <div className="tag">{badge.auditor_ai}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="report-field-label">Issued</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{date}</div>
                </div>
            </div>

            <div style={{ marginTop: '0.25rem' }}>
                <div className="report-field-label">Token ID</div>
                <div className="report-field-value mono">#{badge.tokenId.toString().padStart(4, '0')}</div>
            </div>
        </div>
    );
}

export default function TrustGraphPage() {
    const { address, isConnected } = useAccount();
    const [badges, setBadges] = useState<SBTMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDemo, setShowDemo] = useState(false);

    // Read total balance of SBTs for the connected wallet
    const { data: balance } = useReadContract({
        address: contractData.address as `0x${string}`,
        abi: contractData.abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    useEffect(() => {
        // When connected, show loading state and attempt to load real data
        // For hackathon: if no real tokens yet, show demo data
        if (isConnected) {
            setLoading(true);
            setTimeout(() => {
                setLoading(false);
                if (!balance || Number(balance) === 0) {
                    setShowDemo(true);
                    setBadges(DEMO_BADGES);
                }
            }, 1200);
        }
    }, [isConnected, balance]);

    const highCount = badges.filter(b => b.severity === 'High').length;
    const medCount = badges.filter(b => b.severity === 'Medium').length;
    const lowCount = badges.filter(b => b.severity === 'Low').length;

    return (
        <main className="page">
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 className="section-title">Hacker Trust Graph</h1>
                <p className="section-sub">
                    Your on-chain security reputation. Each badge is a Soulbound Token (SBT) representing a verified vulnerability discovery — permanently tied to your wallet.
                </p>
            </div>

            {!isConnected ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem', maxWidth: 500, margin: '0 auto' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🔐</div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '1rem', marginBottom: '0.75rem' }}>
                        Connect your wallet
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Connect your MetaMask (with the Hardhat test account) to view your Soulbound Verification Badges.
                    </div>
                </div>
            ) : (
                <>
                    {/* Wallet info */}
                    <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div className="pulse-dot green" />
                        <div>
                            <div className="report-field-label">Connected Wallet</div>
                            <div className="report-field-value mono" style={{ fontSize: '0.85rem' }}>{address}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
                            <div className="stat-box">
                                <div className="stat-value" style={{ color: 'var(--danger)' }}>{highCount}</div>
                                <div className="stat-label">High</div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-value" style={{ color: 'var(--warning)' }}>{medCount}</div>
                                <div className="stat-label">Medium</div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-value" style={{ color: 'var(--success)' }}>{lowCount}</div>
                                <div className="stat-label">Low</div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-value">{badges.length}</div>
                                <div className="stat-label">Total SBTs</div>
                            </div>
                        </div>
                    </div>

                    {showDemo && (
                        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
                            ⚠ No minted SBTs found for this wallet. Showing demo badges. Run a scan and mint a badge to populate real data!
                        </div>
                    )}

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, margin: '0 auto 1rem' }} />
                            <div>Loading your badges...</div>
                        </div>
                    ) : (
                        <div className="grid-3">
                            {badges.map((badge) => (
                                <BadgeCard key={badge.tokenId} badge={badge} />
                            ))}
                        </div>
                    )}

                    {badges.length === 0 && !loading && (
                        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
                            <div>No verification badges yet.</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                Go to the <a href="/" style={{ color: 'var(--primary)' }}>Scanner</a> to analyze a contract and mint your first badge.
                            </div>
                        </div>
                    )}
                </>
            )}
        </main>
    );
}
