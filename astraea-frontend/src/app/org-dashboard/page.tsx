'use client';

import { useState } from 'react';

export default function OrgDashboard() {
    const [ipfsUri, setIpfsUri] = useState('');
    const [privateKey, setPrivateKey] = useState('');
    const [decrypting, setDecrypting] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState('');

    const handleDecrypt = async () => {
        if (!ipfsUri.trim() || !privateKey.trim()) {
            setError('Please provide both the IPFS URI and the Organization Private Key.');
            return;
        }
        setError('');
        setResult(null);
        setDecrypting(true);

        try {
            // Call the Python backend decryption endpoint
            const response = await fetch('http://localhost:8000/decrypt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ipfs_uri: ipfsUri,
                    private_key_pem: privateKey
                }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || `API error: ${response.status}`);
            }

            setResult(data.report);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to decrypt payload. Are you sure you have the correct key?');
        } finally {
            setDecrypting(false);
        }
    };

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
                <p style={{ color: 'var(--text-muted)' }}>Secure Zero-Day Payload Decryption Terminal</p>
            </div>

            <div className="grid">
                {/* Left: Inputs */}
                <div>
                    <div className="card card-glow" style={{ borderColor: '#ffb86c', boxShadow: '0 0 15px rgba(255, 184, 108, 0.1)' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <span className="code-label" style={{ color: '#ffb86c' }}>// IPFS PAYLOAD URI</span>
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
                            <span className="code-label" style={{ color: '#ffb86c' }}>// ORGANIZATION PRIVATE KEY (RSA .pem)</span>
                            <textarea
                                className="code-input"
                                placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQ...&#10;-----END PRIVATE KEY-----"
                                value={privateKey}
                                onChange={(e) => setPrivateKey(e.target.value)}
                                spellCheck={false}
                                style={{ height: '200px', fontSize: '0.7rem' }}
                            />
                        </div>

                        {error && (
                            <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                                ⚠ {error}
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '1.5rem', background: 'rgba(255, 184, 108, 0.1)', borderColor: '#ffb86c', color: '#ffb86c' }}
                            onClick={handleDecrypt}
                            disabled={decrypting}
                        >
                            {decrypting ? (
                                <span><span className="spinner"></span> DECRYPTING PAYLOAD...</span>
                            ) : (
                                '🔓 DECRYPT ZERO-DAY REPORT'
                            )}
                        </button>
                    </div>
                </div>

                {/* Right: Decrypted Result */}
                <div>
                    {result && result.vulnerabilities && result.vulnerabilities.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {result.vulnerabilities.map((vuln: any, index: number) => (
                                <div key={index} className="card" style={{ borderColor: getSeverityColor(vuln.severity), animation: index === 0 ? 'pulse-border 2s infinite' : 'none' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                        <h2 style={{ fontSize: '1.2rem', color: getSeverityColor(vuln.severity) }}>
                                            {vuln.vulnerability_name || "Vulnerability Found"}
                                        </h2>
                                        <span className="severity-pill" style={{
                                            borderColor: getSeverityColor(vuln.severity),
                                            color: getSeverityColor(vuln.severity)
                                        }}>
                                            {vuln.severity || "UNKNOWN"} SEVERITY
                                        </span>
                                    </div>

                                    <div style={{ marginBottom: '1rem' }}>
                                        <span className="code-label">// LOCATION</span>
                                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '4px' }}>
                                            {vuln.file_path || "Unknown File"}
                                            {vuln.line_number ? ` : Line ${vuln.line_number}` : ""}
                                        </p>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <span className="code-label">// DESCRIPTION</span>
                                        <p style={{ fontSize: '0.95rem', lineHeight: '1.6', marginTop: '0.5rem', color: '#ccc' }}>
                                            {vuln.description}
                                        </p>
                                    </div>

                                    {vuln.fix_suggestion && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            <span className="code-label" style={{ color: 'var(--success)' }}>// SUGGESTED FIX</span>
                                            <p style={{ fontSize: '0.95rem', lineHeight: '1.6', marginTop: '0.5rem', color: '#ccc' }}>
                                                {vuln.fix_suggestion}
                                            </p>
                                        </div>
                                    )}
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
