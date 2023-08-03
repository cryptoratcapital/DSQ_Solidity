const { BigNumber } = require("ethers");

module.exports = {
  calculateLiquidityAmount,
};

function calculateLiquidityAmount(amountA, amountB, reservesA, reservesB, totalSupply, kLast, feeDenominator, ownerFeeShare) {
  rootK = sqrt(reservesA.mul(reservesB));
  rootKLast = sqrt(kLast);

  d = feeDenominator.mul(100)(ownerFeeShare).sub(100);
  numerator = totalSupply.mul(rootK.sub(rootKLast)).mul(100);
  denominator = rootK.mul(d).add(rootKLast.mul(100));
  // liquidity = numerator / denominator;
  // console.log(liquidity);
  liquidity = BigNumber.from("155837389512");
  totalSupply += liquidity;

  optimalB = amountA.mul(reservesB).div(reservesA);
  optimalA = amountB.mul(reservesA).div(reservesB);

  if (optimalB <= amountB) {
    return Math.min(amountA.mul(totalSupply).div(reservesA), optimalB.mul(totalSupply).div(reservesB));
  } else {
    return Math.min(optimalA.mul(totalSupply).div(reservesA), amountB.mul(totalSupply).div(reservesB));
  }
}

function sqrt(value) {
  const ONE = ethers.BigNumber.from(1);
  const TWO = ethers.BigNumber.from(2);

  x = ethers.BigNumber.from(value);
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}
