const hre = require("hardhat");
const fs = require("fs");

// Constructor Arguments
const NAME_GLP_AVAX = "avax-glp++";
const SYMBOL_GLP_AVAX = "avaxGlp++";
const TRADER_GLP_AVAX = "0x025eE90FD50B992fFC4c5344e30F3f81A6B23252";
const MAX_DEPOSITS_GLP_AVAX = "17600000000";

const NAME_GLP_ARB = "GLP++";
const SYMBOL_GLP_ARB = "GLP++";
const TRADER_GLP_ARB = "0x025eE90FD50B992fFC4c5344e30F3f81A6B23252";
const MAX_DEPOSITS_GLP_ARB = "20000000000";

const NAME_GAPEX = "arb-g-apex-eth";
const SYMBOL_GAPEX = "G-APEx";
const TRADER_GAPEX = "0x1B96DA7985544fD65f4E173Ff2ED038160836dFd";
const MAX_DEPOSITS_GAPEX = "2600000000";

const NAME_ETH = "ETH++";
const SYMBOL_ETH = "ETH++";
const TRADER_ETH = "0x4e182B2176992f5fa6a178BDEe1d1160396974Fe";
const MAX_DEPOSITS_ETH = "10000000000";

const NAME_USDC_AVAX = "USDC++";
const SYMBOL_USDC_AVAX = "USDC++";
const TRADER_USDC_AVAX = "0xAAF27874215c561495A55B1212703f689d035a83";
const MAX_DEPOSITS_USDC_AVAX = "10000000000";

const NAME_USDC_ARB = "USDC++";
const SYMBOL_USDC_ARB = "USDC++";
const TRADER_USDC_ARB = "0xAAF27874215c561495A55B1212703f689d035a83";
const MAX_DEPOSITS_USDC_ARB = "15000000000";

const NAME_ARB_ARB = "ARB++";
const SYMBOL_ARB_ARB = "ARB++";
const TRADER_ARB_ARB = "0x4e182B2176992f5fa6a178BDEe1d1160396974Fe";
const MAX_DEPOSITS_ARB_ARB = "10000000000";

// Multisig Address to transfer Ownerhip
const multiSig_GLP_AVAX = "0xFc8f272Ca554822B52d30A30e969B0536bd1a101";
const multiSig_GLP_ARB = "0x5250eE4b4928932e3D9Ae4a7874fA9c33Dafe3Cf";
const multiSig_GAPEX = "0x5250eE4b4928932e3D9Ae4a7874fA9c33Dafe3Cf";
const multiSig_ETH = "0x5250eE4b4928932e3D9Ae4a7874fA9c33Dafe3Cf";
const multiSig_USDC_AVAX = "0xFc8f272Ca554822B52d30A30e969B0536bd1a101";
const multiSig_USDC_ARB = "0x5250eE4b4928932e3D9Ae4a7874fA9c33Dafe3Cf";
const multiSig_ARB_ARB = "0x5250eE4b4928932e3D9Ae4a7874fA9c33Dafe3Cf";

// Vault Asset Address
const AVALANCHE_USDC = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
const ARBITRUM_USDC = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";

// Whitelist Address
const ratTestAddress = "0x8EbFC950776fAF2eaAc66f767ca083aA88f320Cb";
const lucaTestAdress = "0xDd51221f1218B8d1897e161Ce2Cc2ec8A1139230";

// Epoch Times
const fundingStart = 1680314400;
const epochStart = 1680336000;
const epochEnd = 1685088000;

const TOKEN = ARBITRUM_USDC;
const NAME = NAME_USDC_ARB;
const SYMBOL = SYMBOL_USDC_ARB;
const TRADER = TRADER_USDC_ARB;
const MAX_DEPOSITS = MAX_DEPOSITS_USDC_ARB;
const multisig = multiSig_USDC_ARB;
const FILENAME = "VaultV0-ARB-USDC++.json";

// Proudction Deployment
const prodDeploy = true;

// Deployed Contract address
const contractAddress = "";

async function main() {
  // Deploy the contract or attach an already-deployed one
  Vault = await hre.ethers.getContractFactory("VaultV0");
  if (contractAddress === "") {
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with address ${deployer.address}`);
    vault = await Vault.deploy(TOKEN, NAME, SYMBOL, TRADER, MAX_DEPOSITS);
    await vault.deployed();
    console.log("Contract deployed to: ", vault.address);
    // Write address and constructor arguments to json file
    let deploymentInfo = {
      address: vault.address,
      constructorArguments: [TOKEN, NAME, SYMBOL, TRADER, MAX_DEPOSITS],
      whitelistedAddresses: [ratTestAddress, lucaTestAdress],
    };
    try {
      fs.writeFileSync("deployments/" + FILENAME, JSON.stringify(deploymentInfo));
      console.log("Deployment information written to deployments/" + FILENAME);
    } catch (err) {
      console.log(err);
    }
    // // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
    // const txConfirmations = 5;
    // await vault.deployTransaction.wait(txConfirmations);
  } else {
    console.log("Attaching...");
    vault = await Vault.attach(contractAddress);
  }

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: vault.address,
    constructorArguments: [TOKEN, NAME, SYMBOL, TRADER, MAX_DEPOSITS],
  });

  // Configure the contract

  // epoch times
  console.log("setting epoch times");
  await vault.startEpoch(fundingStart, epochStart, epochEnd);

  // whitelist addresses
  console.log("whitelisting addresses which can deposit");
  await vault.setWhitelistStatus(ratTestAddress, true);
  await vault.setWhitelistStatus(lucaTestAdress, true);

  if (prodDeploy) {
    // transfer ownership to multisig
    console.log("transfer ownership to prod multisig");
    await vault.transferOwnership(multisig);
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

// npx hardhat run scripts/deploy/VaultV0.js --network avax
// npx hardhat run scripts/deploy/VaultV0.js --network arbitrum
