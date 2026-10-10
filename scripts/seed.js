const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("====================================================");
  console.log("  TrustFund: Seeding Local Blockchain with Demo Data");
  console.log("====================================================");

  const [deployer, creator1, creator2, backer1, backer2] = await hre.ethers.getSigners();

  // 1. Deploy TrustFund contract
  const TrustFund = await hre.ethers.getContractFactory("TrustFund");
  const trustFund = await TrustFund.deploy();
  await trustFund.waitForDeployment();

  const contractAddress = await trustFund.getAddress();
  console.log(`\n[1/4] Contract Deployed: ${contractAddress}`);

  // 2. Export ABI and Address to Frontend
  const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const artifact = await hre.artifacts.readArtifact("TrustFund");
  const contractData = {
    address: contractAddress,
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    abi: artifact.abi,
  };

  fs.writeFileSync(
    path.join(contractsDir, "TrustFundContract.json"),
    JSON.stringify(contractData, null, 2)
  );
  console.log("[2/4] ABI and Address synced with frontend/src/contracts/TrustFundContract.json");

  // 3. Create Campaign 1 (In FUNDING Stage)
  console.log("\n[3/4] Creating Campaign #1 (Funding Phase)...");
  const tx1 = await trustFund.connect(creator1).createCampaign(
    "Decentralized Clean Water IoT Monitoring",
    "Open-source sensor hardware monitoring ground-water contamination and anchoring telemetry data onto Ethereum.",
    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
    hre.ethers.parseEther("3.0"),
    30,
    [40, 30, 30],
    [
      "Phase 1: Sensor Hardware Prototype & Lab Calibration",
      "Phase 2: Pilot Deployment (25 Well Monitoring Nodes)",
      "Phase 3: Public Dashboard & Open API Launch",
    ]
  );
  await tx1.wait();

  // Backer 1 contributes 1.2 ETH
  await trustFund.connect(backer1).contribute(1, {
    value: hre.ethers.parseEther("1.2"),
  });
  console.log("  -> Campaign #1 created and backed with 1.2 ETH (40% funded)");

  // 4. Create Campaign 2 (In ACTIVE Stage with Milestone in Voting)
  console.log("\n[4/4] Creating Campaign #2 (Active Milestone Phase)...");
  const tx2 = await trustFund.connect(creator2).createCampaign(
    "OpenSource Medical AI Diagnostics Hub",
    "Federated AI models for early pulmonary detection with privacy-preserving zero-knowledge proofs.",
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
    hre.ethers.parseEther("2.0"),
    15,
    [30, 40, 30],
    [
      "Milestone 1: Anonymized Clinical CT Dataset Collection",
      "Milestone 2: Multi-center Federated Model Training",
      "Milestone 3: Web Portal & Clinical Trial Evaluation",
    ]
  );
  await tx2.wait();

  // Backers fully fund Campaign #2 (2.0 ETH total) to activate it
  await trustFund.connect(backer1).contribute(2, {
    value: hre.ethers.parseEther("1.2"),
  });
  await trustFund.connect(backer2).contribute(2, {
    value: hre.ethers.parseEther("0.8"),
  });
  console.log("  -> Campaign #2 reached 100% funding target (2.0 ETH) -> State: ACTIVE");

  // Creator submits Milestone 1 proof
  await trustFund.connect(creator2).submitMilestoneProof(
    2,
    0,
    "https://github.com/med-ai-hub/dataset-ct-v1/releases/tag/v1.0.0"
  );
  console.log("  -> Milestone 1 proof submitted by Creator2 -> State: UNDER REVIEW (Voting Open)");

  // Backer 1 casts an approval vote (holds 1.2 ETH out of 2.0 ETH = 60% > 50% threshold)
  // This triggers instant consensus approval!
  await trustFund.connect(backer1).voteOnMilestone(2, 0, true);
  console.log("  -> Backer 1 voted YES (1.2 ETH stake) -> Auto-resolved to APPROVED!");

  console.log("\n====================================================");
  console.log("  Seeding Complete! Local Blockchain is Ready.");
  console.log("====================================================");
  console.log("Useful Hardhat Test Accounts for MetaMask:");
  console.log("----------------------------------------------------");
  console.log("Account #0 (Deployer/Admin):");
  console.log("  Address:    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  console.log("  Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  console.log("\nAccount #1 (Creator 1):");
  console.log("  Address:    0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  console.log("  Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  console.log("\nAccount #2 (Creator 2):");
  console.log("  Address:    0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  console.log("  Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
  console.log("\nAccount #3 (Backer 1):");
  console.log("  Address:    0x90F79bf6EB2c4f870365E785982E1f101E93b906");
  console.log("  Private Key: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
  console.log("====================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
