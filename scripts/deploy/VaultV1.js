const hre = require("hardhat");

// USDC addresses. Make sure to change in the deploy parameters and in the verify parameters
const GOERLI_USDC = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F";
const MAINNET_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Constructor Arguments
const NAME = "USDC Vault";
const SYMBOL = "DSQ-USDC-V1";
// CHANGE BEFORE DEPLOYING. Currently set to Pickle's burner
const TRADER = "0x718C68764b0AecD0f2314DCA536C633A5577498a";
const MAX_DEPOSITS = 1e12;

async function main() {
  console.log("Deploying...");

  // Deploy the contract
  Vault = await hre.ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(GOERLI_USDC, NAME, SYMBOL, TRADER, MAX_DEPOSITS);
  await vault.deployed();
  console.log("Contract deployed to: ", vault.address);

  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await vault.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: vault.address,
    constructorArguments: [GOERLI_USDC, NAME, SYMBOL, TRADER, MAX_DEPOSITS],
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
