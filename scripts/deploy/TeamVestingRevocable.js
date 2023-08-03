const hre = require("hardhat");
const fs = require("fs");

// beneficiary addresses & amounts.
const HESSIANX_REVOKE_BENEFICIARIES = require("../../resources/vesting_22_03_2023/unlockLinear/revocableBeneficiaries-2023-03-22.json");

const BENEFICIARIES = HESSIANX_REVOKE_BENEFICIARIES;

// DSQ Address
const DSQ_ADDRESS = "0xdb0C6fC9E01cD95eb1d3bbAe6689962De489cD7B";

// DSQ Treasury Multisig
const DSQ_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

// 20th January 2023 00:00 UTC
const ACCUMULATION_START_TIME = 1674172800;

// Friday, July 21, 2023 12:00:00 PM
const OTC_UNLOCK = 1689940800;

// VESTING BEGINS ONE YEAR FROM START_TIME
const ACCUMULATION_DURATION = 365 * 24 * 3600;
const START_TIME = 1705708800;

const VESTING_DURATION = 182.5 * 24 * 3600;

//Saturday, July 20, 2024 12:00:00 PM
const VESTING_END_TIME = 1721476800;

async function main() {
  let deployments = [];

  // Get Signer & DSQToken Contract
  try {
    signer = await hre.ethers.getSigner();
    console.log(`Using ${signer.address} to deploy`);
    dsq = await hre.ethers.getContractAt("DSQToken", DSQ_ADDRESS);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  // End time check
  if (START_TIME != ACCUMULATION_START_TIME + ACCUMULATION_DURATION || VESTING_END_TIME != START_TIME + VESTING_DURATION) {
    console.error("Incorrect DURATION and/or END_TIME");
    process.exit(1);
  }

  for (const beneficiary of BENEFICIARIES) {
    console.log(`Deploying vesting contract for ${beneficiary["address"]}...`);

    // Deploy the contract
    const Vesting = await hre.ethers.getContractFactory("TeamVestingRevocable");
    const vesting = await Vesting.deploy(
      beneficiary["address"],
      ACCUMULATION_START_TIME,
      OTC_UNLOCK,
      START_TIME,
      VESTING_DURATION,
      DSQ_MULTISIG,
    );
    await vesting.deployed();
    console.log("Contract deployed to: ", vesting.address);

    // // Fund the contract
    // console.log("Funding vesting contract with DSQ...");
    // await dsq.connect(signer).transfer(vesting.address, BigInt(beneficiary["dsqAmount"]));
    // console.log("Funded contract with ", beneficiary["dsqAmount"]);

    // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
    // I was getting errors with 5 so switched to 10
    console.log("Waiting for confirmations...");
    const txConfirmations = 10;
    await vesting.deployTransaction.wait(txConfirmations);

    // // Verify the contract
    console.log("Verifying...");

    // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
    await hre.run("verify:verify", {
      address: beneficiary["contractAddress"],
      constructorArguments: [beneficiary["address"], ACCUMULATION_START_TIME, OTC_UNLOCK, START_TIME, VESTING_DURATION, DSQ_MULTISIG],
    });

    console.log("Verified");
    console.log("");
    deployments.push({ contractAddress: vesting.address, beneficiary: beneficiary["address"], amount: beneficiary["dsqAmount"] });
  }

  // MAKE WANT TO CHANGE FILENAME
  const FILENAME = "2023-03-22-TeamVestingRevocableDeployments.json";
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
