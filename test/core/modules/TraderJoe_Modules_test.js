const { expect, use } = require("chai");
const { solidity, deployMockContract } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther, formatEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { setBalance, loadFixture, reset } = require("@nomicfoundation/hardhat-network-helpers");
const { toBytes32, setStorageAt, getSlot, findBalanceSlot } = require("../../helpers/storageHelpers.js");
const addressesAndParams = require("../../helpers/addressesAndParams.json");
const { getNetworkConfig, forkOrSkip } = require("../../helpers/forkHelpers.js");

use(solidity);
require("dotenv").config();

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, feeReceiver] = provider.getWallets();

let forkConfigs = {
  arbitrum: {
    name: "arbitrum",
    url: process.env.ARBITRUM_URL || "https://rpc.ankr.com/arbitrum",
    blockNumber: 78658479,
    addresses: addressesAndParams["arb_mainnet"].addresses,
    parameters: addressesAndParams["arb_mainnet"].parameters,
  },
};

let forkConfig = getNetworkConfig(forkConfigs);

let traderInitializerParams;
if (forkConfig !== undefined) {
  addresses = forkConfig.addresses;
  USDC_SLOT = forkConfig.parameters.USDC_SLOT;
  WBTC_SLOT = forkConfig.parameters.WBTC_SLOT;

  const initialPerformanceFee = parseEther("0.1"); // 10% fee
  const initialManagementFee = parseEther("0.01"); // 1% fee

  const strategyDiamondName = "TestFixture_Strategy_TraderJoe";
  const allowedTokens = [addresses.USDC, addresses.WETH, addresses.DAI, addresses.GMX, addresses.WBTC];
  const allowedSpenders = [
    addresses.GMX_ROUTER,
    addresses.GMX_POSITIONROUTER,
    addresses.GMX_ORDERBOOK,
    addresses.CAMELOT_ROUTER,
    addresses.TRADERJOE_LBROUTER,
    addresses.TRADERJOE_LEGACY_LBROUTER,
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

  TraderJoeSwapFacet = await ethers.getContractFactory("TraderJoe_Swap_Module");
  traderJoeSwapFacet = await TraderJoeSwapFacet.deploy(addresses.TRADERJOE_LBROUTER);

  TraderJoeLegacyLPFacet = await ethers.getContractFactory("TraderJoe_Legacy_LP_Module");
  traderJoeLegacyLPFacet = await TraderJoeLegacyLPFacet.deploy(addresses.TRADERJOE_LEGACY_LBROUTER, addresses.TRADERJOE_LEGACY_LBFACTORY);

  TraderJoeLPFacet = await ethers.getContractFactory("TraderJoe_LP_Module");
  traderJoeLPFacet = await TraderJoeLPFacet.deploy(addresses.TRADERJOE_LBROUTER, addresses.TRADERJOE_LBFACTORY);

  Strategy = await ethers.getContractFactory("TestFixture_Strategy_TraderJoe");
  strategy = await Strategy.deploy(
    devWallet.address,
    traderFacet.address,
    traderInitializerParams,
    traderJoeSwapFacet.address,
    traderJoeLegacyLPFacet.address,
    traderJoeLPFacet.address,
  );

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_TraderJoe", strategy.address);
  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  DAI = await ethers.getContractAt("TestFixture_ERC20", addresses.DAI);
  WETH = await ethers.getContractAt("IWETH", addresses.WETH);
  WBTC = await ethers.getContractAt("TestFixture_ERC20", addresses.WBTC);
  legacy_router = await ethers.getContractAt("ILBLegacyRouter", addresses.TRADERJOE_LEGACY_LBROUTER);
  legacy_pair = await ethers.getContractAt("ILBLegacyPair", addresses.TRADERJOR_LEGACY_LBPAIR_USDC_WETH);
  pair = await ethers.getContractAt("ILBPair", addresses.TRADERJOR_LBPAIR_WETH_WBTC);
  router = await ethers.getContractAt("ILBRouter", addresses.TRADERJOE_LBROUTER);
  quoter = await ethers.getContractAt("ILBQuoter", addresses.TRADERJOE_LBQUOTER);

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "ETH++ Vault", "ETH-DSQ-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return { strategyDiamond, vault, test20, USDC, WETH, WBTC, DAI, legacy_router, legacy_pair, router, quoter, pair };
}

// Tests need to be on blockNumber 77473260 or later. That is when V2 was deployed
describe("Trader Joe Modules", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("TraderJoe_Swap_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, router, quoter, legacy_router } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, router.address, ethers.constants.MaxUint256);
      await strategyDiamond.approve(WETH.address, router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should swapExactTokensForTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([USDC.address, DAI.address], initialUSDCBalance);
      path = [quote.binSteps, quote.versions, [USDC.address, DAI.address]];

      await expect(() =>
        strategyDiamond.traderjoe_swapExactTokensForTokens(initialUSDCBalance, 0, path, strategyDiamond.address, timestamp + 10),
      ).to.changeTokenBalance(USDC, strategyDiamond, -initialUSDCBalance);
      expect(await DAI.balanceOf(strategyDiamond.address)).to.eq(quote.amounts[1]);
    });

    it("Should not execute ill-formed swapExactTokensForTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([USDC.address, DAI.address], initialUSDCBalance);
      path = [quote.binSteps, quote.versions, [test20.address, DAI.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, DAI.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForTokens(initialUSDCBalance, quote.amounts[1], path, citizen1.address, timestamp + 10),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapExactTokensForNATIVE", async function () {
      quote = await quoter.findBestPathFromAmountIn([USDC.address, WETH.address], initialUSDCBalance);
      path = [quote.binSteps, quote.versions, [USDC.address, WETH.address]];

      await expect(() =>
        strategyDiamond.traderjoe_swapExactTokensForNATIVE(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.changeTokenBalance(USDC, strategyDiamond, -initialUSDCBalance);
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.be.gte(quote.amounts[1]);
    });

    it("Should not execute ill-formed swapExactTokensForNATIVE", async function () {
      quote = await quoter.findBestPathFromAmountIn([USDC.address, WETH.address], initialUSDCBalance);
      path = [quote.binSteps, quote.versions, [test20.address, WETH.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForNATIVE(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForNATIVE(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, WETH.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForNATIVE(initialUSDCBalance, quote.amounts[1], path, citizen1.address, timestamp + 10),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapExactNATIVEForTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([WETH.address, USDC.address], initialWETHBalance);
      path = [quote.binSteps, quote.versions, [WETH.address, USDC.address]];

      await expect(() =>
        strategyDiamond.traderjoe_swapExactNATIVEForTokens(
          initialWETHBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.changeTokenBalance(USDC, strategyDiamond, quote.amounts[1]);
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.eq(0);
    });

    it("Should not execute ill-formed swapExactNATIVEForTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([WETH.address, USDC.address], initialWETHBalance);
      path = [quote.binSteps, quote.versions, [test20.address, USDC.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactNATIVEForTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [WETH.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactNATIVEForTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [WETH.address, USDC.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactNATIVEForTokens(initialUSDCBalance, quote.amounts[1], path, citizen1.address, timestamp + 10),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapTokensForExactTokens", async function () {
      quote = await quoter.findBestPathFromAmountOut([USDC.address, DAI.address], parseEther("100"));
      path = [quote.binSteps, quote.versions, [USDC.address, DAI.address]];

      await expect(() =>
        strategyDiamond.traderjoe_swapTokensForExactTokens(
          parseEther("100"),
          quote.amounts[0],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.changeTokenBalance(USDC, strategyDiamond, -quote.amounts[0]);
      expect(await DAI.balanceOf(strategyDiamond.address)).to.be.gte(parseEther("100"));
    });

    it("Should not execute ill-formed swapTokensForExactTokens", async function () {
      quote = await quoter.findBestPathFromAmountOut([USDC.address, DAI.address], parseEther("100"));
      path = [quote.binSteps, quote.versions, [test20.address, DAI.address]];
      await expect(
        strategyDiamond.traderjoe_swapTokensForExactTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapTokensForExactTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, DAI.address]];
      await expect(
        strategyDiamond.traderjoe_swapTokensForExactTokens(initialUSDCBalance, quote.amounts[1], path, citizen1.address, timestamp + 10),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapTokensForExactNATIVE", async function () {
      quote = await quoter.findBestPathFromAmountOut([USDC.address, WETH.address], parseEther("1"));
      path = [quote.binSteps, quote.versions, [USDC.address, WETH.address]];
      initBal = await ethers.provider.getBalance(strategyDiamond.address);

      await expect(() =>
        strategyDiamond.traderjoe_swapTokensForExactNATIVE(
          parseEther("1"),
          quote.amounts[0],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.changeTokenBalance(USDC, strategyDiamond, -quote.amounts[0]);
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.be.gt(initBal.add(parseEther("1")));
    });

    it("Should not execute ill-formed swapTokensForExactNATIVE", async function () {
      quote = await quoter.findBestPathFromAmountOut([USDC.address, WETH.address], parseEther("1"));
      path = [quote.binSteps, quote.versions, [test20.address, WETH.address]];
      await expect(
        strategyDiamond.traderjoe_swapTokensForExactNATIVE(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapTokensForExactNATIVE(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, WETH.address]];
      await expect(
        strategyDiamond.traderjoe_swapTokensForExactNATIVE(initialUSDCBalance, quote.amounts[1], path, citizen1.address, timestamp + 10),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    // TODO - WETH to DAI does not work for some reason
    it("Should swapNATIVEForExactTokens", async function () {
      quote = await quoter.findBestPathFromAmountOut([WETH.address, USDC.address], 100e6);
      path = [quote.binSteps, quote.versions, [WETH.address, USDC.address]];

      await expect(() =>
        strategyDiamond.traderjoe_swapNATIVEForExactTokens(quote.amounts[0], 100e6, path, strategyDiamond.address, timestamp + 10),
      ).to.changeEtherBalance(strategyDiamond, BigNumber.from("0").sub(quote.amounts[0]));
      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gte(initialUSDCBalance.add(100e6));
    });

    it("Should not execute ill-formed swapNATIVEForExactTokens", async function () {
      quote = await quoter.findBestPathFromAmountOut([WETH.address, USDC.address], 100e6);
      path = [quote.binSteps, quote.versions, [test20.address, USDC.address]];
      await expect(
        strategyDiamond.traderjoe_swapNATIVEForExactTokens(
          quote.amounts[1],
          initialUSDCBalance,
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [WETH.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapNATIVEForExactTokens(
          quote.amounts[1],
          initialUSDCBalance,
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [WETH.address, USDC.address]];
      await expect(
        strategyDiamond.traderjoe_swapNATIVEForExactTokens(quote.amounts[1], initialUSDCBalance, path, citizen1.address, timestamp + 10),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapExactTokensForTokensSupportingFeeOnTransferTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([USDC.address, DAI.address], initialUSDCBalance);
      path = [quote.binSteps, quote.versions, [USDC.address, DAI.address]];

      await expect(() =>
        strategyDiamond.traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.changeTokenBalance(DAI, strategyDiamond, quote.amounts[1]);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should not execute ill-formed swapExactTokensForTokensSupportingFeeOnTransferTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([USDC.address, DAI.address], initialUSDCBalance);
      path = [quote.binSteps, quote.versions, [test20.address, DAI.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, DAI.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          citizen1.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapExactTokensForNATIVESupportingFeeOnTransferTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([USDC.address, WETH.address], initialUSDCBalance);
      path = [quote.binSteps, quote.versions, [USDC.address, WETH.address]];

      await expect(() =>
        strategyDiamond.traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.changeEtherBalance(strategyDiamond, quote.amounts[1]);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should not execute ill-formed swapExactTokensForNATIVESupportingFeeOnTransferTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([USDC.address, WETH.address], initialUSDCBalance);
      path = [quote.binSteps, quote.versions, [test20.address, WETH.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [USDC.address, WETH.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(
          initialUSDCBalance,
          quote.amounts[1],
          path,
          citizen1.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapExactNATIVEForTokensSupportingFeeOnTransferTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([WETH.address, USDC.address], initialWETHBalance);
      path = [quote.binSteps, quote.versions, [WETH.address, USDC.address]];

      await expect(() =>
        strategyDiamond.traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(
          initialWETHBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.changeTokenBalance(USDC, strategyDiamond, quote.amounts[1]);
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.eq(0);
    });

    it("Should not execute ill-formed swapExactNATIVEForTokensSupportingFeeOnTransferTokens", async function () {
      quote = await quoter.findBestPathFromAmountIn([WETH.address, USDC.address], initialWETHBalance);
      path = [quote.binSteps, quote.versions, [test20.address, USDC.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(
          initialWETHBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [WETH.address, test20.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(
          initialWETHBalance,
          quote.amounts[1],
          path,
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid swap path");

      path = [quote.binSteps, quote.versions, [WETH.address, USDC.address]];
      await expect(
        strategyDiamond.traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(
          initialWETHBalance,
          quote.amounts[1],
          path,
          citizen1.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });
  });

  describe("TraderJoe_Legacy_LP_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, legacy_router, legacy_quoter, legacy_pair } = await loadFixture(
        deployStrategy,
      );

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, legacy_router.address, ethers.constants.MaxUint256);
      await strategyDiamond.approve(WETH.address, legacy_router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should legacy_addLiquidity", async function () {
      pairInfo = await legacy_pair.getReservesAndId();
      liquidParams = [
        WETH.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        strategyDiamond.address, // to
        timestamp + 10, // deadline
      ];

      await expect(() => strategyDiamond.traderjoe_legacy_addLiquidity(liquidParams)).to.changeTokenBalance(USDC, strategyDiamond, -100e6);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId)).to.be.gt(0);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId.sub(1))).to.be.gt(0);
    });

    it("Should not execute ill-formed legacy_addLiquidity", async function () {
      pairInfo = await legacy_pair.getReservesAndId();
      liquidParams = [
        test20.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        strategyDiamond.address, // to
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_legacy_addLiquidity(liquidParams)).to.be.revertedWith("Invalid token");

      liquidParams = [
        WETH.address, // tokenX
        test20.address, // tokenY
        15, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        strategyDiamond.address, // to
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_legacy_addLiquidity(liquidParams)).to.be.revertedWith("Invalid token");

      liquidParams = [
        WETH.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        citizen1.address, // to
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_legacy_addLiquidity(liquidParams)).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should legacy_removeLiquidity", async function () {
      // Add liquidity
      pairInfo = await legacy_pair.getReservesAndId();
      liquidParams = [
        WETH.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        strategyDiamond.address, // to
        timestamp + 10, // deadline
      ];
      await strategyDiamond.traderjoe_legacy_addLiquidity(liquidParams);
      pairBal1 = await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId);
      pairBal2 = await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId.sub(1));

      // Remove liquidity
      initUSDC = await USDC.balanceOf(strategyDiamond.address);
      await strategyDiamond.traderjoe_legacy_setApprovalForAll(WETH.address, USDC.address, 15);
      await strategyDiamond.traderjoe_legacy_removeLiquidity(
        WETH.address,
        USDC.address,
        15,
        0,
        0,
        [pairInfo.activeId, pairInfo.activeId - 1],
        [pairBal1, pairBal2],
        strategyDiamond.address,
        timestamp + 10,
      );

      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gt(initUSDC);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(0);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId)).to.eq(0);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId.sub(1))).to.eq(0);
    });

    it("Should not execute ill-formed legacy_removeLiquidity", async function () {
      await expect(
        strategyDiamond.traderjoe_legacy_removeLiquidity(
          test20.address,
          USDC.address,
          15,
          0,
          0,
          [pairInfo.activeId, pairInfo.activeId - 1],
          [0, 0],
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.traderjoe_legacy_removeLiquidity(
          WETH.address,
          test20.address,
          15,
          0,
          0,
          [pairInfo.activeId, pairInfo.activeId - 1],
          [0, 0],
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.traderjoe_legacy_removeLiquidity(
          WETH.address,
          USDC.address,
          15,
          0,
          0,
          [pairInfo.activeId, pairInfo.activeId - 1],
          [0, 0],
          citizen1.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should legacy_addLiquidityAVAX", async function () {
      pairInfo = await legacy_pair.getReservesAndId();
      liquidParams = [
        WETH.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        parseEther(".5"), // amountX
        700e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2), 0], // distributionY
        strategyDiamond.address, // to
        timestamp + 10, // deadline
      ];

      await expect(() => strategyDiamond.traderjoe_legacy_addLiquidityAVAX(parseEther(".5"), liquidParams)).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -700e6,
      );
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.eq(initialWETHBalance.sub(parseEther(".5")));
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId)).to.be.gt(0);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId.sub(1))).to.be.gt(0);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId.add(1))).to.be.gt(0);
    });

    it("Should not execute ill-formed legacy_addLiquidityAVAX", async function () {
      liquidParams = [
        test20.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        parseEther(".5"), // amountX
        700e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, 0, 0], // distributionX
        [0, 0, 0], // distributionY
        strategyDiamond.address, // to
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_legacy_addLiquidityAVAX(parseEther(".5"), liquidParams)).to.be.revertedWith("Invalid token");

      liquidParams = [
        WETH.address, // tokenX
        test20.address, // tokenY
        15, // binStep
        parseEther(".5"), // amountX
        700e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2), 0], // distributionY
        strategyDiamond.address, // to
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_legacy_addLiquidityAVAX(parseEther(".5"), liquidParams)).to.be.revertedWith("Invalid token");

      liquidParams = [
        WETH.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        parseEther(".5"), // amountX
        700e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2), 0], // distributionY
        citizen1.address, // to
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_legacy_addLiquidityAVAX(parseEther(".5"), liquidParams)).to.be.revertedWith(
        "GuardError: Invalid recipient",
      );
    });

    it("Should legacy_removeLiquidityAVAX", async function () {
      // Add liquidity
      pairInfo = await legacy_pair.getReservesAndId();
      liquidParams = [
        WETH.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        pairInfo.activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        strategyDiamond.address, // to
        timestamp + 10, // deadline
      ];
      await strategyDiamond.traderjoe_legacy_addLiquidity(liquidParams);
      pairBal1 = await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId);
      pairBal2 = await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId.sub(1));

      // Remove liquidity
      initUSDC = await USDC.balanceOf(strategyDiamond.address);
      await strategyDiamond.traderjoe_legacy_setApprovalForAll(WETH.address, USDC.address, 15);
      await strategyDiamond.traderjoe_legacy_removeLiquidityAVAX(
        USDC.address,
        15,
        0,
        0,
        [pairInfo.activeId, pairInfo.activeId - 1],
        [pairBal1, pairBal2],
        strategyDiamond.address,
        timestamp + 10,
      );

      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.be.gt(initialWETHBalance);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gt(initUSDC);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId)).to.eq(0);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, pairInfo.activeId.sub(1))).to.eq(0);
    });

    it("Should not execute ill-formed legacy_removeLiquidityAVAX", async function () {
      await expect(
        strategyDiamond.traderjoe_legacy_removeLiquidityAVAX(
          test20.address,
          15,
          0,
          0,
          [0, 1],
          [0, 0],
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.traderjoe_legacy_removeLiquidityAVAX(USDC.address, 15, 0, 0, [0, 1], [0, 0], citizen1.address, timestamp + 10),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });
  });

  describe("TraderJoe_LP_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, router, quoter, pair } = await loadFixture(deployStrategy);

      const wbtc_index = getSlot(strategyDiamond.address, WBTC_SLOT);

      await setStorageAt(WBTC.address, wbtc_index, toBytes32(BigNumber.from(100e6)));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(WBTC.address, router.address, ethers.constants.MaxUint256);
      await strategyDiamond.approve(WETH.address, router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should addLiquidity", async function () {
      activeId = await pair.getActiveId();
      liquidParams = [
        WBTC.address, // tokenX
        WETH.address, // tokenY
        10, // binStep
        100e6, // amountX
        0, // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [0, 1], // deltaIds
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [0, 0], // distributionY
        strategyDiamond.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];

      await expect(() => strategyDiamond.traderjoe_addLiquidity(liquidParams)).to.changeTokenBalance(WBTC, strategyDiamond, -100e6);
      expect(await pair.balanceOf(strategyDiamond.address, activeId)).to.be.gt(0);
      expect(await pair.balanceOf(strategyDiamond.address, activeId + 1)).to.be.gt(0);
    });

    it("Should not execute ill-formed addLiquidity", async function () {
      activeId = await pair.getActiveId();

      liquidParams = [
        test20.address, // tokenX
        WBTC.address, // tokenY
        10, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        strategyDiamond.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_addLiquidity(liquidParams)).to.be.revertedWith("Invalid token");

      liquidParams = [
        WETH.address, // tokenX
        test20.address, // tokenY
        10, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        strategyDiamond.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_addLiquidity(liquidParams)).to.be.revertedWith("Invalid token");

      liquidParams = [
        WETH.address, // tokenX
        WBTC.address, // tokenY
        10, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        citizen1.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_addLiquidity(liquidParams)).to.be.revertedWith("GuardError: Invalid recipient");

      liquidParams = [
        WETH.address, // tokenX
        WBTC.address, // tokenY
        10, // binStep
        0, // amountX
        100e6, // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [0, -1], // deltaIds
        [0, 0], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionY
        strategyDiamond.address, // to
        citizen1.address, // refundTo
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_addLiquidity(liquidParams)).to.be.revertedWith("GuardError: Invalid refundTo");
    });

    it("Should removeLiquidity", async function () {
      // Add liquidity
      activeId = await pair.getActiveId();
      liquidParams = [
        WBTC.address, // tokenX
        WETH.address, // tokenY
        10, // binStep
        100e6, // amountX
        0, // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [0, 1], // deltaIds
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [0, 0], // distributionY
        strategyDiamond.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];
      await strategyDiamond.traderjoe_addLiquidity(liquidParams);
      pairBal1 = await pair.balanceOf(strategyDiamond.address, activeId);
      pairBal2 = await pair.balanceOf(strategyDiamond.address, activeId + 1);

      // Remove liquidity
      initWBTC = await WBTC.balanceOf(strategyDiamond.address);
      await strategyDiamond.traderjoe_approveForAll(WBTC.address, WETH.address, 10);
      await strategyDiamond.traderjoe_removeLiquidity(
        WBTC.address,
        WETH.address,
        10,
        0,
        0,
        [activeId, activeId + 1],
        [pairBal1, pairBal2],
        strategyDiamond.address,
        timestamp + 10,
      );

      expect(await WBTC.balanceOf(strategyDiamond.address)).to.be.gt(initWBTC);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(0);
      expect(await pair.balanceOf(strategyDiamond.address, activeId)).to.eq(0);
      expect(await pair.balanceOf(strategyDiamond.address, activeId + 1)).to.eq(0);
    });

    it("Should not execute ill-formed removeLiquidity", async function () {
      await expect(
        strategyDiamond.traderjoe_removeLiquidity(
          test20.address,
          WETH.address,
          10,
          0,
          0,
          [activeId, activeId + 1],
          [pairBal1, pairBal2],
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.traderjoe_removeLiquidity(
          WBTC.address,
          test20.address,
          10,
          0,
          0,
          [activeId, activeId + 1],
          [pairBal1, pairBal2],
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.traderjoe_removeLiquidity(
          WBTC.address,
          WETH.address,
          10,
          0,
          0,
          [activeId, activeId + 1],
          [pairBal1, pairBal2],
          citizen1.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should addLiquidityNATIVE", async function () {
      activeId = await pair.getActiveId();
      liquidParams = [
        WBTC.address, // tokenX
        WETH.address, // tokenY
        10, // binStep
        100e6, // amountX
        parseEther(".5"), // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2), 0], // distributionY
        strategyDiamond.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];

      await expect(() => strategyDiamond.traderjoe_addLiquidityNATIVE(parseEther(".5"), liquidParams)).to.changeTokenBalance(
        WBTC,
        strategyDiamond,
        -100e6,
      );
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.eq(initialWETHBalance.sub(parseEther(".5")));
      expect(await pair.balanceOf(strategyDiamond.address, activeId)).to.be.gt(0);
      expect(await pair.balanceOf(strategyDiamond.address, activeId - 1)).to.be.gt(0);
      expect(await pair.balanceOf(strategyDiamond.address, activeId + 1)).to.be.gt(0);
    });

    it("Should not execute ill-formed addLiquidityNATIVE", async function () {
      activeId = await pair.getActiveId();
      liquidParams = [
        test20.address, // tokenX
        WETH.address, // tokenY
        10, // binStep
        100e6, // amountX
        parseEther(".5"), // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2), 0], // distributionY
        strategyDiamond.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_addLiquidityNATIVE(parseEther(".5"), liquidParams)).to.be.revertedWith("Invalid token");

      liquidParams = [
        WBTC.address, // tokenX
        test20.address, // tokenY
        10, // binStep
        100e6, // amountX
        parseEther(".5"), // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2), 0], // distributionY
        strategyDiamond.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_addLiquidityNATIVE(parseEther(".5"), liquidParams)).to.be.revertedWith("Invalid token");

      liquidParams = [
        WBTC.address, // tokenX
        WETH.address, // tokenY
        10, // binStep
        100e6, // amountX
        parseEther(".5"), // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2), 0], // distributionY
        citizen1.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_addLiquidityNATIVE(parseEther(".5"), liquidParams)).to.be.revertedWith(
        "GuardError: Invalid recipient",
      );

      liquidParams = [
        WBTC.address, // tokenX
        WETH.address, // tokenY
        10, // binStep
        100e6, // amountX
        parseEther(".5"), // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [-1, 0, 1], // deltaIds
        [0, parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [parseEther("1").div(2), parseEther("1").div(2), 0], // distributionY
        strategyDiamond.address, // to
        citizen1.address, // refundTo
        timestamp + 10, // deadline
      ];
      await expect(strategyDiamond.traderjoe_addLiquidityNATIVE(parseEther(".5"), liquidParams)).to.be.revertedWith(
        "GuardError: Invalid refundTo",
      );
    });

    it("Should removeLiquidityNATIVE", async function () {
      activeId = await pair.getActiveId();
      liquidParams = [
        WBTC.address, // tokenX
        WETH.address, // tokenY
        10, // binStep
        100e6, // amountX
        0, // amountY
        0, // amountXMin
        0, // amountYMin
        activeId, //acitveIdDesired
        4, // idSlippage
        [0, 1], // deltaIds
        [parseEther("1").div(2), parseEther("1").div(2)], // distributionX
        [0, 0], // distributionY
        strategyDiamond.address, // to
        strategyDiamond.address, // refundTo
        timestamp + 10, // deadline
      ];
      await strategyDiamond.traderjoe_addLiquidity(liquidParams);
      pairBal1 = await pair.balanceOf(strategyDiamond.address, activeId);
      pairBal2 = await pair.balanceOf(strategyDiamond.address, activeId + 1);

      initWBTC = await WBTC.balanceOf(strategyDiamond.address);
      await strategyDiamond.traderjoe_approveForAll(WBTC.address, WETH.address, 10);
      await strategyDiamond.traderjoe_removeLiquidityNATIVE(
        WBTC.address,
        10,
        0,
        0,
        [activeId, activeId + 1],
        [pairBal1, pairBal2],
        strategyDiamond.address,
        timestamp + 10,
      );
      expect(await WBTC.balanceOf(strategyDiamond.address)).to.be.gt(initWBTC);
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.be.gt(initialWETHBalance);
      expect(await pair.balanceOf(strategyDiamond.address, activeId)).to.eq(0);
      expect(await pair.balanceOf(strategyDiamond.address, activeId + 1)).to.eq(0);
    });

    it("Should not execute ill-formed removeLiquidityNATIVE", async function () {
      await expect(
        strategyDiamond.traderjoe_removeLiquidityNATIVE(
          test20.address,
          10,
          0,
          0,
          [activeId, activeId + 1],
          [pairBal1, pairBal2],
          strategyDiamond.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.traderjoe_removeLiquidityNATIVE(
          WBTC.address,
          10,
          0,
          0,
          [activeId, activeId + 1],
          [pairBal1, pairBal2],
          citizen1.address,
          timestamp + 10,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });
  });

  describe("Helpers", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, legacy_router, legacy_quoter, legacy_pair, router, pair } =
        await loadFixture(deployStrategy);
    });

    it("Should legacy_setApprovalForAll", async function () {
      expect(await legacy_pair.isApprovedForAll(strategyDiamond.address, legacy_router.address)).to.eq(false);
      await strategyDiamond.traderjoe_legacy_setApprovalForAll(WETH.address, USDC.address, 15);
      expect(await legacy_pair.isApprovedForAll(strategyDiamond.address, legacy_router.address)).to.eq(true);
    });

    it("Should not execute ill-formed legacy_setApprovalForAll", async function () {
      await expect(strategyDiamond.traderjoe_legacy_setApprovalForAll(test20.address, USDC.address, 15)).to.be.revertedWith(
        "Invalid token",
      );
      await expect(strategyDiamond.traderjoe_legacy_setApprovalForAll(WETH.address, test20.address, 15)).to.be.revertedWith(
        "Invalid token",
      );
      await expect(strategyDiamond.traderjoe_legacy_setApprovalForAll(WETH.address, USDC.address, 723)).to.be.revertedWith(
        "Invalid pair parameters",
      );
    });

    it("Should approveForAll", async function () {
      expect(await pair.isApprovedForAll(strategyDiamond.address, router.address)).to.eq(false);
      await strategyDiamond.traderjoe_approveForAll(WETH.address, WBTC.address, 10);
      expect(await pair.isApprovedForAll(strategyDiamond.address, router.address)).to.eq(true);
    });

    it("Should not execute ill-formed approveForAll", async function () {
      await expect(strategyDiamond.traderjoe_approveForAll(test20.address, USDC.address, 15)).to.be.revertedWith("Invalid token");
      await expect(strategyDiamond.traderjoe_approveForAll(WETH.address, test20.address, 15)).to.be.revertedWith("Invalid token");
      await expect(strategyDiamond.traderjoe_approveForAll(WETH.address, USDC.address, 723)).to.be.revertedWith("Invalid pair parameters");
    });
  });

  // These forked tests are based off real transactions from TraderV0
  describe("Forked Tests", function () {
    // https://phalcon.xyz/tx/arbitrum/0xa014f7b5f7ec1c41cfb26b8867f8f8c85fee7ff75b79267ceb765a0a97708e90
    it("Should addLiquidityAVAX", async function () {
      reset(process.env.ARBITRUM_URL, 49781655);
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, legacy_router, legacy_quoter } = await deployStrategy();
      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, legacy_router.address, ethers.constants.MaxUint256);
      await strategyDiamond.approve(WETH.address, legacy_router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;

      params = [
        WETH.address, // tokenX
        USDC.address, // tokenY
        15, // binStep
        parseEther(".6"), // amountX
        714e6, // amountY
        parseEther(".597"), // minAmountX
        710430000, // minAmountY
        8374898, // activeIdDesired
        3, // idSlippage
        [-10, -9, -8, -7, -6, 6, 7, 8, 9, 10], // deltaIds
        [0, 0, 0, 0, 0, parseEther(".04"), parseEther(".12"), parseEther(".2"), parseEther(".28"), parseEther(".36")], // distributionX
        [parseEther(".36"), parseEther(".28"), parseEther(".2"), parseEther(".12"), parseEther(".04"), 0, 0, 0, 0, 0], // distributionY
        strategyDiamond.address, // to
        1672403545, // deadline
      ];

      await strategyDiamond.traderjoe_legacy_addLiquidityAVAX(parseEther(".6"), params);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374888)).to.eq(257040000);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374889)).to.eq(199920000);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374890)).to.eq(142800000);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374891)).to.eq(85680000);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374892)).to.eq(28560000);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374904)).to.eq(28809963);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374905)).to.eq(86559534);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374906)).to.eq(144482288);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374907)).to.eq(202578617);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8374908)).to.eq(260848909);
    });

    it("Should addLiquidity", async function () {
      reset(process.env.ARBITRUM_URL, 51803594);
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, legacy_router, legacy_quoter } = await deployStrategy();
      legacy_pair = await ethers.getContractAt("ILBLegacyPair", addresses.TRADERJOR_LEGACY_LBPAIR_USDC_WBTC);
      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      const wbtc_index = getSlot(strategyDiamond.address, WBTC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setStorageAt(WBTC.address, wbtc_index, toBytes32(BigNumber.from(10e6)));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, legacy_router.address, ethers.constants.MaxUint256);
      await strategyDiamond.approve(WBTC.address, legacy_router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;

      params = [
        WBTC.address, // tokenX
        USDC.address, // tokenY
        10, // binStep
        BigNumber.from("4118541"), // amountX
        BigNumber.from("1890272975"), // amountY
        4118, // minAmountX
        BigNumber.from("1890272"), // minAmountY
        BigNumber.from("8393760"), // activeIdDesired
        4, // idSlippage
        [
          -22, -21, -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
          10, 11,
        ], // deltaIds
        [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          BigNumber.from("43478260869565216"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
          BigNumber.from("86956521739130430"),
        ], // distributionX
        [
          BigNumber.from("44444444444444411"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("44444444444444446"),
          BigNumber.from("22222222222222223"),
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ], // distributionY
        strategyDiamond.address, // to
        1673260350, // deadline
      ];

      await strategyDiamond.traderjoe_legacy_addLiquidity(params);
      // Only checking a couple bins
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8393738)).to.eq(84012132);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8393750)).to.eq(84012132);
      expect(await legacy_pair.balanceOf(strategyDiamond.address, 8393770)).to.eq(62337917);
    });
  });
});
