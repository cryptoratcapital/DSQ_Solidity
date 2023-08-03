const hre = require("hardhat");

const START_TIME = "1670745600"; // 8am 11th December 2022
const END_TIME = "1671264000"; // 8am 17th December 2022
const merkleRoot = "0x" + "8b4d42b6c8cdb9aff3c80bb5d9780238f86fcc9b7fefae6d1f0747d66a7a5360";
const prodDeploy = true;
const contractMultisig = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

async function main() {
  const [deployer] = await ethers.getSigners();
  const OWNER = deployer.address;

  const PrivateContribution = await hre.ethers.getContractFactory("PrivateContribution");

  // Deploy the contract
  console.log("Deploying...");
  const pc = await PrivateContribution.deploy(OWNER, START_TIME, END_TIME);

  await pc.deployed();
  console.log("Contract deployed to", pc.address);

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  console.log("confirming deployment");
  const txConfirmations = 5;
  await pc.deployTransaction.wait(txConfirmations);
  console.log(`deployment confirmed`);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  try {
    await hre.run("verify:verify", {
      address: pc.address,
      constructorArguments: [OWNER, START_TIME, END_TIME],
    });
    console.log("contract verified");
  } catch (error) {
    if (error.message.includes("Reason: Already Verified")) {
      console.log("contract already verified");
    } else {
      console.log(error);
    }
  }

  console.log("setting merkle root");
  await pc.setMerkleRoot(merkleRoot);
  console.log("merkle root set");

  if (prodDeploy) {
    console.log("transferring ownership to multisig");
    await pc.transferOwnership(contractMultisig);
    console.log("contract transferred");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// npx hardhat run scripts/deploy/PrivateContribution.js --network goerli
// npx hardhat run scripts/deploy/PrivateContribution.js --network arbitrum
