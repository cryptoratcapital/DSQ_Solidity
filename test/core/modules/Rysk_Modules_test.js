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
    blockNumber: 27407606,
    addresses: addressesAndParams["arb_mainnet"].addresses,
    parameters: addressesAndParams["arb_mainnet"].parameters,
  },
};

let forkConfig = getNetworkConfig(forkConfigs);

let traderInitializerParams;
if (forkConfig !== undefined) {
  addresses = forkConfig.addresses;
  USDC_SLOT = forkConfig.parameters.USDC_SLOT;
  RYSK_MAX_TIME_DEVIATION_SLOT = forkConfig.parameters.RYSK_MAX_TIME_DEVIATION_SLOT;

  const initialPerformanceFee = parseEther("0.1"); // 10% fee
  const initialManagementFee = parseEther("0.01"); // 1% fee

  const strategyDiamondName = "TestFixture_Strategy_Rysk";
  const allowedTokens = [addresses.USDC, addresses.WETH, addresses.DAI, addresses.GMX, addresses.WBTC];
  const allowedSpenders = [
    addresses.GMX_ROUTER,
    addresses.GMX_POSITIONROUTER,
    addresses.GMX_ORDERBOOK,
    addresses.CAMELOT_ROUTER,
    addresses.RYSK_LIQUIDITY_POOL,
    addresses.RYSK_ALPHA_OPTION_HANDLER,
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

  RyskLPFacet = await ethers.getContractFactory("Rysk_LP_Module");
  ryskLPFacet = await RyskLPFacet.deploy(addresses.RYSK_LIQUIDITY_POOL);

  RyskOptionsFacet = await ethers.getContractFactory("Rysk_Options_Module");
  ryskOptionsFacet = await RyskOptionsFacet.deploy(addresses.RYSK_ALPHA_OPTION_HANDLER);

  Strategy = await ethers.getContractFactory("TestFixture_Strategy_Rysk");
  strategy = await Strategy.deploy(
    devWallet.address,
    traderFacet.address,
    traderInitializerParams,
    ryskLPFacet.address,
    ryskOptionsFacet.address,
  );

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_Rysk", strategy.address);

  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  WETH = await ethers.getContractAt("IWETH", addresses.WETH);
  WBTC = await ethers.getContractAt("TestFixture_ERC20", addresses.WBTC);
  pool = await ethers.getContractAt("Rysk_ILiquidityPool", addresses.RYSK_LIQUIDITY_POOL);
  handler = await ethers.getContractAt("IAlphaOptionHandler", addresses.RYSK_ALPHA_OPTION_HANDLER);
  registry = await ethers.getContractAt("IOptionRegistry", addresses.RYSK_OPTIONS_REGISTRY);

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "ETH++ Vault", "ETH-DSQ-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return { strategyDiamond, vault, test20, USDC, WETH, WBTC, pool, handler, registry };
}

// Tests need to be on BlockNumber: 27407606
describe("Rysk", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("Rysk_LP_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, pool } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, pool.address, ethers.constants.MaxUint256);

      // Impersonate Rysk governor and set maxTimeDeviation to prevent oracles from reverting
      governor = await ethers.getImpersonatedSigner(addresses.RYSK_GOVERNOR);
      await setBalance(governor.address, initialWETHBalance);
      await network.provider.send("hardhat_setStorageAt", [
        pool.address,
        ethers.utils.hexlify(RYSK_MAX_TIME_DEVIATION_SLOT),
        ethers.utils.hexZeroPad(ethers.constants.MaxUint256, 32),
      ]);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should deposit", async function () {
      epoch = await pool.depositEpoch();
      await expect(() => strategyDiamond.rysk_deposit(100e6)).to.changeTokenBalance(USDC, strategyDiamond, -100e6);

      receipt = await pool.depositReceipts(strategyDiamond.address);
      expect(receipt.amount).to.eq(100e6);
      expect(receipt.epoch).to.eq(epoch);
      expect(receipt.unredeemedShares).to.eq(0);
    });

    it("Should NOT execute ill-formed deposit", async function () {});

    it("Should redeem", async function () {
      await expect(() => strategyDiamond.rysk_deposit(100e6)).to.changeTokenBalance(USDC, strategyDiamond, -100e6);
      receipt = await pool.depositReceipts(strategyDiamond.address);
      expect(receipt.amount).to.eq(100e6);

      // Impersonate signers, override maxTimeDeviation, and execute Epoch
      await pool.connect(governor).pauseUnpauseTrading(true);
      await pool.connect(governor).executeEpochCalculation();

      // Redeem
      await strategyDiamond.rysk_redeem(ethers.constants.MaxUint256);
      expect(await pool.balanceOf(strategyDiamond.address)).to.be.gt(0);
    });

    it("Should NOT execute ill-formed redeem", async function () {});

    it("Should initiateWithdraw", async function () {
      await expect(() => strategyDiamond.rysk_deposit(100e6)).to.changeTokenBalance(USDC, strategyDiamond, -100e6);

      // Impersonate signers, and execute Epoch
      await pool.connect(governor).pauseUnpauseTrading(true);
      await pool.connect(governor).executeEpochCalculation();

      // Redeem
      await strategyDiamond.rysk_redeem(ethers.constants.MaxUint256);
      epoch = await pool.withdrawalEpoch();
      bal = await pool.balanceOf(strategyDiamond.address);

      // Initiate withdraw
      await strategyDiamond.rysk_initiateWithdraw(bal);
      receipt = await pool.withdrawalReceipts(strategyDiamond.address);
      expect(receipt.epoch).to.eq(epoch);
      expect(receipt.shares).to.eq(bal);
    });

    it("Should NOT execute ill-formed initiateWithdraw", async function () {});

    it("Should completeWithdraw", async function () {
      await expect(() => strategyDiamond.rysk_deposit(100e6)).to.changeTokenBalance(USDC, strategyDiamond, -100e6);

      // Impersonate signers, and execute Epoch
      await pool.connect(governor).pauseUnpauseTrading(true);
      await pool.connect(governor).executeEpochCalculation();

      // Redeem and initiateWithdraw
      await strategyDiamond.rysk_redeem(ethers.constants.MaxUint256);
      bal = await pool.balanceOf(strategyDiamond.address);
      await strategyDiamond.rysk_initiateWithdraw(bal);

      // Execute another epoch
      await pool.connect(governor).pauseUnpauseTrading(true);
      await pool.connect(governor).executeEpochCalculation();

      // completeWithdraw
      startUSDC = await USDC.balanceOf(strategyDiamond.address);
      await strategyDiamond.rysk_completeWithdraw();
      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gt(startUSDC);
      expect(await pool.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should NOT execute ill-formed completeWithdraw", async function () {});
  });

  describe("Rysk_Options_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, pool, handler, registry } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, handler.address, ethers.constants.MaxUint256);

      manager = await ethers.getImpersonatedSigner(addresses.RYSK_GOVERNOR);
      await setBalance(manager.address, initialWETHBalance);
      await pool.connect(manager).pauseUnpauseTrading(false);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should executeOrder", async function () {
      // Impersonate manager and create order
      orderCounter = (await handler.orderIdCounter()).add(1);
      await expect(
        handler
          .connect(manager)
          .createOrder(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            parseEther("10"),
            parseEther("15"),
            600,
            strategyDiamond.address,
            false,
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter);

      // Premium = amount * price converted to USDC decimals. 10 * 15 = 150
      await expect(() => strategyDiamond.connect(devWallet).rysk_executeOrder(orderCounter)).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -150e6,
      );
      oTokenAddress = await registry.getOtoken(WETH.address, USDC.address, 1665388800, false, parseEther("1400"), USDC.address);
      oToken = await ethers.getContractAt("TestFixture_ERC20", oTokenAddress);
      expect(await oToken.balanceOf(strategyDiamond.address)).to.eq(10e8);
    });

    it("Should not execute ill-formed executeOrder", async function () {});

    it("Should executeBuyBackOrder", async function () {
      // Impersonate manager and create regular order
      orderCounter = (await handler.orderIdCounter()).add(1);
      await expect(
        handler
          .connect(manager)
          .createOrder(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            parseEther("10"),
            parseEther("15"),
            600,
            strategyDiamond.address,
            false,
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter);

      // Premium = amount * price converted to USDC decimals. 10 * 15 = 150
      await expect(() => strategyDiamond.connect(devWallet).rysk_executeOrder(orderCounter)).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -150e6,
      );
      oTokenAddress = await registry.getOtoken(WETH.address, USDC.address, 1665388800, false, parseEther("1400"), USDC.address);
      oToken = await ethers.getContractAt("TestFixture_ERC20", oTokenAddress);
      expect(await oToken.balanceOf(strategyDiamond.address)).to.eq(10e8);

      // Create buyback order
      orderCounter = orderCounter.add(1);
      await expect(
        handler
          .connect(manager)
          .createOrder(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            parseEther("10"),
            parseEther("15"),
            600,
            strategyDiamond.address,
            true,
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter);

      initBal = await USDC.balanceOf(strategyDiamond.address);
      await expect(strategyDiamond.connect(devWallet).rysk_executeBuyBackOrder(orderCounter))
        .to.emit(handler, "OrderExecuted")
        .withArgs(orderCounter);
      afterBal = await USDC.balanceOf(strategyDiamond.address);

      expect(await oToken.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await oToken.allowance(strategyDiamond.address, handler.address)).to.eq(0);
      expect(afterBal).to.be.gt(initBal);
    });

    it("Should execute buyback order with truncating decimals", async function () {
      // Impersonate manager and create regular order
      orderCounter = (await handler.orderIdCounter()).add(1);
      await expect(
        handler
          .connect(manager)
          .createOrder(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            parseEther("10.123456789012345678"),
            parseEther("1"),
            600,
            strategyDiamond.address,
            false,
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter);

      // Premium = amount * price converted to USDC decimals. 10.123456 * 1
      await expect(() => strategyDiamond.connect(devWallet).rysk_executeOrder(orderCounter)).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -10123456,
      );
      oTokenAddress = await registry.getOtoken(WETH.address, USDC.address, 1665388800, false, parseEther("1400"), USDC.address);
      oToken = await ethers.getContractAt("TestFixture_ERC20", oTokenAddress);
      // 10.12345678
      expect(await oToken.balanceOf(strategyDiamond.address)).to.eq(BigNumber.from("1012345678"));

      // Create buyback order
      orderCounter = orderCounter.add(1);
      await expect(
        handler
          .connect(manager)
          .createOrder(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            parseEther("10.123456789012345678"),
            parseEther("1"),
            600,
            strategyDiamond.address,
            true,
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter);

      await expect(strategyDiamond.connect(devWallet).rysk_executeBuyBackOrder(orderCounter))
        .to.emit(handler, "OrderExecuted")
        .withArgs(orderCounter);
      expect(await oToken.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await oToken.allowance(strategyDiamond.address, handler.address)).to.eq(0);
    });

    it("Should execute two buyback orders", async function () {
      // Impersonate manager and create regular order
      orderCounter = (await handler.orderIdCounter()).add(1);
      await expect(
        handler
          .connect(manager)
          .createOrder(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            parseEther("10"),
            parseEther("15"),
            600,
            strategyDiamond.address,
            false,
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter);

      // Premium = amount * price converted to USDC decimals. 10 * 15 = 150
      await expect(() => strategyDiamond.connect(devWallet).rysk_executeOrder(orderCounter)).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -150e6,
      );
      oTokenAddress = await registry.getOtoken(WETH.address, USDC.address, 1665388800, false, parseEther("1400"), USDC.address);
      oToken = await ethers.getContractAt("TestFixture_ERC20", oTokenAddress);
      expect(await oToken.balanceOf(strategyDiamond.address)).to.eq(10e8);

      // Create 1st buyback order
      orderCounter = orderCounter.add(1);
      await expect(
        handler
          .connect(manager)
          .createOrder(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            parseEther("5"),
            parseEther("15"),
            600,
            strategyDiamond.address,
            true,
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter);

      await expect(strategyDiamond.connect(devWallet).rysk_executeBuyBackOrder(orderCounter))
        .to.emit(handler, "OrderExecuted")
        .withArgs(orderCounter);
      expect(await oToken.balanceOf(strategyDiamond.address)).to.eq(5e8);
      expect(await oToken.allowance(strategyDiamond.address, handler.address)).to.eq(0);

      // Create 2nd buyback order
      orderCounter = orderCounter.add(1);
      await expect(
        handler
          .connect(manager)
          .createOrder(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            parseEther("5"),
            parseEther("15"),
            600,
            strategyDiamond.address,
            true,
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter);

      await expect(strategyDiamond.connect(devWallet).rysk_executeBuyBackOrder(orderCounter))
        .to.emit(handler, "OrderExecuted")
        .withArgs(orderCounter);
      expect(await oToken.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await oToken.allowance(strategyDiamond.address, handler.address)).to.eq(0);
    });

    it("Should not execute ill-formed executeBuyBackOrder", async function () {});

    it("Should executeStrangle", async function () {
      // Impersonate manager and create strangle order
      orderCounter = (await handler.orderIdCounter()).add(1);
      await expect(
        handler
          .connect(manager)
          .createStrangle(
            [1665388800, parseEther("1400"), false, WETH.address, USDC.address, USDC.address],
            [1665388800, parseEther("1400"), true, WETH.address, USDC.address, USDC.address],
            parseEther("5"),
            parseEther("5"),
            parseEther("15"),
            parseEther("15"),
            600,
            strategyDiamond.address,
            [parseEther("10"), parseEther("10")],
            [parseEther("10"), parseEther("10")],
          ),
      )
        .to.emit(handler, "OrderCreated")
        .withArgs(orderCounter)
        .and.to.emit(handler, "OrderCreated")
        .withArgs(orderCounter.add(1));

      putTokenAddress = await registry.getOtoken(WETH.address, USDC.address, 1665388800, true, parseEther("1400"), USDC.address);
      putToken = await ethers.getContractAt("TestFixture_ERC20", putTokenAddress);
      callTokenAddress = await registry.getOtoken(WETH.address, USDC.address, 1665388800, false, parseEther("1400"), USDC.address);
      callToken = await ethers.getContractAt("TestFixture_ERC20", callTokenAddress);
      await expect(() => strategyDiamond.connect(devWallet).rysk_executeStrangle(orderCounter, orderCounter.add(1))).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -150e6,
      );

      expect(await putToken.balanceOf(strategyDiamond.address)).to.eq(5e8);
      expect(await callToken.balanceOf(strategyDiamond.address)).to.eq(5e8);
    });

    it("Should not execute ill-formed executeStrangle", async function () {});
  });
});
