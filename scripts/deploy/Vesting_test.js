const hre = require("hardhat");
const fs = require("fs");

// beneficiary addresses & amounts.
const HESSIANX_REVOKE_BENEFICIARIES = require("../../resources/beneficiaries.json");

const BENEFICIARIES = HESSIANX_REVOKE_BENEFICIARIES;

// MY GOERLI DSQ ADDRESS
const DSQ_ADDRESS = "0xCFCcfd23764F3544271D2fB69366c1834975eb04";

// DSQ Treasury Multisig
const DSQ_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

// 20th January 2023 00:00 UTC
const START_TIME = 1674172800;

// DURATION IS ONE YEAR FROM START_TIME
const DURATION = 365 * 24 * 3600;
const END_TIME = 1705708800;

async function main() {
  let deployments = [];

  // Get Signer & DSQToken Contract
  try {
    signer = await hre.ethers.getSigner();
    dsq = await hre.ethers.getContractAt("DSQToken", DSQ_ADDRESS);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  // End time check
  if (END_TIME != START_TIME + DURATION) {
    console.error("Incorrect DURATION and/or END_TIME");
    process.exit(1);
  }

  for (const beneficiary of BENEFICIARIES) {
    console.log(`Deploying vesting contract for ${beneficiary["address"]}...`);

    // Deploy the contract
    const Vesting = await hre.ethers.getContractFactory("TeamVesting");
    const vesting = await Vesting.deploy(beneficiary["address"], START_TIME, DURATION, DSQ_MULTISIG);
    await vesting.deployed();
    console.log("Contract deployed to: ", vesting.address);

    // Fund the contract
    console.log("Funding vesting contract with DSQ...");
    await dsq.connect(signer).transfer(vesting.address, BigInt(beneficiary["amount"]));
    console.log("Funded contract with ", beneficiary["amount"]);

    // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
    // I was getting errors with 5 so switched to 10
    console.log("Waiting for confirmations...");
    const txConfirmations = 10;
    await vesting.deployTransaction.wait(txConfirmations);

    // Verify the contract
    console.log("Verifying...");

    // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
    await hre.run("verify:verify", {
      address: vesting.address,
      constructorArguments: [beneficiary["address"], START_TIME, DURATION, DSQ_MULTISIG],
    });

    console.log("Verified");
    console.log("");
    deployments.push({ beneficiary: beneficiary["address"], contractAddress: vesting.address });
  }

  // MAKE SURE TO CHANGE OR PREVIOUS DATA COULD BE OVERWRITTEN
  const FILENAME = "test_vestingDeployments.json";
  try {
    fs.writeFileSync("resources/" + FILENAME, JSON.stringify(deployments));
    console.log("Deployment addresses written to resources/" + FILENAME);
  } catch (err) {
    console.log(err);
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
