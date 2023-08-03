const hre = require("hardhat");

const GMX_USD_PRECISION = hre.ethers.utils.parseUnits("1", 30);

async function main() {
  const numToParse = hre.ethers.BigNumber.from("20720700000000000000000000000000");
  console.log(numToParse / GMX_USD_PRECISION);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
