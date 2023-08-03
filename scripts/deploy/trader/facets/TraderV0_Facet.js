const hre = require("hardhat");
const fs = require("fs");
const { parseEther } = require("ethers/lib/utils");

const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const TraderFacet = await hre.ethers.getContractFactory("TraderV0");
  const traderFacet = await TraderFacet.deploy(maxPerformanceFee, maxManagementFee);
  await traderFacet.deployed();
  console.log("Trader facet deployed to: ", traderFacet.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: traderFacet.address,
    constructorArguments: [maxPerformanceFee, maxManagementFee],
  };
  const FILENAME = "TraderFacetDeployment.json";
  try {
    fs.writeFileSync("deployments/facets/" + FILENAME, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/facets/" + FILENAME);
  } catch (err) {
    console.log(err);
  }

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await traderFacet.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", deploymentInfo);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// npx hardhat run scripts/deploy/trader/facets/TraderV0_Facet.js --network arbitrum
