import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/lib/Web3Provider";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Astraea | On-Chain Security Intelligence",
  description: "AI-powered smart contract auditing with Soulbound verification tokens",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Web3Provider>
          <Navbar />
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
