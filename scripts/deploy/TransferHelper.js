const hre = require("hardhat");
const fs = require("fs");

// DSQ Treasury Multisig
const DSQ_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const Helper = await hre.ethers.getContractFactory("TransferHelper");
  const helper = await Helper.deploy(DSQ_MULTISIG);
  await helper.deployed();
  console.log("Contract deployed to: ", helper.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: helper.address,
    constructorArguments: [DSQ_MULTISIG],
  };
  const FILENAME = "TransferHelper.json";
  try {
    fs.writeFileSync("deployments/" + FILENAME, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/" + FILENAME);
  } catch (err) {
    console.log(err);
  }

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await helper.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: helper.address,
    constructorArguments: [DSQ_MULTISIG],
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
