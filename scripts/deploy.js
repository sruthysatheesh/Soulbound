const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("🚀 Deploying AstraeaSBT with account:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");

    const AstraeaSBT = await hre.ethers.getContractFactory("AstraeaSBT");
    const contract = await AstraeaSBT.deploy();

    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("✅ AstraeaSBT deployed to:", address);

    // Save the contract address and ABI for the frontend
    const artifact = hre.artifacts.readArtifactSync("AstraeaSBT");
    const exportData = {
        address: address,
        abi: artifact.abi,
        deployer: deployer.address,
        network: hre.network.name,
    };

    const outputDir = path.join(__dirname, "..", "astraea-frontend", "src", "lib");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
        path.join(outputDir, "contract.json"),
        JSON.stringify(exportData, null, 2)
    );

    console.log("📄 Contract data saved to astraea-frontend/src/lib/contract.json");

    console.log("\n--- Hardhat Test Wallets (import these into MetaMask!) ---");
    const signers = await hre.ethers.getSigners();
    for (let i = 0; i < 5; i++) {
        const bal = await hre.ethers.provider.getBalance(signers[i].address);
        console.log(`Wallet ${i}: ${signers[i].address} — ${hre.ethers.formatEther(bal)} ETH`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
