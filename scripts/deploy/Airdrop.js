const hre = require("hardhat");

const PRIVATE_CONTRIBUTION_ADDRESS = "0xA28351C8F8Ae1Ac0748f47F5F3A791E809815207";
const multisig = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const Airdrop = await hre.ethers.getContractFactory("Airdrop");
  const airdrop = await Airdrop.deploy(PRIVATE_CONTRIBUTION_ADDRESS);
  await airdrop.deployed();
  console.log("Contract deployed to: ", airdrop.address);

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await airdrop.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");
  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...

  await hre.run("verify:verify", {
    address: airdrop.address,
    constructorArguments: [PRIVATE_CONTRIBUTION_ADDRESS],
  });

  await airdrop.transferOwnership(multisig);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// npx hardhat run scripts/deploy/Airdrop.js --network arbitrum
