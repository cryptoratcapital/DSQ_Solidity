const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther, formatEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { setBalance, loadFixture, reset } = require("@nomicfoundation/hardhat-network-helpers");
const { toBytes32, setStorageAt, getSlot, findBalanceSlot } = require("../../helpers/storageHelpers.js");
const addressesAndParams = require("../../helpers/addressesAndParams.json");
const { getNetworkConfig, forkOrSkip } = require("../../helpers/forkHelpers.js");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, feeReceiver] = provider.getWallets();

let forkConfigs = {
  arbitrum: {
    name: "arbitrum",
    url: process.env.ARBITRUM_URL || "https://rpc.ankr.com/arbitrum",
    blockNumber: 49777588,
    addresses: addressesAndParams["arb_mainnet"].addresses,
    parameters: addressesAndParams["arb_mainnet"].parameters,
  },
};

let forkConfig = getNetworkConfig(forkConfigs);

let traderInitializerParams;
if (forkConfig !== undefined) {
  addresses = forkConfig.addresses;
  USDC_SLOT = forkConfig.parameters.USDC_SLOT;
  DAI_SLOT = forkConfig.parameters.DAI_SLOT;

  const initialPerformanceFee = parseEther("0.1"); // 10% fee
  const initialManagementFee = parseEther("0.01"); // 1% fee

  const strategyDiamondName = "TestFixture_Strategy_Aave";
  const allowedTokens = [addresses.USDC, addresses.WETH, addresses.DAI, addresses.GMX, addresses.WBTC];
  const allowedSpenders = [
    addresses.GMX_ROUTER,
    addresses.GMX_POSITIONROUTER,
    addresses.GMX_ORDERBOOK,
    addresses.CAMELOT_ROUTER,
    addresses.AAVE_POOL,
  ];

  traderInitializerParams = [strategyDiamondName, allowedTokens, allowedSpenders, initialPerformanceFee, initialManagementFee];
}

const initialUSDCBalance = BigNumber.from(10000e6);
const initialWETHBalance = parseEther("100");

const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

async function deployStrategy() {
  TraderV0 = await ethers.getContractFactory("TraderV0");
  traderFacet = await TraderV0.deploy(maxPerformanceFee, maxManagementFee);

  AaveLendingFacet = await ethers.getContractFactory("Aave_Lending_Module");
  aaveLendingFacet = await AaveLendingFacet.deploy(addresses.AAVE_POOL);

  Strategy = await ethers.getContractFactory("TestFixture_Strategy_AaveModule");
  strategy = await Strategy.deploy(devWallet.address, traderFacet.address, traderInitializerParams, aaveLendingFacet.address);

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_Aave", strategy.address);
  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  AaveMath = await ethers.getContractFactory("TestFixture_AaveMathHelper");
  aaveMath = await AaveMath.deploy();

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  WETH = await ethers.getContractAt("IWETH", addresses.WETH);
  DAI = await ethers.getContractAt("TestFixture_ERC20", addresses.DAI);
  GMX = await ethers.getContractAt("TestFixture_ERC20", addresses.GMX);
  WBTC = await ethers.getContractAt("TestFixture_ERC20", addresses.WBTC);
  pool = await ethers.getContractAt("contracts/trader/external/aave_interfaces/IPool.sol:IPool", addresses.AAVE_POOL);

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "ETH++ Vault", "ETH-DSQ-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return { strategyDiamond, vault, test20, USDC, WETH, DAI, GMX, WBTC, pool, aaveMath };
}

describe("Aave Modules", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("Aave_Lending_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, pool, aaveMath } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      const daiIndex = getSlot(strategyDiamond.address, DAI_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setStorageAt(DAI.address, daiIndex, toBytes32(parseEther("100")));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, pool.address, initialUSDCBalance);

      reserveData = await pool.getReserveData(USDC.address);
      aToken = await ethers.getContractAt("TestFixture_ERC20", reserveData.aTokenAddress);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should supply", async function () {
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(10000e6);
      await expect(() =>
        strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, strategyDiamond.address, 0),
      ).to.changeTokenBalance(USDC, strategyDiamond, -10000e6);
      expect(await aToken.balanceOf(strategyDiamond.address)).to.eq(10000e6);
    });

    it("Should NOT execute ill-formed supply", async function () {
      await expect(
        strategyDiamond.connect(devWallet).aave_supply(test20.address, initialUSDCBalance, strategyDiamond.address, 0),
      ).to.be.revertedWith("Invalid token");
      await expect(
        strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, citizen1.address, 0),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should withdraw", async function () {
      await expect(() =>
        strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, strategyDiamond.address, 0),
      ).to.changeTokenBalance(USDC, strategyDiamond, -10000e6);
      expect(await aToken.balanceOf(strategyDiamond.address)).to.eq(10000e6);

      await expect(() =>
        strategyDiamond.connect(devWallet).aave_withdraw(USDC.address, initialUSDCBalance, strategyDiamond.address),
      ).to.changeTokenBalance(USDC, strategyDiamond, 10000e6);
    });

    it("Should NOT execute ill-formed withdraw", async function () {
      await expect(
        strategyDiamond.connect(devWallet).aave_withdraw(test20.address, initialUSDCBalance, strategyDiamond.address),
      ).to.be.revertedWith("Invalid token");
      await expect(strategyDiamond.connect(devWallet).aave_withdraw(USDC.address, initialUSDCBalance, citizen1.address)).to.be.revertedWith(
        "GuardError: Invalid recipient",
      );
    });

    it("Should borrow", async function () {
      reserveData = await pool.getReserveData(DAI.address);
      stableDebtToken = await ethers.getContractAt("IStableDebtToken", reserveData.stableDebtTokenAddress);
      await expect(() =>
        strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, strategyDiamond.address, 0),
      ).to.changeTokenBalance(USDC, strategyDiamond, -10000e6);

      await expect(() =>
        strategyDiamond.connect(devWallet).aave_borrow(DAI.address, parseEther("1"), 1, 0, strategyDiamond.address),
      ).to.changeTokenBalance(DAI, strategyDiamond, parseEther("1"));
      expect(await stableDebtToken.balanceOf(strategyDiamond.address)).to.eq(parseEther("1"));
    });

    it("Should NOT execute ill-formed borrow", async function () {
      await expect(
        strategyDiamond.connect(devWallet).aave_borrow(test20.address, initialUSDCBalance, 0, 0, strategyDiamond.address),
      ).to.be.revertedWith("Invalid token");
      await expect(
        strategyDiamond.connect(devWallet).aave_borrow(USDC.address, initialUSDCBalance, 0, 0, citizen1.address),
      ).to.be.revertedWith("GuardError: Invalid recipient");
      await expect(
        strategyDiamond.connect(devWallet).aave_borrow(USDC.address, initialUSDCBalance, 0, 0, strategyDiamond.address),
      ).to.be.revertedWith("33"); // INVALID_INTEREST_RATE_MODE_SELECTED
      await expect(strategyDiamond.connect(devWallet).aave_borrow(USDC.address, initialUSDCBalance, 3, 0, strategyDiamond.address)).to.be
        .reverted; // Invalid enum
    });

    it("Should NOT borrow more than allowed percentage of Aave LTV", async function () {
      reserveData = await pool.getReserveData(DAI.address);
      stableDebtToken = await ethers.getContractAt("IStableDebtToken", reserveData.stableDebtTokenAddress);
      await expect(() =>
        strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, strategyDiamond.address, 0),
      ).to.changeTokenBalance(USDC, strategyDiamond, -10000e6);
      await expect(
        strategyDiamond.connect(devWallet).aave_borrow(DAI.address, parseEther("7500"), 1, 0, strategyDiamond.address),
      ).to.be.revertedWith("Aave_Lending_Base: Borrow amount exceeds max LTV");
      await expect(strategyDiamond.connect(devWallet).aave_borrow(DAI.address, parseEther("5000"), 1, 0, strategyDiamond.address)).to.not.be
        .reverted;
    });

    it("Should repay", async function () {
      reserveData = await pool.getReserveData(DAI.address);
      stableDebtToken = await ethers.getContractAt("IStableDebtToken", reserveData.stableDebtTokenAddress);
      await strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, strategyDiamond.address, 0);
      await strategyDiamond.connect(devWallet).aave_borrow(DAI.address, parseEther("1"), 1, 0, strategyDiamond.address);

      await strategyDiamond.approve(DAI.address, pool.address, ethers.constants.MaxUint256);
      stableRate = await stableDebtToken.getUserStableRate(strategyDiamond.address);
      // Was two hardhat blocks, so can use timestamps 0 and 2 to get same result
      bal = BigNumber.from("0").sub(await aaveMath.getBalanceFromTimestamps(stableRate, parseEther("1"), 0, 2));

      await expect(() =>
        strategyDiamond.connect(devWallet).aave_repay(DAI.address, parseEther("2"), 1, strategyDiamond.address),
      ).to.changeTokenBalance(DAI, strategyDiamond, bal);
      expect(await stableDebtToken.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should NOT execute ill-formed repay", async function () {
      await expect(
        strategyDiamond.connect(devWallet).aave_repay(test20.address, initialUSDCBalance, 0, strategyDiamond.address),
      ).to.be.revertedWith("Invalid token");
      await expect(strategyDiamond.connect(devWallet).aave_repay(USDC.address, initialUSDCBalance, 0, citizen1.address)).to.be.revertedWith(
        "GuardError: Invalid recipient",
      );
    });

    it("Should swapBorrowRateMode", async function () {
      reserveData = await pool.getReserveData(DAI.address);
      stableDebtToken = await ethers.getContractAt("IStableDebtToken", reserveData.stableDebtTokenAddress);
      variableDebtToken = await ethers.getContractAt("TestFixture_ERC20", reserveData.variableDebtTokenAddress);
      await strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, strategyDiamond.address, 0);
      await strategyDiamond.connect(devWallet).aave_borrow(DAI.address, parseEther("1"), 1, 0, strategyDiamond.address);

      timestamp = (await ethers.provider.getBlock()).timestamp;
      stableRate = await stableDebtToken.getUserStableRate(strategyDiamond.address);
      bal = await aaveMath.getBalanceFromTimestamps(stableRate, parseEther("1"), timestamp, timestamp + 250);

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 250]);
      await expect(() => strategyDiamond.connect(devWallet).aave_swapBorrowRateMode(DAI.address, 1)).to.changeTokenBalance(
        variableDebtToken,
        strategyDiamond,
        bal,
      );
      expect(await stableDebtToken.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await variableDebtToken.balanceOf(strategyDiamond.address)).to.eq(bal);
    });

    it("Should NOT execute ill-formed swapBorrowRateMode", async function () {
      await expect(() =>
        strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, strategyDiamond.address, 0),
      ).to.changeTokenBalance(USDC, strategyDiamond, -10000e6);
      await expect(() =>
        strategyDiamond.connect(devWallet).aave_borrow(DAI.address, parseEther("1"), 1, 0, strategyDiamond.address),
      ).to.changeTokenBalance(DAI, strategyDiamond, parseEther("1"));

      await expect(strategyDiamond.connect(devWallet).aave_swapBorrowRateMode(test20.address, 1)).to.be.revertedWith("Invalid token");
      await expect(strategyDiamond.connect(devWallet).aave_swapBorrowRateMode(DAI.address, 0)).to.be.revertedWith("33"); // INVALID_INTEREST_RATE_MODE_SELECTED
      await expect(strategyDiamond.connect(devWallet).aave_swapBorrowRateMode(DAI.address, 3)).to.be.reverted; // Invalid enum
    });

    it("Should setUserEMode", async function () {
      reserveData = await pool.getReserveData(DAI.address);
      stableDebtToken = await ethers.getContractAt("IStableDebtToken", reserveData.stableDebtTokenAddress);
      await strategyDiamond.connect(devWallet).aave_supply(USDC.address, initialUSDCBalance, strategyDiamond.address, 0);
      await strategyDiamond.connect(devWallet).aave_borrow(DAI.address, parseEther("1"), 1, 0, strategyDiamond.address);

      expect(await pool.getUserEMode(strategyDiamond.address)).to.eq(0);
      await strategyDiamond.connect(devWallet).aave_setUserEMode(1);
      expect(await pool.getUserEMode(strategyDiamond.address)).to.eq(1);
    });

    it("Should NOT execute ill-formed setUserEMode", async function () {
      await expect(strategyDiamond.connect(devWallet).aave_setUserEMode(256)).to.be.reverted;
    });
  });

  describe("StrategyDiamondV0 Simluations", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, pool, aaveMath } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      const daiIndex = getSlot(strategyDiamond.address, DAI_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setStorageAt(DAI.address, daiIndex, toBytes32(parseEther("400")));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, pool.address, initialUSDCBalance);

      reserveData = await pool.getReserveData(USDC.address);
      aToken = await ethers.getContractAt("TestFixture_ERC20", reserveData.aTokenAddress);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    // Blocknumber: 49777588
    // https://openchain.xyz/trace/arbitrum/0xce636a6ca5b26e0eae80355cf80ea95bbd4c08e8427468ccc51a4235ae6c9cf2
    // https://openchain.xyz/trace/arbitrum/0x59b396f207cc168b4a2499bccff133495de849dc179930c5bfa645e670e55c53
    // https://openchain.xyz/trace/arbitrum/0xc101111a52582dc765d3211608059bd85d6f114fbeeaa792cacfa82eaa1cd60a
    it("Should supply, borrow & withdraw", async function () {
      reserveData = await pool.getReserveData(WBTC.address);
      variableDebtToken = await ethers.getContractAt("TestFixture_ERC20", reserveData.variableDebtTokenAddress);

      await expect(() =>
        strategyDiamond.connect(devWallet).aave_supply(USDC.address, 7000e6, strategyDiamond.address, 0),
      ).to.changeTokenBalance(USDC, strategyDiamond, -7000e6);
      expect(await aToken.balanceOf(strategyDiamond.address)).to.eq(7000e6);

      await expect(() =>
        strategyDiamond.connect(devWallet).aave_borrow(WBTC.address, 24900000, 2, 0, strategyDiamond.address),
      ).to.changeTokenBalance(WBTC, strategyDiamond, 24900000);
      expect(await WBTC.balanceOf(strategyDiamond.address)).to.eq(24900000);

      await expect(() =>
        strategyDiamond.connect(devWallet).aave_withdraw(USDC.address, 700e6, strategyDiamond.address),
      ).to.changeTokenBalance(USDC, strategyDiamond, 700e6);
    });
  });

  describe("Payable simulation", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, pool, aaveMath } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      const daiIndex = getSlot(strategyDiamond.address, DAI_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setStorageAt(DAI.address, daiIndex, toBytes32(parseEther("100")));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, pool.address, initialUSDCBalance);

      reserveData = await pool.getReserveData(USDC.address);
      aToken = await ethers.getContractAt("TestFixture_ERC20", reserveData.aTokenAddress);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should not supply with value", async function () {
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(10000e6);

      aave_supply_interface = new ethers.utils.Interface([
        "function aave_supply(address asset,uint256 amount, address onBehalfOf,uint16 referralCode) payable",
      ]);
      const calldata = aave_supply_interface.encodeFunctionData("aave_supply", [
        USDC.address,
        initialUSDCBalance,
        strategyDiamond.address,
        0,
      ]);
      await expect(devWallet.sendTransaction({ to: strategyDiamond.address, data: calldata, value: 1000 })).to.be.reverted;
    });
  });
});
