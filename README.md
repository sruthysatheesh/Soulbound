# SOULBOUND

**Intelligent Security Auditing & Decentralized Trust Graph**

Soulbound is an AI-powered security ecosystem designed to secure the future of software development. It combines autonomous vulnerability detection with a verifiable, on-chain reputation system for security researchers.

---

##  Overview

In a world where security breaches cost billions, Soulbound bridges the gap between organizations and white-hat hackers. 

- **Autonomous Recognition**: AI agents that scan repositories in real-time as code is pushed.
- **Secure Disclosure**: Encrypted reporting ensures vulnerabilities are shared only with the right hands.
- **On-Chain Reputation**: Verified discoveries are minted as **Soulbound Tokens (SBTs)**, creating a permanent, non-transferable record of a researcher's skill.

---

## Key Features

### AI-Powered Reconnaissance
Our specialized AI agent, **TheBugHunter**, combines static analysis (Semgrep) with advanced LLM reasoning to identify complex logic flaws, access control issues, and hidden vulnerabilities that traditional scanners miss.

### Zero-Day Shield
Vulnerability reports are encrypted using organization-specific public keys and stored on IPFS. Organizations use their private keys to safely decrypt and act on these findings.

### Trust Graph
A visual representation of a researcher's on-chain pedigree. Every verified hunter has a "Trust Tree" rooted at their wallet address, branching out into verified discoveries (SBTs).

### Developer Fingerprinting
Advanced similarity analysis ensures that patch creators are the legitimate owners of the fix, preventing reputation theft in the bug bounty ecosystem.

---

## Technical Architecture

### Frontend (Next.js)
- **Framework**: Next.js 15+ (App Router)
- **Web3**: Wagmi + Viem + RainbowKit
- **3D Visuals**: React Three Fiber + Three.js for immersive scanning effects.
- **Styling**: Cyberpunk-themed custom CSS with high-contrast navy/blue accents.

### Backend (Python/FastAPI)
- **AI Agents**: Multi-agent system powered by OpenAI/Groq (Llama 3 models).
- **Security Tools**: Semgrep integrated for base static analysis.
- **Cryptography**: Fernet (AES) + RSA for secure report handling.
- **Storage**: Pinata (IPFS) for decentralized metadata storage.

### Blockchain (Solidity)
- **Smart Contract**: `AstraeaSBT.sol` (ERC721-based Soulbound Token).
- **Network**: Local Hardhat Node (Chain ID: 31337).

---

## Repository Structure

```
├── astraea-frontend/   # Next.js Web App
├── astraea-backend/    # FastAPI Server & AI Logic
├── contracts/          # Solidity Smart Contracts
├── agents/             # Dedicated AI Agent logic & prompts
├── tools/              # IPFS, Cloner, and Scanner utilities
└── scripts/            # Deployment & Maintenance scripts
```

---

##  Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MetaMask Browser Extension

### 2. Local Blockchain Setup
```bash
# In the root directory
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### 3. Backend Setup
```bash
cd astraea-backend
pip install -r requirements.txt
# Configure your .env (LLM keys, IPFS keys)
uvicorn main:app --reload
```

### 4. Frontend Setup
```bash
cd astraea-frontend
npm install
npm run dev
```



