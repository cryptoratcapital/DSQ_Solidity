const hre = require("hardhat");
const fs = require("fs");

// DSQ Address
const DSQ_ADDRESS = "0x760E31672fE489bE1d3cb3447FEB493d03BD55A0";

// esDSQ Address - CURRENTLY SET TO DSQ_ADDRESS JUST TO TEST. CHANGE
const ESDSQ_ADDRESS = "0x760E31672fE489bE1d3cb3447FEB493d03BD55A0";

// DSQStaking Address - CURRENTLY SET TO MULTISIG. CHANGE
const DSQSTAKING_ADDRESS = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

// esDSQStaking Address - CURRENTLY SET TO MULTISIG. CHANGE
const ESDSQSTAKING_ADDRESS = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

// DSQ Treasury Multisig
const DSQ_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const Router = await hre.ethers.getContractFactory("Router");
  const router = await Router.deploy(DSQ_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, DSQSTAKING_ADDRESS, ESDSQSTAKING_ADDRESS);
  await router.deployed();
  console.log("Contract deployed to: ", router.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: router.address,
    constructorArguments: [DSQ_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, DSQSTAKING_ADDRESS, ESDSQSTAKING_ADDRESS],
  };
  const FILENAME = "RouterDeployment.json";
  try {
    fs.writeFileSync("deployments/" + FILENAME, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/" + FILENAME);
  } catch (err) {
    console.log(err);
  }

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await router.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: router.address,
    constructorArguments: [DSQ_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, DSQSTAKING_ADDRESS, ESDSQSTAKING_ADDRESS],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
