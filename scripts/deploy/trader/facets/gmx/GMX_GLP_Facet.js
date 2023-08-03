const hre = require("hardhat");
const fs = require("fs");
const addressesAndParams = require("../../../../../test/helpers/addressesAndParams.json");
addresses = addressesAndParams["arb_mainnet"].addresses;

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const GMXGLPFacet = await hre.ethers.getContractFactory("GMX_GLP_Module");
  const gmxGLPFacet = await GMXGLPFacet.deploy(addresses.GMX_GLP_REWARDROUTER, addresses.GMX_GMX_REWARDROUTER);
  await gmxGLPFacet.deployed();
  console.log("GMX GLP Facet facet deployed to: ", gmxGLPFacet.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: gmxGLPFacet.address,
    constructorArguments: [addresses.GMX_GLP_REWARDROUTER, addresses.GMX_GMX_REWARDROUTER],
  };
  const FILENAME = "GMXGLPFacetDeployment.json";
  try {
    fs.writeFileSync("deployments/facets/" + FILENAME, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/facets/" + FILENAME);
  } catch (err) {
    console.log(err);
  }

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await gmxGLPFacet.deployTransaction.wait(txConfirmations);

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

// npx hardhat run scripts/deploy/trader/facets/gmx/GMX_GLP_Facet.js --network arbitrum
