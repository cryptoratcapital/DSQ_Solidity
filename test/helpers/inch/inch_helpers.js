const { BigNumber } = require("ethers");

module.exports = {
  convertToUint256Address,
  convertAPIDataToParams,
};
/**
 * KEY
 * 0x0....address -> token0 to token1, no unwrap weth
 * 0x8....address -> token1 to token0, no unwrap weth
 * 0x3...address -> token0 to token1, unwrap weth
 * 0xa...address -> token1 to token0, unwrap weth
 *
 * with msg.value same rules as above but wraps weth first
 */
function convertToUint256Address(zeroToOne, unwrap, address) {
  const a = BigNumber.from("0xa000000000000000000000000000000000000000000000000000000000000000");
  const eight = BigNumber.from("0x8000000000000000000000000000000000000000000000000000000000000000");
  const three = BigNumber.from("0x3000000000000000000000000000000000000000000000000000000000000000");
  if (zeroToOne && unwrap) {
    // 0x3...address
    return three.add(address);
  } else if (zeroToOne) {
    // 0x0...address
    return address;
  } else if (unwrap) {
    // 0xa...address
    return a.add(address);
  } else {
    // 0x8...address
    return eight.add(address);
  }
}

function convertAPIDataToParams(apiData) {
  selector = apiData.substring(2, 10);
  parseData = apiData.substring(0, 2) + apiData.substring(10);

  // swap
  if (selector == "12aa3caf") {
    return ethers.utils.defaultAbiCoder.decode(
      [
        "address executor",
        "tuple(address srcToken, address dstToken, address srcReceiver, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags) desc",
        "bytes permit",
        "bytes data",
      ],
      parseData,
    );
  }
  // uniswapV3Swap
  else if (selector == "e449022e") {
    return ethers.utils.defaultAbiCoder.decode(["uint256 amount", "uint256 minReturn", "uint256[] pools"], parseData);
  }
  // unoswap (I can't find one transaction with this function)
  else if (selector == "0502b1c5") {
    return ethers.utils.defaultAbiCoder.decode(["address srcToken", "uint256 amount", "uint256 minReturn", "uint256[] pools"], parseData);
  }
  // clipperSwap
  else if (selector == "84bd6d29") {
    return ethers.utils.defaultAbiCoder.decode(
      [
        "address clipperExchange",
        "address srcToken",
        "address dstToken",
        "uint256 inputAmount",
        "uint256 outputAmount",
        "uint256 goodUntil",
        "bytes32 r",
        "bytes32 vs",
      ],
      parseData,
    );
  }
  // error
  else {
    console.log(`Error: unknown 1Inch selector passed: ${selector}`);
  }
}
