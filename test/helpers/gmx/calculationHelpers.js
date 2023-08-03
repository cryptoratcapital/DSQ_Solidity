const { BigNumber } = require("ethers");
const { parseUnits } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

module.exports = {
  calculateGLPPrice,
  calculateGLPMintOutput,
  calculateGLPBurnOutput,
  getGLPMintOutput,
  getGLPBurnOutput,
  getBuyUSDGOutput,
  getGLPPurchaseOutput,
  getSellUSDGOutput,
  getGLPRedeemOutput,
};

const GMX_PRICE_PRECISION = ethers.utils.parseUnits("1", 30);
const GMX_BASIS_POINTS = BigNumber.from(10000);
const GMX_USDG_DECIMALS = 18;

function calculateGLPPrice(aum, glpSupply) {
  return aum.div(glpSupply);
}

function calculateGLPMintOutput(usdgAmount, aum, glpSupply) {
  return usdgAmount.mul(glpSupply).div(aum);
}

function calculateGLPBurnOutput(glpAmount, aum, glpSupply) {
  return glpAmount.mul(aum).div(glpSupply);
}

async function getGLPMintOutput(usdgAmount, glpManager, glp) {
  const aum = await glpManager.getAumInUsdg(true);
  const totalSupply = await glp.totalSupply();
  return await calculateGLPMintOutput(usdgAmount, aum, totalSupply);
}

async function getGLPBurnOutput(glpAmount, glpManager, glp) {
  const aum = await glpManager.getAumInUsdg(false);
  const totalSupply = await glp.totalSupply();
  return await calculateGLPBurnOutput(glpAmount, aum, totalSupply);
}

async function getBuyUSDGOutput(vault, vaultUtils, tokenAddress, tokenDecimals, tokenAmount) {
  const price = await vault.getMinPrice(tokenAddress);
  let usdgAmount = tokenAmount.mul(price).div(GMX_PRICE_PRECISION);
  usdgAmount = usdgAmount.mul(parseUnits("1", GMX_USDG_DECIMALS)).div(parseUnits("1", tokenDecimals));

  const feeBasisPoints = await vaultUtils.getBuyUsdgFeeBasisPoints(tokenAddress, usdgAmount);
  const amountAfterFees = tokenAmount.mul(GMX_BASIS_POINTS.sub(feeBasisPoints)).div(GMX_BASIS_POINTS);
  let mintAmount = amountAfterFees.mul(price).div(GMX_PRICE_PRECISION);
  mintAmount = mintAmount.mul(parseUnits("1", GMX_USDG_DECIMALS)).div(parseUnits("1", tokenDecimals));

  return mintAmount;
}

async function getGLPPurchaseOutput(vault, vaultUtils, glpManager, glp, tokenAddress, tokenDecimals, tokenAmount) {
  const usdgAmount = await getBuyUSDGOutput(vault, vaultUtils, tokenAddress, tokenDecimals, tokenAmount);
  const glpAmount = await getGLPMintOutput(usdgAmount, glpManager, glp);
  return glpAmount;
}

async function getSellUSDGOutput(vault, vaultUtils, tokenAddress, usdgAmount) {
  const tokenAmount = await vault.getRedemptionAmount(tokenAddress, usdgAmount);

  const feeBasisPoints = await vaultUtils.getSellUsdgFeeBasisPoints(tokenAddress, usdgAmount);
  const amountAfterFees = tokenAmount.mul(GMX_BASIS_POINTS.sub(feeBasisPoints)).div(GMX_BASIS_POINTS);

  return amountAfterFees;
}

async function getGLPRedeemOutput(vault, vaultUtils, glpManager, glp, tokenAddress, glpAmount) {
  const usdgAmount = await getGLPBurnOutput(glpAmount, glpManager, glp);
  const tokenAmount = await getSellUSDGOutput(vault, vaultUtils, tokenAddress, usdgAmount);
  return tokenAmount;
}
