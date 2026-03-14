# Astraea Protocol: Web3 & Frontend Documentation

This document outlines the architecture, tech stack, and implementation details for the **Web3 and Frontend portion (Person A's Domain)** of the Astraea hackathon project.

---

## 🛠 Tech Stack (Person A)

*   **Frontend Framework:** Next.js (App Router) + React
*   **Styling:** Tailwind CSS + Custom CSS (Cyberpunk/Dark Mode theme)
*   **Web3 Integration:** Wagmi, Viem, and RainbowKit
*   **Smart Contracts:** Solidity (`^0.8.20`)
*   **Contract Libraries:** OpenZeppelin Contracts (v4)
*   **Blockchain Dev Environment:** Hardhat (Local Node) + Ethers.js
*   **Typography:** Google Fonts (Orbitron, Inter, JetBrains Mono)

---

## 🏗 Architecture & Implementation

### 1. Smart Contract: `AstraeaSBT.sol`
The core on-chain component is a **Soulbound Token (SBT)** deployed on the local Hardhat network (Chain ID: 31337).

*   **Standard:** `ERC721URIStorage` supplemented with `Ownable`.
*   **Soulbound Mechanism:** We enforce the non-transferable nature of the token by overriding OpenZeppelin v4's `_beforeTokenTransfer` hook. The contract reverts any transaction where `from` and `to` are not the zero address (allowing minting and burning, but strictly blocking peer-to-peer transfers).
*   **Minting Function:**
    ```solidity
    function mintVerification(address hacker, string memory ipfsURI) public onlyOwner { ... }
    ```
    This function is restricted to the contract owner (the protocol deployer). It binds a unique IPFS Content Identifier (CID) containing the AI vulnerability report to the specific token minted to the hacker's wallet.

### 2. Blockchain Environment (Hardhat)
To avoid testnet API rate limits and faucet dependencies, the project runs on a local Hardhat node.

*   **Node & Deployment:** The `npx hardhat node` runs locally on `http://127.0.0.1:8545`. 
*   **Automated Handoff:** The deployment script (`scripts/deploy.js`) automatically exports the compiled `ABI` and the resulting `Contract Address` directly into the Next.js frontend directory (`src/lib/contract.json`). This ensures the frontend is always pointing to the correct, freshly deployed local contract.

### 3. Frontend Application (Next.js)
The Web3 App serves two primary user paths: analyzing a contract and viewing hacker verifications.

#### Web3 Provider (`src/lib/Web3Provider.tsx`)
*   Configures **Wagmi** and **RainbowKit** to connect exclusively to the `hardhatLocal` custom chain.
*   Enables standard MetaMask connections specifically routed to the local developer RPC environment.

#### View 1: The Scanner Dashboard (`src/app/page.tsx`)
*   **Purpose:** The primary Reconnaissance interface.
*   **Implementation:**
    *   Provides a monospaced code editor logic for pasting vulnerable Solidity contracts.
    *   Initiates a `POST` request to Person B's Python/FastAPI backend (`http://localhost:8000/api/scan`).
    *   Displays a structured, stylized vulnerability report (Severity, Vulnerability Name, Line Number, IPFS hash).
    *   Includes a Web3 transaction gate: Once the report is generated, the `mint-sbt-btn` unlocks. It utilizes Wagmi's `useWriteContract` to call the `mintVerification` function on the smart contract, natively prompting the user's MetaMask extension to sign the transaction.

#### View 2: The Trust Graph (`src/app/trust-graph/page.tsx`)
*   **Purpose:** The visual representation of a hacker's on-chain pedigree.
*   **Implementation:**
    *   Wallet-gated: Prompts the user to connect their MetaMask.
    *   Reads the connected wallet's address and queries the `AstraeaSBT` contract using Wagmi's `useReadContract` to check their `balanceOf`.
    *   *(Note: Pending full GraphQL/TheGraph implementation, this view currently verifies token balance and displays the UI framework for the parsed IPFS metadata tokens).*

### 4. UI/UX Design System (`src/app/globals.css`)
*   Fully custom CSS overriding default Next.js templates.
*   Features a dark mode base (`#080b14`), glowing primary accents (`#00d4ff`), and specific severity color coding (High: Red, Medium: Orange, Low: Green).
*   Includes CSS-native DOM animations (e.g., the `.scan-line` vertical sweeping animation and pulsing dots) to simulate terminal hacking without relying on heavy JavaScript animation libraries.

---

## 🔄 Integration Points with Person B (Backend/AI)

The frontend explicitly expects Person B's API to conform to the following JSON structure when returning from the `/api/scan` endpoint:

```json
{
  "status": "success",
  "vulnerability_name": "String",
  "severity": "High | Medium | Low",
  "line_number": 15,
  "description": "String",
  "fix_suggestion": "String",
  "ipfs_uri": "ipfs://Qm..."
}
```
The `ipfs_uri` string from this JSON payload is passed directly as an argument into the `useWriteContract` hook to mint the SBT on the blockchain.
