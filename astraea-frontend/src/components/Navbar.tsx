'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
    { href: '/scanner', label: 'Scanner' },
    { href: '/org-dashboard', label: 'Org Portal' },
    { href: '/profile', label: 'Profile' },
    { href: '/trust-graph', label: 'Trust Graph' },
];

export default function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="navbar">
            <Link href="/" style={{ textDecoration: 'none' }}>
                <div className="nav-brand">
                    <div className="nav-logo glitch">SoulBound</div>
                    <div className="nav-subtitle">Security Intelligence Protocol</div>
                </div>
            </Link>

            <div className="nav-right">
                {NAV_LINKS.map(({ href, label }) => (
                    <Link
                        key={href}
                        href={href}
                        className={`nav-link${pathname === href ? ' active' : ''}`}
                    >
                        {label}
                    </Link>
                ))}
                <ConnectButton
                    chainStatus="none"
                    showBalance={false}
                    accountStatus="address"
                />
            </div>
        </nav>
    );
}
