const hre = require("hardhat");
const fs = require("fs");

// DSQ Address
const DSQ_ADDRESS = "0x760E31672fE489bE1d3cb3447FEB493d03BD55A0";

// esDSQ Address - CURRENTLY SET TO DSQ_ADDRESS JUST TO TEST. CHANGE
const ESDSQ_ADDRESS = "0x760E31672fE489bE1d3cb3447FEB493d03BD55A0";

// DSQStaking Address - CURRENTLY SET TO MULTISIG. CHANGE
const DSQSTAKING_ADDRESS = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

// DSQ Treasury Multisig
const DSQ_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const ESDSQStaking = await hre.ethers.getContractFactory("esDSQStaking");
  const esdsqStaking = await ESDSQStaking.deploy(DSQ_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, DSQSTAKING_ADDRESS);
  await esdsqStaking.deployed();
  console.log("Contract deployed to: ", esdsqStaking.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: esdsqStaking.address,
    constructorArguments: [DSQ_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, DSQSTAKING_ADDRESS],
  };
  const FILENAME = "esDSQStakingDeployment.json";
  try {
    fs.writeFileSync("deployments/" + FILENAME, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/" + FILENAME);
  } catch (err) {
    console.log(err);
  }

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await esdsqStaking.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: esdsqStaking.address,
    constructorArguments: [DSQ_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, DSQSTAKING_ADDRESS],
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
