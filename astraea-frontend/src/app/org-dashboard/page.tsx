'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import contractData from '@/lib/contract.json';

interface AssignmentRecord {
    id: string;
    ipfs_hash: string;
    vuln_name: string;
    severity: string;
    repo: string;
    file_path?: string;
    line_number?: number;
    source_url?: string;
    status: 'assigned' | 'resolved';
    assigned_at: string;
}

export default function OrgDashboard() {
    // Decryption State
    const [ipfsUri, setIpfsUri] = useState('');
    const [privateKey, setPrivateKey] = useState('');
    const [decrypting, setDecrypting] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState('');

    // Assignment State (per vuln index)
    const [assignTarget, setAssignTarget] = useState<{ [key: number]: string }>({});
    const [sourceRepoUrl, setSourceRepoUrl] = useState<{ [key: number]: string }>({});
    const [assignedFlags, setAssignedFlags] = useState<{ [key: number]: boolean }>({});

    // Bounty State
    const { isConnected } = useAccount();
    const [prUrl, setPrUrl] = useState('');
    const [verifyingPr, setVerifyingPr] = useState(false);
    const [prError, setPrError] = useState('');
    const [foundWallet, setFoundWallet] = useState('');
    const [hackerGithub, setHackerGithub] = useState('');
    const [matchedIssueId, setMatchedIssueId] = useState('');

    // Evaluation State
    const [bountyUri, setBountyUri] = useState('');
    const [patchEval, setPatchEval] = useState<any | null>(null);

    const { writeContract, data: txHash, isPending: isMinting } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

    // ── Assign Issue to Hacker ────────────────────────────────────────────────
    const handleAssign = (vulnIndex: number, vuln: any) => {
        const github = (assignTarget[vulnIndex] || '').trim();
        if (!github || !ipfsUri) return;

        const cid = ipfsUri.replace('ipfs://', '');
        const repoBase = (sourceRepoUrl[vulnIndex] || '').trim().replace(/\/$/, '');
        const filePath = vuln.file_path || '';
        const lineNum = vuln.line_number;
        const constructedUrl = repoBase && filePath
            ? `${repoBase}/blob/main/${filePath}${lineNum ? `#L${lineNum}` : ''}`
            : undefined;
        const record: AssignmentRecord = {
            id: `ISSUE-${Date.now()}`,
            ipfs_hash: cid,
            vuln_name: vuln.vulnerability_name || 'Unknown Vulnerability',
            severity: vuln.severity || 'UNKNOWN',
            repo: result?.repo || 'Unknown',
            file_path: filePath || undefined,
            line_number: lineNum || undefined,
            source_url: constructedUrl,
            status: 'assigned',
            assigned_at: new Date().toISOString(),
        };

        const key = `astraea_assignments_${github.toLowerCase()}`;
        const existing: AssignmentRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
        // Prevent duplicate assignment for same IPFS hash AND same vulnerability
        if (!existing.some(e => e.ipfs_hash === cid && e.vuln_name === (vuln.vulnerability_name || 'Unknown Vulnerability'))) {
            existing.push(record);
            localStorage.setItem(key, JSON.stringify(existing));
        }

        setAssignedFlags(f => ({ ...f, [vulnIndex]: true }));
        setTimeout(() => setAssignedFlags(f => ({ ...f, [vulnIndex]: false })), 3000);
    };

    // ── Decrypt ───────────────────────────────────────────────────────────────
    const handleDecrypt = async () => {
        if (!ipfsUri.trim() || !privateKey.trim()) {
            setError('Please provide both the IPFS URI and the Organization Private Key.');
            return;
        }
        setError('');
        setResult(null);
        setDecrypting(true);
        try {
            const response = await fetch('http://localhost:8000/decrypt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ipfs_uri: ipfsUri, private_key_pem: privateKey }),
            });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || `API error: ${response.status}`);
            setResult(data.report);
            // Auto-populate the source repo URL for every vulnerability from the scan report
            if (data.report?.repo_url && data.report?.vulnerabilities) {
                const auto: { [key: number]: string } = {};
                data.report.vulnerabilities.forEach((_: any, i: number) => {
                    auto[i] = data.report.repo_url;
                });
                setSourceRepoUrl(auto);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to decrypt payload. Are you sure you have the correct key?');
        } finally {
            setDecrypting(false);
        }
    };

    // ── Verify PR ─────────────────────────────────────────────────────────────
    const handleVerifyPr = async () => {
        if (!prUrl.trim()) return;
        setPrError('');
        setFoundWallet('');
        setHackerGithub('');
        setPatchEval(null);
        setMatchedIssueId('');
        setVerifyingPr(true);
        try {
            const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);
            if (!match) throw new Error('Invalid PR URL format. Use https://github.com/owner/repo/pull/123');
            const [_, owner, repo, pull_number] = match;

            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`);
            if (!res.ok) throw new Error('Failed to fetch PR from GitHub API.');
            const prData = await res.json();
            if (!prData.merged) throw new Error('This PR is not yet merged! SBTs can only be minted for merged patches.');

            const author = prData.user.login;
            setHackerGithub(author);

            // ── 1. Resolve wallet ─────────────────────────────────────────────
            const profilesStr = localStorage.getItem('github_profiles');
            if (!profilesStr) throw new Error(`No Hacker Profiles registered yet.`);
            const profiles = JSON.parse(profilesStr);
            const foundKey = Object.keys(profiles).find(k => k.toLowerCase() === author.toLowerCase());
            if (!foundKey || !profiles[foundKey]) {
                throw new Error(`@${author} hasn't linked a Web3 Wallet in their Hacker Profile.`);
            }
            const hackerWallet = profiles[foundKey];

            // ── 2. Duplicate guard ────────────────────────────────────────────
            const sbtKey = `astraea_sbts_${hackerWallet.toLowerCase()}`;
            const existingSbts: any[] = JSON.parse(localStorage.getItem(sbtKey) || '[]');
            if (existingSbts.some(s => s.pr === pull_number && s.repo === `${owner}/${repo}`)) {
                throw new Error(`SBT already issued for ${owner}/${repo} PR #${pull_number}. Duplicate minting blocked.`);
            }

            // ── 3. IPFS hash cross-reference ──────────────────────────────────
            const assignKey = `astraea_assignments_${author.toLowerCase()}`;
            const assignments: AssignmentRecord[] = JSON.parse(localStorage.getItem(assignKey) || '[]');
            if (assignments.length === 0) {
                throw new Error(`@${author} has no assigned issues. The organization must assign a vulnerability before a bounty can be issued.`);
            }

            // Extract IPFS hash from PR body
            const prBody: string = prData.body || '';
            const ipfsRefMatch = prBody.match(/ipfs:\/\/(Qm[a-zA-Z0-9]+|baf[a-zA-Z0-9]+)/i);
            if (!ipfsRefMatch) {
                throw new Error(
                    `PR body does not reference an Astraea IPFS issue. The hacker must include "Fixes: ASTRAEA-ISSUE ipfs://Qm..." in the PR description.`
                );
            }
            const referencedCid = ipfsRefMatch[1];
            const matched = assignments.find(a => a.ipfs_hash === referencedCid);
            if (!matched) {
                throw new Error(
                    `The IPFS hash in this PR (${referencedCid.substring(0, 10)}...) does not match any issue assigned to @${author}.`
                );
            }
            setMatchedIssueId(matched.id);

            setFoundWallet(hackerWallet);

            // ── 4. AI evaluation ──────────────────────────────────────────────
            const resEval = await fetch('http://localhost:8000/evaluate-pr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pr_url: prUrl }),
            });
            const evalData = await resEval.json();
            if (evalData.error) throw new Error('AI Evaluation Failed: ' + evalData.error);
            setPatchEval(evalData.evaluation);
            setBountyUri(evalData.new_ipfs_uri);

        } catch (e: any) {
            setPrError(e.message);
        } finally {
            setVerifyingPr(false);
        }
    };

    // ── Mint Bounty ───────────────────────────────────────────────────────────
    const handleMintBounty = () => {
        if (!foundWallet || !bountyUri) return;
        writeContract({
            address: contractData.address as `0x${string}`,
            abi: contractData.abi,
            functionName: 'mintVerification',
            args: [foundWallet as `0x${string}`, bountyUri],
        });
    };

    // Persist SBT on confirmed mint + mark assignment resolved
    useEffect(() => {
        if (isConfirmed && foundWallet && patchEval && bountyUri) {
            const sbtKey = `astraea_sbts_${foundWallet.toLowerCase()}`;
            const existing: any[] = JSON.parse(localStorage.getItem(sbtKey) || '[]');
            const repoMatch = prUrl.match(/github\.com\/([^/]+\/[^/]+)/);
            const prMatch = prUrl.match(/\/pull\/(\d+)/);
            existing.push({
                id: `SBT-${String(existing.length + 1).padStart(3, '0')}`,
                repo: repoMatch ? repoMatch[1] : 'Unknown',
                pr: prMatch ? prMatch[1] : '-',
                score: patchEval.score,
                optimality: patchEval.optimality,
                report: patchEval.detailed_report,
                ipfsUri: bountyUri,
                hacker: hackerGithub,
                issueId: matchedIssueId,
                mintedAt: new Date().toISOString(),
            });
            localStorage.setItem(sbtKey, JSON.stringify(existing));

            // Mark the assignment as resolved
            if (hackerGithub && matchedIssueId) {
                const assignKey = `astraea_assignments_${hackerGithub.toLowerCase()}`;
                const assignments: AssignmentRecord[] = JSON.parse(localStorage.getItem(assignKey) || '[]');
                const updated = assignments.map(a =>
                    a.id === matchedIssueId ? { ...a, status: 'resolved' } : a
                );
                localStorage.setItem(assignKey, JSON.stringify(updated));
            }
        }
    }, [isConfirmed]);

    const getSeverityColor = (sev: string) => {
        switch (sev?.toUpperCase()) {
            case 'HIGH': return 'var(--danger)';
            case 'MEDIUM': return 'var(--warning)';
            case 'LOW': return 'var(--success)';
            default: return 'var(--primary)';
        }
    };

    return (
        <div className="container" style={{ marginTop: '2rem' }}>
            <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <h1 className="glitch" data-text="ORGANIZATION PORTAL">ORGANIZATION PORTAL</h1>
                <p style={{ color: 'var(--text-muted)' }}>Secure Zero-Day Payload Decryption Terminal & Bounty Manager</p>
            </div>

            <div className="grid">
                {/* ── Left Column ────────────────────────────────────────────── */}
                <div>
                    {/* Decrypt Card */}
                    <div className="card card-glow" style={{ borderColor: 'var(--border)', boxShadow: '0 0 15px var(--border-glow)' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <span className="code-label" style={{ color: 'var(--primary)' }}>// IPFS PAYLOAD URI</span>
                            <input
                                type="text"
                                className="code-input"
                                style={{ minHeight: '40px', fontSize: '0.9rem', marginTop: '0.5rem' }}
                                placeholder="ipfs://Qm..."
                                value={ipfsUri}
                                onChange={(e) => setIpfsUri(e.target.value)}
                                spellCheck={false}
                            />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <span className="code-label" style={{ color: 'var(--primary)' }}>// ORGANIZATION PRIVATE KEY (RSA .pem)</span>
                            <textarea
                                className="code-input"
                                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                value={privateKey}
                                onChange={(e) => setPrivateKey(e.target.value)}
                                spellCheck={false}
                                style={{ height: '180px', fontSize: '0.7rem' }}
                            />
                        </div>
                        {error && <div className="alert alert-warning" style={{ marginTop: '0.5rem' }}>⚠ {error}</div>}
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '1rem', background: 'var(--border)', borderColor: 'var(--primary-dim)', color: 'var(--text-primary)' }}
                            onClick={handleDecrypt}
                            disabled={decrypting}
                        >
                            {decrypting ? <span><span className="spinner"></span> DECRYPTING...</span> : '🔓 DECRYPT ZERO-DAY REPORT'}
                        </button>
                    </div>

                    {/* Bounty / PR Verify Card */}
                    <div className="card" style={{ marginTop: '2rem', borderColor: 'var(--success)' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--success)' }}>ISSUE BOUNTY (SBT)</h2>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
                            Paste a merged PR URL that references an assigned Astraea issue. The system verifies the IPFS hash in the PR description before issuing the SBT.
                        </p>
                        <div style={{ marginBottom: '1rem' }}>
                            <span className="code-label" style={{ color: 'var(--success)' }}>// MERGED GITHUB PR URL</span>
                            <input
                                type="text"
                                className="code-input"
                                style={{ minHeight: '40px', fontSize: '0.9rem', marginTop: '0.5rem' }}
                                placeholder="https://github.com/owner/repo/pull/123"
                                value={prUrl}
                                onChange={(e) => setPrUrl(e.target.value)}
                                spellCheck={false}
                            />
                        </div>
                        {prError && <div className="alert alert-warning" style={{ fontSize: '0.82rem' }}>⚠ {prError}</div>}

                        {!patchEval ? (
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '1rem', background: 'rgba(80, 250, 123, 0.1)', borderColor: 'var(--success)', color: 'var(--success)' }}
                                onClick={handleVerifyPr}
                                disabled={verifyingPr || !prUrl}
                            >
                                {verifyingPr
                                    ? <span><span className="spinner" style={{ borderTopColor: 'var(--success)' }}></span> VERIFYING & EVALUATING...</span>
                                    : '🔍 ANALYZE PATCH & VERIFY'}
                            </button>
                        ) : (
                            <div style={{ marginTop: '1.5rem', borderTop: '1px dashed var(--border)', paddingTop: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.05rem', color: '#fff' }}>🤖 AI Patch Evaluation</h3>
                                    <span className="severity-pill" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>SCORE: {patchEval.score}/100</span>
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <span className="code-label">// REPORT</span>
                                    <p style={{ fontSize: '0.88rem', color: '#ccc', marginTop: '0.25rem' }}>{patchEval.detailed_report}</p>
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <span className="code-label">// OPTIMALITY</span>
                                    <p style={{ fontSize: '0.88rem', color: '#ccc', marginTop: '0.25rem' }}>{patchEval.optimality}</p>
                                </div>
                                {matchedIssueId && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <span className="code-label" style={{ color: 'var(--success)' }}>// RESOLVES ASSIGNED ISSUE</span>
                                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--success)', marginTop: '0.25rem' }}>{matchedIssueId}</p>
                                    </div>
                                )}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <span className="code-label">// METADATA URI</span>
                                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{bountyUri}</p>
                                </div>
                                <div className="alert alert-success" style={{ marginBottom: '1.25rem', background: 'rgba(80, 250, 123, 0.1)', borderColor: 'var(--success)', fontSize: '0.83rem' }}>
                                    ✅ Merged by <strong>@{hackerGithub}</strong> · Wallet: <span style={{ fontFamily: 'var(--font-mono)' }}>{foundWallet.substring(0, 8)}...{foundWallet.substring(34)}</span>
                                </div>
                                {isConnected ? (
                                    <button
                                        className="btn btn-primary"
                                        style={{ width: '100%', background: 'var(--success)', borderColor: 'var(--success)', color: '#000', fontWeight: 'bold' }}
                                        onClick={handleMintBounty}
                                        disabled={isMinting || isConfirming || isConfirmed}
                                    >
                                        {isMinting || isConfirming
                                            ? <span><span className="spinner" style={{ borderTopColor: '#000' }}></span> MINTING...</span>
                                            : isConfirmed ? '✅ SBT BOUNTY ISSUED' : '🏆 MINT EVALUATED SBT'}
                                    </button>
                                ) : (
                                    <div className="alert alert-warning" style={{ fontSize: '0.82rem' }}>⚠ Connect wallet to mint.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right Column: Decrypted Vulnerabilities ─────────────────── */}
                <div>
                    {result && result.vulnerabilities && result.vulnerabilities.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {result.vulnerabilities.map((vuln: any, index: number) => (
                                <div
                                    key={index}
                                    className="card"
                                    style={{ borderColor: getSeverityColor(vuln.severity) }}
                                >
                                    {/* Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                        <h2 style={{ fontSize: '1.1rem', color: getSeverityColor(vuln.severity) }}>
                                            {vuln.vulnerability_name || 'Vulnerability Found'}
                                        </h2>
                                        <span className="severity-pill" style={{ borderColor: getSeverityColor(vuln.severity), color: getSeverityColor(vuln.severity) }}>
                                            {vuln.severity || 'UNKNOWN'} SEVERITY
                                        </span>
                                    </div>

                                    {/* Location */}
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <span className="code-label">// LOCATION</span>
                                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginTop: '0.4rem', padding: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '4px' }}>
                                            {vuln.file_path || 'Unknown File'}{vuln.line_number ? ` : Line ${vuln.line_number}` : ''}
                                        </p>
                                    </div>

                                    {/* Description */}
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <span className="code-label">// DESCRIPTION</span>
                                        <p style={{ fontSize: '0.9rem', lineHeight: '1.6', marginTop: '0.4rem', color: '#ccc' }}>{vuln.description}</p>
                                    </div>

                                    {/* Fix Suggestion */}
                                    {vuln.fix_suggestion && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            <span className="code-label" style={{ color: 'var(--success)' }}>// SUGGESTED FIX</span>
                                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', marginTop: '0.4rem', color: '#ccc' }}>{vuln.fix_suggestion}</p>
                                        </div>
                                    )}

                                    {/* ── Assign to Hacker ─────────────────────────── */}
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                        <span className="code-label" style={{ color: 'var(--primary)' }}>// ASSIGN TO HACKER</span>
                                        {/* Source Repo URL */}
                                        <input
                                            type="text"
                                            placeholder="https://github.com/owner/repo (source repo URL)"
                                            value={sourceRepoUrl[index] || ''}
                                            onChange={(e) => setSourceRepoUrl(u => ({ ...u, [index]: e.target.value }))}
                                            style={{
                                                width: '100%',
                                                marginTop: '0.5rem',
                                                marginBottom: '0.4rem',
                                                background: '#050810',
                                                border: '1px solid var(--border)',
                                                borderRadius: '4px',
                                                color: 'var(--text-primary)',
                                                padding: '0.5rem 0.75rem',
                                                fontFamily: 'JetBrains Mono, monospace',
                                                fontSize: '0.78rem',
                                                outline: 'none',
                                                boxSizing: 'border-box' as const,
                                            }}
                                            spellCheck={false}
                                            disabled={!ipfsUri}
                                        />
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                type="text"
                                                placeholder="github-username"
                                                value={assignTarget[index] || ''}
                                                onChange={(e) => setAssignTarget(t => ({ ...t, [index]: e.target.value }))}
                                                style={{
                                                    flex: 1,
                                                    background: '#050810',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-primary)',
                                                    padding: '0.55rem 0.75rem',
                                                    fontFamily: 'JetBrains Mono, monospace',
                                                    fontSize: '0.82rem',
                                                    outline: 'none',
                                                }}
                                                spellCheck={false}
                                                disabled={!ipfsUri}
                                            />
                                            <button
                                                onClick={() => handleAssign(index, vuln)}
                                                disabled={!assignTarget[index]?.trim() || !ipfsUri || assignedFlags[index]}
                                                style={{
                                                    padding: '0.55rem 1rem',
                                                    background: assignedFlags[index] ? 'rgba(80,250,123,0.15)' : 'rgba(189,147,249,0.1)',
                                                    border: `1px solid ${assignedFlags[index] ? 'var(--success)' : 'var(--primary)'}`,
                                                    borderRadius: '4px',
                                                    color: assignedFlags[index] ? 'var(--success)' : 'var(--primary)',
                                                    fontFamily: 'Orbitron, monospace',
                                                    fontSize: '0.7rem',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap' as const,
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                {assignedFlags[index] ? '✓ ASSIGNED' : 'ASSIGN'}
                                            </button>
                                        </div>
                                        {!ipfsUri && (
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                                ⓘ Decrypt a report first — the IPFS hash is used to link this issue.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5, borderStyle: 'dashed' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>AWAITING ENCRYPTED PAYLOAD</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
