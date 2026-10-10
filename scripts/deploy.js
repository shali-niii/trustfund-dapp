const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("----------------------------------------------------");
  console.log("Deploying TrustFund smart contract...");

  const TrustFund = await hre.ethers.getContractFactory("TrustFund");
  const trustFund = await TrustFund.deploy();
  await trustFund.waitForDeployment();

  const contractAddress = await trustFund.getAddress();
  console.log(`TrustFund deployed successfully to: ${contractAddress}`);
  console.log("----------------------------------------------------");

  // Export ABI and address for seamless frontend integration
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

  console.log(`Saved ABI and deployment address to frontend/src/contracts/TrustFundContract.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
