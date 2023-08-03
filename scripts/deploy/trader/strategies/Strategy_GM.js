const hre = require("hardhat");
const fs = require("fs");
const { parseEther } = require("ethers/lib/utils");
const addressesAndParams = require("../../../../test/helpers/addressesAndParams.json");

const CHAIN = "arb_mainnet";
addresses = addressesAndParams[CHAIN].addresses;

// Constructor Arguments

const NAME = "GM++";
const DSQ_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
const ALLOWED_TOKENS = [addresses.USDC, addresses.WETH];
const ALLOWED_SPENDERS = [addresses.GMX_ROUTER, addresses.GMX_POSITIONROUTER, addresses.GMX_ORDERBOOK];
const initialPerformanceFee = parseEther("0.1"); // 10% fee
const initialManagementFee = parseEther("0.01"); // 1% fee

traderInitializerParams = [NAME, ALLOWED_TOKENS, ALLOWED_SPENDERS, initialPerformanceFee, initialManagementFee];

// Facet Addresses

TRADER_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
GMX_SWAP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
GMX_POSITIONROUTER_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
GMX_ORDER_BOOK_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
FACETS = [GMX_SWAP_FACET, GMX_POSITIONROUTER_FACET, GMX_ORDER_BOOK_FACET];

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const Strategy = await hre.ethers.getContractFactory("Strategy_GM");
  const strategy = await Strategy.deploy(DSQ_MULTISIG, TRADER_FACET, traderInitializerParams, FACETS);
  await strategy.deployed();
  console.log("Strategy_GM deployed to: ", strategy.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: strategy.address,
    constructorArguments: [DSQ_MULTISIG, TRADER_FACET, traderInitializerParams, FACETS],
  };
  const FILENAME = "StrategyGMDeployment.json";
  try {
    fs.writeFileSync("deployments/strategies/" + FILENAME, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/strategies/" + FILENAME);
  } catch (err) {
    console.log(err);
  }

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await strategy.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", deploymentInfo);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// npx hardhat run scripts/deploy/trader/strategies/Strategy_GM.js --network arbitrum
