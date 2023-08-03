const hre = require("hardhat");
const fs = require("fs");

// beneficiary addresses & amounts.
const HESSIANX_NONREVOKE_BENEFICIARIES = require("../../resources/vesting_15_05_2023/nonrevocableBeneficiaries-2023-05-15.json");

const BENEFICIARIES = HESSIANX_NONREVOKE_BENEFICIARIES;

// Monday, May 1, 2023 12:00:00 AM
const START_TIME = 1682899200;

const VESTING_DURATION = 245 * 24 * 3600;

// Monday, January 1, 2024 12:00:00 AM
const VESTING_END_TIME = 1704067200;

async function main() {
  let deployments = [];

  // Get Signer & DSQToken Contract
  try {
    signer = await hre.ethers.getSigner();
    console.log(`Using ${signer.address} to deploy`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  // End time check
  if (VESTING_END_TIME != START_TIME + VESTING_DURATION) {
    console.error("Incorrect DURATION and/or END_TIME");
    process.exit(1);
  }

  for (const beneficiary of BENEFICIARIES) {
    console.log(`Deploying vesting contract for ${beneficiary["address"]}...`);

    // Deploy the contract
    const Vesting = await hre.ethers.getContractFactory("VestingWallet");
    const vesting = await Vesting.deploy(beneficiary["address"], START_TIME, VESTING_DURATION);
    await vesting.deployed();
    console.log("Contract deployed to: ", vesting.address);

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
      constructorArguments: [beneficiary["address"], START_TIME, VESTING_DURATION],
    });

    console.log("Verified");
    console.log("");
    deployments.push({ contractAddress: vesting.address, beneficiary: beneficiary["address"], amount: beneficiary["dsqAmount"] });
  }

  // MAY WANT TO CHANGE FILENAME
  const FILENAME = "2023-05-15-VestingWalletDeployments.json";
  try {
    fs.writeFileSync("deployments/vesting/" + FILENAME, JSON.stringify(deployments));
    console.log("Deployment addresses written to deployments/vesting/" + FILENAME);
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
