const hre = require("hardhat");
const fs = require("fs");

const NAME = "Escrowed DSquared Governance Token";
const SYMBOL = "esDSQ";

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const Token = await hre.ethers.getContractFactory("esDSQToken");
  const token = await Token.deploy(NAME, SYMBOL);
  await token.deployed();
  console.log("Contract deployed to: ", token.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: token.address,
    constructorArguments: [NAME, SYMBOL],
  };
  const FILENAME = "esDSQDeployment.json";
  try {
    fs.writeFileSync("deployments/" + FILENAME, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/" + FILENAME);
  } catch (err) {
    console.log(err);
  }

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await token.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: token.address,
    constructorArguments: [NAME, SYMBOL],
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
