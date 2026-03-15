'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface NavbarProps {
    onNavigate?: (page: string) => void;
}

export default function Navbar() {
    return (
        <nav className="navbar">
            <div>
                <div className="nav-logo glitch">ASTRAEA</div>
                <div className="nav-subtitle">Security Intelligence Protocol</div>
            </div>
            <div className="nav-right">
                <a href="/scanner" className="nav-link">Scanner</a>
                <a href="/trust-graph" className="nav-link">Trust Graph</a>
                <a href="/org-dashboard" className="nav-link" style={{ color: '#ffb86c' }}>Org Portal</a>
                <a href="/profile" className="nav-link" style={{ color: '#8be9fd' }}>Hacker Profile</a>
                <ConnectButton
                    chainStatus="none"
                    showBalance={false}
                    accountStatus="address"
                />
            </div>
        </nav>
    );
}
