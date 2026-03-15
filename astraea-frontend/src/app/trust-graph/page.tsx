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

const DEMO_BADGES: SBTMetadata[] = [
    {
        tokenId: 1,
        name: 'Reentrancy Exploit',
        severity: 'High',
        description: 'Critical reentrancy vulnerability in DeFi vault withdraw().',
        auditor_ai: 'Astraea Agent v1.0',
        timestamp: '1710500000',
        ipfs_uri: 'ipfs://QmDemo1...',
    },
    {
        tokenId: 2,
        name: 'Integer Overflow',
        severity: 'Medium',
        description: 'Unchecked arithmetic in token minting logic.',
        auditor_ai: 'Astraea Agent v1.0',
        timestamp: '1710600000',
        ipfs_uri: 'ipfs://QmDemo2...',
    },
    {
        tokenId: 3,
        name: 'Access Control Bypass',
        severity: 'High',
        description: 'Missing onlyOwner modifier on privileged liquidity function.',
        auditor_ai: 'Astraea Agent v1.0',
        timestamp: '1710700000',
        ipfs_uri: 'ipfs://QmDemo3...',
    },
];

function getSeverityColor(severity: string) {
    if (severity === 'High') return 'var(--danger)';
    if (severity === 'Medium') return 'var(--warning)';
    return 'var(--text-secondary)';
}

function SBTTreeNode({ badge, isLast }: { badge: SBTMetadata; isLast: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const date = new Date(Number(badge.timestamp) * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    });
    const sevColor = getSeverityColor(badge.severity);

    return (
        <div style={{ position: 'relative', paddingLeft: '2rem' }}>
            {/* Vertical connector line */}
            <div style={{
                position: 'absolute',
                left: '0.6rem',
                top: 0,
                bottom: isLast ? '50%' : 0,
                width: '1px',
                background: 'var(--border)',
            }} />
            {/* Horizontal branch */}
            <div style={{
                position: 'absolute',
                left: '0.6rem',
                top: '1.5rem',
                width: '1.4rem',
                height: '1px',
                background: 'var(--border)',
            }} />

            {/* Node */}
            <div
                onClick={() => setExpanded(e => !e)}
                style={{
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-surface)',
                    border: `1px solid ${expanded ? sevColor : 'var(--border)'}`,
                    borderRadius: '6px',
                    transition: 'border-color 0.2s, background 0.2s',
                    userSelect: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = sevColor)}
                onMouseLeave={e => { if (!expanded) e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
                {/* Node header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                        <span style={{
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            color: 'var(--text-dim)',
                            whiteSpace: 'nowrap',
                        }}>
                            #{String(badge.tokenId).padStart(4, '0')}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {badge.name}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            color: sevColor,
                            border: `1px solid ${sevColor}`,
                            borderRadius: '3px',
                            padding: '0.1rem 0.4rem',
                        }}>
                            {badge.severity.toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            {expanded ? '[-]' : '[+]'}
                        </span>
                    </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', marginBottom: '0.6rem' }}>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '0.15rem' }}>ISSUED</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{date}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '0.15rem' }}>AUDITOR</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{badge.auditor_ai}</div>
                            </div>
                        </div>
                        <div style={{ marginBottom: '0.6rem' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '0.15rem' }}>DESCRIPTION</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{badge.description}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '0.15rem' }}>IPFS REPORT</div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.73rem', color: 'var(--primary)', wordBreak: 'break-all' }}>{badge.ipfs_uri}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TrustGraphPage() {
    const { address, isConnected } = useAccount();
    const [badges, setBadges] = useState<SBTMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDemo, setShowDemo] = useState(false);

    const { data: balance } = useReadContract({
        address: contractData.address as `0x${string}`,
        abi: contractData.abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    useEffect(() => {
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

    const shortAddr = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '';

    return (
        <main className="page">
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 className="section-title">Hunter Trust Graph</h1>
                <p className="section-sub">
                    On-chain security reputation tree. Each node is a Soulbound Token minted for a verified vulnerability discovery.
                </p>
            </div>

            {!isConnected ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem', maxWidth: 480, margin: '0 auto' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: 'var(--primary)', marginBottom: '1rem' }}>
                        [ CONNECT WALLET ]
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Connect your MetaMask to view your Soulbound Verification Badges as a trust tree.
                    </div>
                </div>
            ) : (
                <>
                    {showDemo && (
                        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
                            ⚠ No real SBTs found for this wallet — displaying demo data. Scan a contract and mint a badge to populate.
                        </div>
                    )}

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 2, margin: '0 auto 1rem' }} />
                            <div>Loading badges...</div>
                        </div>
                    ) : (
                        <div style={{ maxWidth: 740, margin: '0 auto' }}>
                            {/* ── Root node: wallet ─────────────────── */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.9rem 1.1rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--primary)',
                                borderRadius: '8px',
                                marginBottom: 0,
                            }}>
                                <div className="pulse-dot blue" />
                                <div>
                                    <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>ROOT — WALLET</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--primary)' }}>{address}</div>
                                </div>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                                    {[
                                        { label: 'HIGH', count: highCount, color: 'var(--danger)' },
                                        { label: 'MED', count: medCount, color: 'var(--warning)' },
                                        { label: 'LOW', count: lowCount, color: 'var(--text-secondary)' },
                                        { label: 'TOTAL', count: badges.length, color: 'var(--primary)' },
                                    ].map(({ label, count, color }) => (
                                        <div key={label} style={{ textAlign: 'center' }}>
                                            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color }}>{count}</div>
                                            <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Trunk line connecting root to children ── */}
                            <div style={{ marginLeft: '0.6rem', width: '1px', height: '1.5rem', background: 'var(--border)' }} />

                            {/* ── SBT child nodes ────────────────────── */}
                            {badges.length === 0 ? (
                                <div style={{ paddingLeft: '2rem', color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    └── [ no badges minted ]
                                </div>
                            ) : (
                                <div>
                                    {badges.map((badge, i) => (
                                        <SBTTreeNode
                                            key={badge.tokenId}
                                            badge={badge}
                                            isLast={i === badges.length - 1}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </main>
    );
}
