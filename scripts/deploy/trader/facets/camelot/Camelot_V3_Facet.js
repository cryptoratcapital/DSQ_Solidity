const hre = require("hardhat");
const fs = require("fs");
const addressesAndParams = require("../../../../../test/helpers/addressesAndParams.json");
addresses = addressesAndParams["arb_mainnet"].addresses;

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const CamelotV3Facet = await hre.ethers.getContractFactory("Camelot_V3_Module");
  const camelotV3Facet = await CamelotV3Facet.deploy(addresses.CAMELOT_POSITION_MANAGER, addresses.CAMELOT_ODOS_ROUTER);
  await camelotV3Facet.deployed();
  console.log("Camelot V3 facet deployed to: ", camelotV3Facet.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: camelotV3Facet.address,
    constructorArguments: [addresses.CAMELOT_POSITION_MANAGER, addresses.CAMELOT_ODOS_ROUTER],
  };
  const FILENAME = "CamelotV3FacetDeployment.json";
  try {
    fs.writeFileSync("deployments/facets/" + FILENAME, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/facets/" + FILENAME);
  } catch (err) {
    console.log(err);
  }

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await camelotV3Facet.deployTransaction.wait(txConfirmations);

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

// npx hardhat run scripts/deploy/trader/facets/camelot/Camelot_V3_Facet.js --network arbitrum
