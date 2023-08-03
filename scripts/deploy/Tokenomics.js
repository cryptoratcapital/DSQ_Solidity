const hre = require("hardhat");
const fs = require("fs");

// DSQ Address
const DSQ_ADDRESS = "0xdb0C6fC9E01cD95eb1d3bbAe6689962De489cD7B";

// esDSQ Address
const ESDSQ_ADDRESS = "0xF76d53dE08C53B891E291D870e543BF8A0F6D314";

// DSQ Treasury Multisig
const TREASURY_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";
const OPS_MULTISIG = "0x1EFBB80987EeBb9F778a3e0Ad0AEeeA3e1A9db0E";

async function main() {
  console.log("Deploying...");

  // Deploy DSQStaking
  const DSQStaking = await hre.ethers.getContractFactory("DSQStaking");
  const dsqStaking = await DSQStaking.deploy(OPS_MULTISIG, OPS_MULTISIG, ESDSQ_ADDRESS, DSQ_ADDRESS);
  await dsqStaking.deployed();
  console.log("DSQStaking Contract deployed to: ", dsqStaking.address);

  const dsqStakingConstructorArgs = [OPS_MULTISIG, OPS_MULTISIG, ESDSQ_ADDRESS, DSQ_ADDRESS];
  writeDeploymentToFile("DSQStakingDeployment.json", dsqStaking.address, dsqStakingConstructorArgs);

  // Deploy esDSQStaking
  const ESDSQStaking = await hre.ethers.getContractFactory("esDSQStaking");
  const esdsqStaking = await ESDSQStaking.deploy(OPS_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, dsqStaking.address);
  await esdsqStaking.deployed();
  console.log("esDSQStaking Contract deployed to: ", esdsqStaking.address);

  const esdsqStakingConstructorArgs = [OPS_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, dsqStaking.address];
  writeDeploymentToFile("esDSQStakingDeployment.json", esdsqStaking.address, esdsqStakingConstructorArgs);

  // Deploy Router
  const Router = await hre.ethers.getContractFactory("Router");
  const router = await Router.deploy(OPS_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, dsqStaking.address, esdsqStaking.address);
  await router.deployed();
  console.log("Router Contract deployed to: ", router.address);

  const routerConstructorArgs = [OPS_MULTISIG, DSQ_ADDRESS, ESDSQ_ADDRESS, dsqStaking.address, esdsqStaking.address];
  writeDeploymentToFile("RouterDeployment.json", router.address, routerConstructorArgs);

  // Verify contracts
  await verifyContract(dsqStaking, dsqStakingConstructorArgs);
  await verifyContract(esdsqStaking, esdsqStakingConstructorArgs);
  await verifyContract(router, routerConstructorArgs);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// Write deployment information to file
function writeDeploymentToFile(filename, address, argumentData) {
  // Write address and constructor arguments to json file
  let deploymentInfo = {
    address: address,
    constructorArguments: argumentData,
  };
  try {
    fs.writeFileSync("deployments/" + filename, JSON.stringify(deploymentInfo));
    console.log("Deployment information written to deployments/" + filename);
  } catch (err) {
    console.log(err);
  }
}

// Verify contract on etherscan
async function verifyContract(contract, argumentData) {
  // We have to wait for a few block confirmations to make sure Etherscan will pick up the bytecode.
  const txConfirmations = 5;
  await contract.deployTransaction.wait(txConfirmations);

  // Verify the contract
  console.log("Verifying...");

  // This runs the hardhat task, you can call this via CLI with npx hardhat verify ...
  await hre.run("verify:verify", {
    address: contract.address,
    constructorArguments: argumentData,
  });
}
