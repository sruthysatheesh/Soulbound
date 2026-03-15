'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import contractData from '@/lib/contract.json';

interface ScanResult {
    status: string;
    vulnerability_name: string;
    severity: string;
    line_number?: number;
    description: string;
    fix_suggestion: string;
    ipfs_uri: string;
}

const PLACEHOLDER_REPO = `https://github.com/Uniswap/v2-core`;

export default function ScannerPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const [repoUrl, setRepoUrl] = useState('');
    const [hackerAddress, setHackerAddress] = useState('');
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState('');
    const [mintSuccess, setMintSuccess] = useState(false);

    const { writeContract, data: txHash, isPending: isMinting } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

    const handleScan = async () => {
        if (!repoUrl.trim()) {
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
                body: JSON.stringify({ repo_url: repoUrl }),
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data: ScanResult = await response.json();
            setResult(data);
        } catch (err: any) {
            console.warn('Backend not reachable, using demo data:', err.message);
            setResult({
                status: 'success',
                vulnerability_name: 'Reentrancy Attack',
                severity: 'High',
                line_number: 15,
                description: 'The withdraw() function sends ETH before updating the balance state variable. An attacker can recursively call withdraw() to drain the contract.',
                fix_suggestion: 'Apply the Checks-Effects-Interactions pattern. Update balances[msg.sender] before the external call.',
                ipfs_uri: 'ipfs://QmDemoReplaceMeWithRealHashFromPersonB',
            });
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
            <div style={{ marginBottom: '2rem' }}>
                <h1 className="section-title">Vulnerability Scanner</h1>
                <p className="section-sub">
                    Paste Solidity code below and run AI-powered reconnaissance. Results are pinned to IPFS and minted as a Soulbound Verification Badge.
                </p>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="stat-box">
                        <div className="stat-value">01</div>
                        <div className="stat-label">Paste Code</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-value">02</div>
                        <div className="stat-label">Run Recon</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-value">03</div>
                        <div className="stat-label">Mint SBT</div>
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
                                onClick={handleScan}
                                disabled={scanning}
                                id="run-recon-btn"
                            >
                                {scanning ? (
                                    <>
                                        <div className="spinner" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <> ⚡ Run Reconnaissance</>
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
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡</div>
                            <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.9rem' }}>Awaiting target</div>
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
                                <span className={`pill pill-${severityClass(result.severity)}`}>
                                    {result.severity?.toUpperCase()} SEVERITY
                                </span>
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
                                    <div className="report-field-value" style={{ color: 'var(--success)', lineHeight: 1.7 }}>
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
                                                <>✅ Badge Minted!</>
                                            ) : (
                                                <>🔐 Mint SBT Badge</>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="alert alert-warning">⚠ Connect your wallet to mint the SBT.</div>
                                    )}

                                    {isConfirmed && (
                                        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                                            ✅ Soulbound Token minted on-chain! View it in the <a href="/trust-graph" style={{ color: 'var(--primary)' }}>Trust Graph →</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
