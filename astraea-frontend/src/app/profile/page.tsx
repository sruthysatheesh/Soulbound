'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import contractData from '@/lib/contract.json';

interface SBTRecord {
    id: string;
    repo: string;
    pr: string;
    score: number;
    optimality: string;
    report: string;
    ipfsUri: string;
    issueId?: string;
    mintedAt: string;
}

interface AssignmentRecord {
    id: string;
    ipfs_hash: string;
    vuln_name: string;
    severity: string;
    repo: string;
    file_path?: string;
    line_number?: number;
    source_url?: string;
    assigned_at: string;
    status?: string;
}

export default function HackerProfile() {
    const { address, isConnected } = useAccount();
    const [githubUsername, setGithubUsername] = useState('');
    const [saved, setSaved] = useState(false);
    const [sbts, setSbts] = useState<SBTRecord[]>([]);
    const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const { data: onChainBalance } = useReadContract({
        address: contractData.address as `0x${string}`,
        abi: contractData.abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    const loadRecords = (addr: string) => {
        const profilesStr = localStorage.getItem('github_profiles');
        let user = githubUsername;
        if (profilesStr) {
            const profiles = JSON.parse(profilesStr);
            const foundUser = Object.keys(profiles).find(
                u => profiles[u].toLowerCase() === addr.toLowerCase()
            );
            if (foundUser) {
                user = foundUser;
                setGithubUsername(foundUser);
            }
        }

        if (user) {
            const assignKey = `astraea_assignments_${user.toLowerCase()}`;
            const assignData = localStorage.getItem(assignKey);
            if (assignData) {
                // Parse and strictly sort by date descending
                const parsed = JSON.parse(assignData) as AssignmentRecord[];
                parsed.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
                setAssignments(parsed);
            }
        }

        const sbtKey = `astraea_sbts_${addr.toLowerCase()}`;
        const sbtData = localStorage.getItem(sbtKey);
        if (sbtData) setSbts(JSON.parse(sbtData));
    };

    useEffect(() => {
        if (!address) return;
        loadRecords(address);

        // Auto-refresh panel so Org assignments appear instantly
        const interval = setInterval(() => loadRecords(address), 3000);
        return () => clearInterval(interval);
    }, [address, githubUsername]);

    const saveProfile = () => {
        if (!githubUsername.trim() || !address) return;
        const profilesStr = localStorage.getItem('github_profiles') || '{}';
        const profiles = JSON.parse(profilesStr);
        profiles[githubUsername.trim()] = address;
        localStorage.setItem('github_profiles', JSON.stringify(profiles));
        setSaved(true);
        loadRecords(address);
        setTimeout(() => setSaved(false), 3000);
    };

    const copySnippet = (hash: string, id: string) => {
        navigator.clipboard.writeText(`Fixes: ASTRAEA-ISSUE ipfs://${hash}`);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2500);
    };

    const formatDate = (iso: string) => {
        try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch { return iso; }
    };

    const avgScore = sbts.length
        ? Math.round(sbts.reduce((acc, s) => acc + s.score, 0) / sbts.length)
        : 0;

    const scoreColor = (s: number) => s >= 85 ? '#e8e8e8' : s >= 60 ? '#aaaaaa' : '#666666';

    const sevColor = (sev: string) => {
        switch (sev?.toUpperCase()) {
            case 'HIGH': return '#ff5555';
            case 'MEDIUM': return '#ffb86c';
            default: return '#50fa7b';
        }
    };

    const openAssignments = assignments.filter(a => a.status !== 'resolved');
    const resolvedAssignments = assignments.filter(a => a.status === 'resolved');

    const gs = {
        page: { minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-primary)', fontFamily: 'inherit', padding: '2rem 1rem' },
        container: { maxWidth: '1100px', margin: '0 auto' },
        header: { borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '2.5rem' },
        title: { fontFamily: "'Courier New', Courier, monospace", fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.1em', margin: 0 },
        subtitle: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.4rem', fontFamily: "'Courier New', Courier, monospace" },
        grid: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: '2rem', alignItems: 'start' },
        card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1.5rem' },
        label: { fontFamily: "'Courier New', Courier, monospace", fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '0.4rem' },
        addrBox: { fontFamily: "'Courier New', Courier, monospace", fontSize: '0.78rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-all' as const },
        inputWrap: { display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '0.4rem' },
        prefix: { padding: '0 0.75rem', color: 'var(--text-dim)', fontFamily: "'Courier New', Courier, monospace", fontSize: '0.8rem', borderRight: '1px solid var(--border)' },
        input: { flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '0.75rem', fontFamily: "'Courier New', Courier, monospace", fontSize: '0.85rem', outline: 'none' },
        btn: { width: '100%', marginTop: '1rem', padding: '0.85rem', background: 'var(--border)', border: '1px solid var(--primary-dim)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: "'Courier New', Courier, monospace", fontSize: '0.75rem', letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 0.2s' },
        statRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' },
        statBox: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1rem', textAlign: 'center' as const },
        statVal: { fontFamily: "'Courier New', Courier, monospace", fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' },
        statLbl: { fontFamily: "'Courier New', Courier, monospace", fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' as const, marginTop: '0.25rem' },
        treeRoot: { fontFamily: "'Courier New', Courier, monospace" },
        treeRootLabel: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' },
        treeLine: { borderLeft: '1px solid var(--border)', marginLeft: '0.5rem', paddingLeft: '1.5rem' },
        treeItem: { position: 'relative' as const, marginBottom: '0.75rem' },
        connector: { position: 'absolute' as const, left: '-1.5rem', top: '50%', width: '1.25rem', height: '1px', background: 'var(--border)' },
        nodePill: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.75rem 1rem', cursor: 'pointer' },
        nodeLabel: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
        nodeDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
        expandBox: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '1rem 1rem 1rem 1.5rem' },
        subTree: { borderLeft: '1px dashed var(--border)', marginLeft: '0.5rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
        fieldLabel: { fontFamily: "'Courier New', Courier, monospace", fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.2rem' },
        fieldVal: { fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.6 },
    };

    return (
        <div style={gs.page}>
            <div style={gs.container}>
                <div style={gs.header}>
                    <h1 style={gs.title}>HUNTER PROFILE</h1>
                    <p style={gs.subtitle}>Identity, Assigned Issues & Soulbound Achievement Record</p>
                </div>

                {/* Stats */}
                {isConnected && (
                    <div style={gs.statRow}>
                        <div style={gs.statBox}>
                            <div style={gs.statVal}>{String(onChainBalance ?? sbts.length)}</div>
                            <div style={gs.statLbl}>SBTs Earned</div>
                        </div>
                        <div style={gs.statBox}>
                            <div style={{ ...gs.statVal, color: scoreColor(avgScore) }}>{sbts.length ? avgScore : '—'}</div>
                            <div style={gs.statLbl}>Avg Score</div>
                        </div>
                        <div style={gs.statBox}>
                            <div style={{ ...gs.statVal, fontSize: '0.95rem', paddingTop: '0.5rem', color: '#666' }}>
                                {sbts.length ? formatDate(sbts[sbts.length - 1].mintedAt) : '—'}
                            </div>
                            <div style={gs.statLbl}>Last Earned</div>
                        </div>
                    </div>
                )}

                <div style={gs.grid}>
                    {/* Left: Identity */}
                    <div>
                        <div style={gs.card}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={gs.label}>Web3 Address</div>
                                {isConnected
                                    ? <div style={gs.addrBox}>{address}</div>
                                    : <div style={{ ...gs.addrBox, color: '#333', fontStyle: 'italic' }}>connect wallet to continue</div>
                                }
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={gs.label}>GitHub Identity</div>
                                <div style={gs.inputWrap}>
                                    <span style={gs.prefix}>github.com/</span>
                                    <input
                                        style={gs.input}
                                        placeholder="username"
                                        value={githubUsername}
                                        onChange={e => setGithubUsername(e.target.value)}
                                        disabled={!isConnected}
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                            <button
                                style={{ ...gs.btn, color: saved ? '#fff' : '#ccc', borderColor: saved ? '#333' : '#1e1e1e' }}
                                onClick={saveProfile}
                                disabled={!isConnected || !githubUsername.trim()}
                            >
                                {saved ? '✓ SYNCHRONIZED' : 'LINK IDENTITY'}
                            </button>
                            {saved && (
                                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: "'Courier New', Courier, monospace" }}>
                                    identity registered · organizations can now assign issues
                                </div>
                            )}
                        </div>

                        {/* Assigned Issues Panel */}
                        {isConnected && assignments.length > 0 && (
                            <div style={{ ...gs.card, marginTop: '1.5rem', borderColor: openAssignments.length > 0 ? 'var(--primary-dim)' : 'var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                                        ASSIGNED ISSUES
                                    </div>
                                    <span style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.7rem', color: openAssignments.length > 0 ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                                        {openAssignments.length} open · {resolvedAssignments.length} resolved
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {openAssignments.map(issue => (
                                        <div key={issue.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{issue.vuln_name}</div>
                                                    {issue.source_url ? (
                                                        <a
                                                            href={issue.source_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.68rem', color: 'var(--text-secondary)', textDecoration: 'underline', wordBreak: 'break-all' }}
                                                        >
                                                            {issue.source_url.replace('https://github.com/', '')}
                                                        </a>
                                                    ) : (
                                                        <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                                                            {issue.id} · {formatDate(issue.assigned_at)}
                                                        </div>
                                                    )}
                                                    <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                                                        {issue.id} · {formatDate(issue.assigned_at)}
                                                    </div>
                                                </div>
                                                <span style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.65rem', color: sevColor(issue.severity), border: `1px solid ${sevColor(issue.severity)}`, padding: '0.15rem 0.5rem', borderRadius: '3px', flexShrink: 0 }}>
                                                    {issue.severity}
                                                </span>
                                            </div>

                                            {/* PR snippet to copy */}
                                            <div style={{ borderTop: '1px solid #1a1a1a', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: '#080808' }}>
                                                <code style={{ fontSize: '0.68rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>
                                                    Fixes: ASTRAEA-ISSUE ipfs://{issue.ipfs_hash.substring(0, 16)}...
                                                </code>
                                                <button
                                                    onClick={() => copySnippet(issue.ipfs_hash, issue.id)}
                                                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: '3px', color: copiedId === issue.id ? '#888' : '#444', padding: '0.25rem 0.6rem', cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                                                >
                                                    {copiedId === issue.id ? '✓ copied' : 'copy'}
                                                </button>
                                            </div>
                                            <div style={{ padding: '0.4rem 1rem', fontSize: '0.68rem', color: '#333', fontFamily: 'JetBrains Mono, monospace', borderTop: '1px solid #111' }}>
                                                ↳ paste the snippet above into your PR description
                                            </div>
                                        </div>
                                    ))}

                                    {resolvedAssignments.map(issue => (
                                        <div key={issue.id} style={{ padding: '0.6rem 1rem', background: '#0a0a0a', border: '1px solid #141414', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5 }}>
                                            <span style={{ fontSize: '0.78rem', color: '#444', textDecoration: 'line-through' }}>{issue.vuln_name}</span>
                                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#333' }}>✓ resolved</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: SBT Tree */}
                    <div style={gs.treeRoot}>
                        {sbts.length === 0 ? (
                            <div style={{ ...gs.card, textAlign: 'center', padding: '3rem' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.15 }}>◈</div>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: '#333', letterSpacing: '0.1em' }}>
                                    NO ACHIEVEMENTS YET
                                </div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#222', marginTop: '0.5rem' }}>
                                    patch an assigned vulnerability to earn your first SBT
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={gs.treeRootLabel}>
                                    <span style={{ fontWeight: 700, color: '#888', fontFamily: 'Orbitron, monospace', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                                        ◆ ASTRAEA SBT VAULT
                                    </span>
                                    <span style={{ borderTop: '1px solid #1e1e1e', flex: 1 }} />
                                    <span style={{ color: '#333' }}>{sbts.length} token{sbts.length > 1 ? 's' : ''}</span>
                                </div>

                                <div style={gs.treeLine}>
                                    {sbts.map((sbt) => {
                                        const isOpen = expandedId === sbt.id;
                                        return (
                                            <div key={sbt.id} style={gs.treeItem}>
                                                <div style={gs.connector} />
                                                <div
                                                    style={{
                                                        ...gs.nodePill,
                                                        borderColor: isOpen ? '#2a2a2a' : '#1e1e1e',
                                                        background: isOpen ? '#161616' : '#111111',
                                                        borderRadius: isOpen ? '6px 6px 0 0' : '6px',
                                                    }}
                                                    onClick={() => setExpandedId(isOpen ? null : sbt.id)}
                                                >
                                                    <div>
                                                        <div style={gs.nodeLabel}>
                                                            <div style={{ ...gs.nodeDot, background: sbt.score >= 85 ? '#888' : '#444' }} />
                                                            <span style={{ fontSize: '0.85rem', color: '#bbb' }}>
                                                                {sbt.id} — {sbt.repo}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: '#444', marginLeft: '1.3rem', marginTop: '0.1rem' }}>
                                                            PR #{sbt.pr} · {formatDate(sbt.mintedAt)}
                                                            {sbt.issueId && <span style={{ marginLeft: '0.5rem', color: '#333' }}>· {sbt.issueId}</span>}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: scoreColor(sbt.score) }}>
                                                            {sbt.score}/100
                                                        </span>
                                                        <span style={{ color: '#333', fontSize: '0.7rem' }}>{isOpen ? '▲' : '▼'}</span>
                                                    </div>
                                                </div>

                                                {isOpen && (
                                                    <div style={gs.expandBox}>
                                                        <div style={gs.subTree}>
                                                            <div>
                                                                <div style={gs.fieldLabel}>// report</div>
                                                                <div style={gs.fieldVal}>{sbt.report}</div>
                                                            </div>
                                                            <div>
                                                                <div style={gs.fieldLabel}>// optimality</div>
                                                                <div style={gs.fieldVal}>{sbt.optimality}</div>
                                                            </div>
                                                            <div>
                                                                <div style={gs.fieldLabel}>// ipfs metadata</div>
                                                                <div style={{ ...gs.fieldVal, fontSize: '0.72rem', wordBreak: 'break-all' }}>{sbt.ipfsUri}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
