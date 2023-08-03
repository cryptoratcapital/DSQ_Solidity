const hre = require("hardhat");
const fs = require("fs");
const { parseEther } = require("ethers/lib/utils");
const addressesAndParams = require("../../test/helpers/addressesAndParams.json");

const CHAIN = "arb_mainnet";
const addresses = addressesAndParams[CHAIN].addresses;

// Constructor Arguments

const NAME = "GM++";
const ADMIN = "0x5250eE4b4928932e3D9Ae4a7874fA9c33Dafe3Cf";
const ALLOWED_TOKENS = [addresses.USDC, addresses.WETH];
const ALLOWED_SPENDERS = [addresses.GMX_ROUTER, addresses.GMX_POSITIONROUTER, addresses.GMX_ORDERBOOK];
const initialPerformanceFee = parseEther("0.1"); // 10% fee
const initialManagementFee = parseEther("0.01"); // 1% fee
const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

// Proudction Deployment
const prodDeploy = false;

// Deployed Contract address
const contractAddress = "";

const FILENAME = "arb-test-Strategy_GM.json";

async function main() {
  // Deploy the contract or attach an already-deployed one
  Strategy = await hre.ethers.getContractFactory("Strategy_GM");
  if (contractAddress === "") {
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with address ${deployer.address}`);
    strategy = await Strategy.deploy(
      NAME,
      ALLOWED_TOKENS,
      ALLOWED_SPENDERS,
      ADMIN,
      initialPerformanceFee,
      initialManagementFee,
      maxPerformanceFee,
      maxManagementFee,
      addresses.GMX_ROUTER,
      addresses.GMX_POSITIONROUTER,
      addresses.GMX_ORDERBOOK,
    );
    await strategy.deployed();
    console.log("Contract deployed to: ", strategy.address);

    // Write address and constructor arguments to json file
    let deploymentInfo = {
      address: strategy.address,
      constructorArguments: [
        NAME,
        ALLOWED_TOKENS,
        ALLOWED_SPENDERS,
        ADMIN,
        initialPerformanceFee,
        initialManagementFee,
        maxPerformanceFee,
        maxManagementFee,
        addresses.GMX_ROUTER,
        addresses.GMX_POSITIONROUTER,
        addresses.GMX_ORDERBOOK,
      ],
    };

    try {
      fs.writeFileSync("deployments/" + FILENAME, JSON.stringify(deploymentInfo));
      console.log("Deployment information written to deployments/" + FILENAME);
    } catch (err) {
      console.log(err);
    }

    if (prodDeploy) {
      // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
      const txConfirmations = 5;
      await strategy.deployTransaction.wait(txConfirmations);

      // Verify the contract
      console.log("Verifying...");

      // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
      await hre.run("verify:verify", {
        address: strategy.address,
        constructorArguments: [
          NAME,
          ALLOWED_TOKENS,
          ALLOWED_SPENDERS,
          ADMIN,
          initialPerformanceFee,
          initialManagementFee,
          maxPerformanceFee,
          maxManagementFee,
          addresses.GMX_ROUTER,
          addresses.GMX_POSITIONROUTER,
          addresses.GMX_ORDERBOOK,
        ],
      });
    }
  } else {
    console.log("Attaching...");
    strategy = await Strategy.attach(contractAddress);
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

// npx hardhat run scripts/deploy/Strategy_GM.js --network avax
// npx hardhat run scripts/deploy/Strategy_GM.js --network arbitrum
