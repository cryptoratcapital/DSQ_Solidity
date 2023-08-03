const hre = require("hardhat");

// Constructor Arguments
const OWNER = "";
const TREASURY = "";
const DSQ = "";
const GENESIS = "";
const NORMAL = "";

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  NFTStaking = await hre.ethers.getContractFactory("NFTStaking");
  nft = await NFTStaking.deploy(OWNER, TREASURY, DSQ, GENESIS, NORMAL);
  await nft.deployed();
  console.log("Contract deployed to: ", nft.address);

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await nft.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: nft.address,
    constructorArguments: [OWNER, TREASURY, DSQ, GENESIS, NORMAL],
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
