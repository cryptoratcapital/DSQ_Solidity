const hre = require("hardhat");

// Constructor Arguments
const OWNER = "";
const TREASURY = "";
const DSQ = "";
const LP = "";

async function main() {
  const account = await hre.ethers.getSigner();
  console.log("Deploying...");

  // Deploy the contract
  Staking = await hre.ethers.getContractFactory("StakingRewards");
  staking = await Staking.deploy(OWNER, TREASURY, DSQ, LP);
  await staking.deployed();
  console.log("Contract deployed to: ", staking.address);

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await staking.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: staking.address,
    constructorArguments: [OWNER, TREASURY, DSQ, LP],
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
