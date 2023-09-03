const hre = require("hardhat");

async function main() {
  SelectorHelper = await hre.ethers.getContractFactory("SelectorHelper");
  selectorHelper = await SelectorHelper.deploy();

  await selectorHelper.lyraSelectors();
  await selectorHelper.traderJoeSelectors();
  await selectorHelper.inchSelectors();
  await selectorHelper.camelotV3Selectors();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
