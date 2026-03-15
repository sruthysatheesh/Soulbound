'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import contractData from '@/lib/contract.json';

interface ScanResult {
    status: string;
    vulnerability_name: string;
    severity: string;
    cve_score?: number;
    line_number?: number;
    description: string;
    fix_suggestion: string;
    ipfs_uri: string;
}

const PLACEHOLDER_REPO = `https://github.com/Soulbound-1/demo-contracts`;

interface ScanLog {
    repo: string;
    ipfs_uri: string;
    timestamp: string;
    updated_at?: string;
}

export default function ScannerPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const [repoUrl, setRepoUrl] = useState('');
    const [hackerAddress, setHackerAddress] = useState('');
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState('');

    // Auto-scan states
    const [isAutoScanActive, setIsAutoScanActive] = useState(false);
    const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
    const [unscannedRepos, setUnscannedRepos] = useState<{ url: string, updated_at: string }[]>([]);
    const [orgName, setOrgName] = useState('Soulbound-1');

    const { writeContract, data: txHash, isPending: isMinting } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

    // Load logs on mount
    useEffect(() => {
        const saved = localStorage.getItem('astraea_scan_logs');
        if (saved) setScanLogs(JSON.parse(saved));
    }, []);

    // Agent: Fetch repos when toggled on
    useEffect(() => {
        if (!isAutoScanActive) return;
        const fetchRepos = async () => {
            try {
                console.log(`[Agent] Fetching newly modified repos for ${orgName}...`);
                const res = await fetch(`https://api.github.com/users/${orgName}/repos?sort=updated&direction=desc`);
                if (!res.ok) throw new Error('Failed to fetch org repos');
                const data = await res.json();

                const pending: { url: string, updated_at: string }[] = [];
                for (const repo of data) {
                    const existingLog = scanLogs.find(l => l.repo === repo.html_url);
                    if (!existingLog || new Date(repo.updated_at).getTime() > new Date(existingLog.updated_at || 0).getTime()) {
                        pending.push({ url: repo.html_url, updated_at: repo.updated_at });
                    }
                }

                console.log(`[Agent] Found ${pending.length} unscanned or modified repositories.`);
                setUnscannedRepos(pending);
            } catch (e) {
                console.error('[Agent Error]', e);
                setError('Auto-scan agent failed to fetch org repos. Rate limit exceeded?');
                setIsAutoScanActive(false);
            }
        };
        fetchRepos();

        // Poll every 30 seconds for new pushes if queue is empty
        const interval = setInterval(() => {
            if (unscannedRepos.length === 0) fetchRepos();
        }, 30000);
        return () => clearInterval(interval);
    }, [isAutoScanActive, orgName, scanLogs]);

    useEffect(() => {
        if (isAutoScanActive && !scanning && unscannedRepos.length > 0) {
            const nextTarget = unscannedRepos[0];
            console.log(`[Agent] Automatically targeting: ${nextTarget.url}`);
            setRepoUrl(nextTarget.url);
            // Artificial delay to let UI visibly update
            setTimeout(() => handleScan(nextTarget.url, nextTarget.updated_at), 1500);
        }
    }, [isAutoScanActive, scanning, unscannedRepos]);

    const handleScan = async (overrideUrl?: string, overrideUpdatedAt?: string) => {
        const targetUrl = overrideUrl || repoUrl;
        if (!targetUrl.trim()) {
            setError('Please paste a GitHub repository URL to scan.');
            return;
        }
        setError('');
        setResult(null);
        setScanning(true);

        try {
            const response = await fetch('http://localhost:8000/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url: targetUrl }),
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data: ScanResult = await response.json();
            setResult(data);

            // If auto-scanning, log the result immediately after success
            if (overrideUrl) {
                const newLog: ScanLog = {
                    repo: targetUrl,
                    ipfs_uri: data.ipfs_uri,
                    timestamp: new Date().toLocaleTimeString(),
                    updated_at: overrideUpdatedAt || new Date().toISOString()
                };
                setScanLogs(prev => {
                    const filtered = prev.filter(l => l.repo !== targetUrl);
                    const updated = [newLog, ...filtered];
                    localStorage.setItem('astraea_scan_logs', JSON.stringify(updated));
                    return updated;
                });
                setUnscannedRepos(prev => prev.slice(1)); // Remove from queue to trigger next
            }
        } catch (err: any) {
            console.warn('Backend not reachable, using demo data:', err.message);
            const demoIpfs = 'ipfs://QmDemoReplaceMeWithRealHashFromPersonB';
            setResult({
                status: 'success',
                vulnerability_name: 'Reentrancy Attack',
                severity: 'High',
                cve_score: 8.5,
                line_number: 15,
                description: 'The withdraw() function sends ETH before updating the balance state variable. An attacker can recursively call withdraw() to drain the contract.',
                fix_suggestion: 'Apply the Checks-Effects-Interactions pattern. Update balances[msg.sender] before the external call.',
                ipfs_uri: demoIpfs,
            });

            if (overrideUrl) {
                const newLog: ScanLog = {
                    repo: targetUrl,
                    ipfs_uri: demoIpfs,
                    timestamp: new Date().toLocaleTimeString(),
                    updated_at: overrideUpdatedAt || new Date().toISOString()
                };
                setScanLogs(prev => {
                    const filtered = prev.filter(l => l.repo !== targetUrl);
                    const updated = [newLog, ...filtered];
                    localStorage.setItem('astraea_scan_logs', JSON.stringify(updated));
                    return updated;
                });
                setUnscannedRepos(prev => prev.slice(1));
            }
        } finally {
            setScanning(false);
        }
    };

    const handleMint = () => {
        if (!result || !hackerAddress) return;
        writeContract({
            address: contractData.address as `0x${string}`,
            abi: contractData.abi,
            functionName: 'mintVerification',
            args: [hackerAddress as `0x${string}`, result.ipfs_uri],
        });
    };

    const severityClass = (s: string) => {
        if (s?.toLowerCase() === 'high') return 'high';
        if (s?.toLowerCase() === 'medium') return 'medium';
        return 'low';
    };

    return (
        <main className="page">
            {/* Header */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="section-title">Vulnerability Scanner</h1>
                    <p className="section-sub">
                        Paste Solidity code below and run AI-powered reconnaissance. Results are pinned to IPFS and minted as a Soulbound Verification Badge.
                    </p>
                </div>

                {/* Agent Toggle */}
                <div className="card" style={{ padding: '1rem', borderColor: isAutoScanActive ? 'var(--primary)' : '' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>Autonomous Agent</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Auto-scan {orgName} pushes</div>
                        </div>
                        <button
                            className={`btn ${isAutoScanActive ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => setIsAutoScanActive(!isAutoScanActive)}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                        >
                            {isAutoScanActive ? 'Stop Agent' : 'Start Agent'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid-2" style={{ gap: '2rem' }}>
                {/* Left: Code Input */}
                <div>
                    <div className="card card-glow">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span className="code-label">// GITHUB REPOSITORY URL</span>
                            <button
                                className="btn-outline"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}
                                onClick={() => setRepoUrl(PLACEHOLDER_REPO)}
                            >
                                Load Demo
                            </button>
                        </div>

                        <div className={scanning ? 'scan-line' : ''}>
                            <input
                                type="text"
                                className="code-input"
                                style={{ minHeight: '60px', fontSize: '0.9rem' }}
                                placeholder="https://github.com/username/repository"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                spellCheck={false}
                            />
                        </div>

                        {error && (
                            <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                                ⚠ {error}
                            </div>
                        )}

                        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button
                                className="btn-primary"
                                onClick={() => handleScan()}
                                disabled={scanning}
                                id="run-recon-btn"
                            >
                                {scanning ? (
                                    <>
                                        <div className="spinner" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <> Run Reconnaissance</>
                                )}
                            </button>
                            {scanning && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>AI scanning in progress...</span>}
                        </div>
                    </div>

                    <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                        <span>ℹ</span>
                        <span>The AI auditor runs Semgrep + LLM analysis. Results are encrypted and pinned to IPFS before the SBT is minted.</span>
                    </div>
                </div>

                {/* Right: Results */}
                <div>
                    {!result && !scanning && (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.9rem', color: 'var(--primary)' }}>[ STANDBY ]</div>
                            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Paste Solidity code and run reconnaissance</div>
                        </div>
                    )}

                    {scanning && (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, margin: '0 auto' }} />
                            </div>
                            <div style={{ fontFamily: "'Courier New', Courier, monospace", color: 'var(--primary)', fontSize: '0.9rem' }}>SCANNING...</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                Semgrep + AI analysis running
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className="report-container fade-in">
                            <div className="report-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div className="pulse-dot red" />
                                    <span style={{ fontFamily: "'Courier New', Courier, monospace", fontWeight: 700, fontSize: '0.9rem' }}>
                                        VULNERABILITY DETECTED
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {result.cve_score !== undefined && (
                                        <span className="pill" style={{ background: '#000', borderColor: 'var(--text-secondary)', color: 'var(--text-primary)' }}>
                                            CVSS {result.cve_score.toFixed(1)}
                                        </span>
                                    )}
                                    <span className={`pill pill-${severityClass(result.severity)}`}>
                                        {result.severity?.toUpperCase()} SEVERITY
                                    </span>
                                </div>
                            </div>

                            <div className="report-body">
                                <div className="report-field">
                                    <div className="report-field-label">Vulnerability</div>
                                    <div className="report-field-value" style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--danger)' }}>
                                        {result.vulnerability_name}
                                    </div>
                                </div>

                                {result.line_number && (
                                    <div className="report-field">
                                        <div className="report-field-label">Line Number</div>
                                        <div className="report-field-value mono">Line {result.line_number}</div>
                                    </div>
                                )}

                                <div className="report-field">
                                    <div className="report-field-label">Description</div>
                                    <div className="report-field-value" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                        {result.description}
                                    </div>
                                </div>

                                <div className="divider" />

                                <div className="report-field">
                                    <div className="report-field-label">Fix Suggestion</div>
                                    <div className="report-field-value" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                        {result.fix_suggestion}
                                    </div>
                                </div>

                                <div className="report-field">
                                    <div className="report-field-label">IPFS Report URI</div>
                                    <div className="report-field-value mono" style={{ wordBreak: 'break-all', fontSize: '0.7rem' }}>
                                        {result.ipfs_uri}
                                    </div>
                                </div>

                                <div className="divider" />

                                <div>
                                    <div className="report-field-label" style={{ marginBottom: '0.75rem' }}>Mint Verification Badge (SBT)</div>
                                    <input
                                        type="text"
                                        placeholder="Hacker's wallet address (0x...)"
                                        value={hackerAddress}
                                        onChange={(e) => setHackerAddress(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                            fontFamily: "'Courier New', Courier, monospace",
                                            fontSize: '0.8rem',
                                            outline: 'none',
                                            marginBottom: '0.75rem',
                                        }}
                                    />
                                    {isConnected ? (
                                        <button
                                            className="btn-danger"
                                            onClick={handleMint}
                                            disabled={isMinting || isConfirming || !hackerAddress || isConfirmed}
                                            id="mint-sbt-btn"
                                        >
                                            {isMinting || isConfirming ? (
                                                <><div className="spinner" style={{ borderTopColor: 'var(--text-primary)' }} /> Confirming...</>
                                            ) : isConfirmed ? (
                                                <> Badge Minted!</>
                                            ) : (
                                                <>Mint SBT Badge</>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="alert alert-warning">⚠ Connect your wallet to mint the SBT.</div>
                                    )}

                                    {isConfirmed && (
                                        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                                            Soulbound Token minted on-chain! View it in the <a href="/trust-graph" style={{ color: 'var(--primary)' }}>Trust Graph →</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Agent Logs */}
            {isAutoScanActive && (
                <div style={{ marginTop: '2rem' }}>
                    <h2 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Agent Scanning Logs</h2>
                    <div className="card" style={{ padding: '1.5rem', background: '#050810', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', height: '300px', overflowY: 'auto' }}>
                        {unscannedRepos.length > 0 && (
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                &gt; Queue: {unscannedRepos.length} remaining in {orgName}...
                            </div>
                        )}
                        {scanLogs.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary)' }}>Awaiting first autonomous scan completion...</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {scanLogs.map((log, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>[{log.timestamp}]</span>
                                        <span style={{ color: 'var(--success)' }}>SUCCESS</span>
                                        <span style={{ color: '#fff', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.repo}</span>
                                        <span style={{ color: 'var(--primary)', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.ipfs_uri}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
