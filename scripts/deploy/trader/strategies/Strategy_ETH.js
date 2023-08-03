const hre = require("hardhat");
const fs = require("fs");
const { parseEther } = require("ethers/lib/utils");
const addressesAndParams = require("../../../../test/helpers/addressesAndParams.json");

const CHAIN = "arb_mainnet";
addresses = addressesAndParams[CHAIN].addresses;

// Constructor Arguments

const NAME = "ETH++";
const DSQ_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
const ALLOWED_TOKENS = [
  addresses.USDC,
  addresses.WETH,
  addresses.DAI,
  addresses.GMX,
  addresses.WBTC,
  addresses.INCH_ETHER_TOKEN,
  addresses.USDT,
];
const ALLOWED_SPENDERS = [
  addresses.GMX_ROUTER,
  addresses.GMX_POSITIONROUTER,
  addresses.GMX_ORDERBOOK,
  addresses.CAMELOT_ROUTER,
  addresses.AAVE_POOL,
  addresses.GMX_GLP_MANAGER,
  addresses.INCH_AGGREGATION_ROUTER,
  addresses.LYRA_LIQUIDITY_POOL_WETH,
  addresses.LYRA_WETH_OPTION_MARKET,
  addresses.RYSK_LIQUIDITY_POOL,
  addresses.RYSK_ALPHA_OPTION_HANDLER,
  addresses.TRADERJOE_LBROUTER,
  addresses.TRADERJOE_LEGACY_LBROUTER,
];
const initialPerformanceFee = parseEther("0.1"); // 10% fee
const initialManagementFee = parseEther("0.01"); // 1% fee

traderInitializerParams = [NAME, ALLOWED_TOKENS, ALLOWED_SPENDERS, initialPerformanceFee, initialManagementFee];

// Facet Addresses

TRADER_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
GMX_SWAP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
GMX_POSITIONROUTER_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
GMX_ORDER_BOOK_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
GMX_GLP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
CAMELOT_LP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
CAMELOT_NFTPOOL_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
CAMELOT_NITROPOOL_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
CAMELOT_SWAP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
CAMELOT_STORAGE_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
LYRA_STORAGE_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
LYRA_LP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
LYRA_OPTIONS_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
RYSK_LP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
RYSK_OPTIONS_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
AAVE_LENDING_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
TRADERJOE_SWAP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
TRADERJOE_LEGACY_LP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
TRADERJOE_LP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
INCH_SWAP_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
INCH_LIMITORDER_FACET = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
FACETS = [
  GMX_SWAP_FACET,
  GMX_POSITIONROUTER_FACET,
  GMX_ORDER_BOOK_FACET,
  GMX_GLP_FACET,
  CAMELOT_LP_FACET,
  CAMELOT_NFTPOOL_FACET,
  CAMELOT_NITROPOOL_FACET,
  CAMELOT_SWAP_FACET,
  CAMELOT_STORAGE_FACET,
  LYRA_STORAGE_FACET,
  LYRA_LP_FACET,
  LYRA_OPTIONS_FACET,
  RYSK_LP_FACET,
  RYSK_OPTIONS_FACET,
  AAVE_LENDING_FACET,
  TRADERJOE_SWAP_FACET,
  TRADERJOE_LEGACY_LP_FACET,
  TRADERJOE_LP_FACET,
  INCH_SWAP_FACET,
  INCH_LIMITORDER_FACET,
];

const assets = [addresses.DAI, addresses.USDC, addresses.USDT, addresses.WETH];

const oracles = [addresses.CHAINLINK_DAI_USD, addresses.CHAINLINK_USDC_USD, addresses.CHAINLINK_USDT_USD, addresses.CHAINLINK_WETH_USD];

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  const Strategy = await hre.ethers.getContractFactory("Strategy_ETH");
  const strategy = await Strategy.deploy(DSQ_MULTISIG, TRADER_FACET, traderInitializerParams, FACETS, assets, oracles);
  await strategy.deployed();
  console.log("Strategy_ETH deployed to: ", strategy.address);

  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: strategy.address,
    constructorArguments: [DSQ_MULTISIG, TRADER_FACET, traderInitializerParams, FACETS, assets, oracles],
  };
  const FILENAME = "StrategyETHDeployment.json";
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

// npx hardhat run scripts/deploy/trader/strategies/Strategy_ETH.js --network arbitrum
