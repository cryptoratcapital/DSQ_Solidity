const { expect, use } = require("chai");
const { solidity, deployMockContract } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther, formatEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { setBalance, loadFixture, reset } = require("@nomicfoundation/hardhat-network-helpers");
const { toBytes32, setStorageAt, getSlot, findBalanceSlot } = require("../../helpers/storageHelpers.js");
const addressesAndParams = require("../../helpers/addressesAndParams.json");
const { convertToUint256Address, convertAPIDataToParams } = require("../../helpers/inch/inch_helpers.js");
const { LimitOrderBuilder, Web3ProviderConnector } = require("@1inch/limit-order-protocol-utils");
const { resetToDefaultNetwork } = require("../../helpers/forkHelpers.js");

require("dotenv").config();
use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, feeReceiver] = provider.getWallets();

const CHAIN = "arb_mainnet";
const addresses = addressesAndParams[CHAIN].addresses;
const USDC_SLOT = addressesAndParams[CHAIN].parameters.USDC_SLOT;
const GMX_SLOT = addressesAndParams[CHAIN].parameters.GMX_SLOT;
const DAI_SLOT = addressesAndParams[CHAIN].parameters.DAI_SLOT;

const initialUSDCBalance = BigNumber.from(10000e6);
const initialWETHBalance = parseEther("100");
const initialPerformanceFee = parseEther("0.1"); // 10% fee
const initialManagementFee = parseEther("0.01"); // 1% fee

const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

const strategyDiamondName = "TestFixture_Strategy_Inch";
const allowedTokens = [
  addresses.USDC,
  addresses.WETH,
  addresses.DAI,
  addresses.GMX,
  addresses.WBTC,
  addresses.INCH_ETHER_TOKEN,
  addresses.USDT,
];
const allowedSpenders = [addresses.INCH_AGGREGATION_ROUTER];

const assets = [addresses.DAI, addresses.USDC, addresses.USDT, addresses.WETH, addresses.WBTC];

const oracles = [
  addresses.CHAINLINK_DAI_USD,
  addresses.CHAINLINK_USDC_USD,
  addresses.CHAINLINK_USDT_USD,
  addresses.CHAINLINK_WETH_USD,
  addresses.CHAINLINK_WBTC_USD,
];

const traderInitializerParams = [strategyDiamondName, allowedTokens, allowedSpenders, initialPerformanceFee, initialManagementFee];

async function deployStrategy() {
  TraderV0 = await ethers.getContractFactory("TraderV0");
  traderFacet = await TraderV0.deploy(maxPerformanceFee, maxManagementFee);

  InchSwapFacet = await ethers.getContractFactory("Inch_Swap_Module");
  inchSwapFacet = await InchSwapFacet.deploy(addresses.INCH_AGGREGATION_ROUTER, addresses.INCH_CLIPPER_EXCHANGE);

  InchLimitOrderFacet = await ethers.getContractFactory("Inch_LimitOrder_Module");
  inchLimitOrderFacet = await InchLimitOrderFacet.deploy(addresses.INCH_AGGREGATION_ROUTER);

  Strategy = await ethers.getContractFactory("TestFixture_Strategy_InchModule");
  strategy = await Strategy.deploy(
    devWallet.address,
    traderFacet.address,
    traderInitializerParams,
    inchSwapFacet.address,
    inchLimitOrderFacet.address,
    assets,
    oracles,
  );

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_Inch", strategy.address);
  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  DAI = await ethers.getContractAt("TestFixture_ERC20", addresses.DAI);
  WETH = await ethers.getContractAt("IWETH", addresses.WETH);
  WBTC = await ethers.getContractAt("TestFixture_ERC20", addresses.WBTC);
  GMX = await ethers.getContractAt("TestFixture_ERC20", addresses.GMX);
  router = await ethers.getContractAt("IAggregationRouter", addresses.INCH_AGGREGATION_ROUTER);
  executor = addresses.INCH_EXECUTOR;

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "ETH++ Vault", "ETH-DSQ-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor };
}

describe("1Inch Modules", function () {
  before(async function () {
    await resetToDefaultNetwork();
  });

  describe("Deployment", function () {
    it("Should NOT deploy with different length arrays", async function () {
      TraderV0 = await ethers.getContractFactory("TraderV0");
      traderFacet = await TraderV0.deploy(maxPerformanceFee, maxManagementFee);

      InchSwapFacet = await ethers.getContractFactory("Inch_Swap_Module");
      inchSwapFacet = await InchSwapFacet.deploy(addresses.INCH_AGGREGATION_ROUTER, addresses.INCH_CLIPPER_EXCHANGE);

      InchLimitOrderFacet = await ethers.getContractFactory("Inch_LimitOrder_Module");
      inchLimitOrderFacet = await InchLimitOrderFacet.deploy(addresses.INCH_AGGREGATION_ROUTER);

      Strategy = await ethers.getContractFactory("TestFixture_Strategy_InchModule");

      strategy = await expect(
        Strategy.deploy(
          devWallet.address,
          traderFacet.address,
          traderInitializerParams,
          inchSwapFacet.address,
          inchLimitOrderFacet.address,
          assets,
          [addresses.CHAINLINK_DAI_USD, addresses.CHAINLINK_USDC_USD],
        ),
      ).to.be.revertedWith("Inch_LimitOrder_Cutter: arrays must be the same length");
    });

    it("Should NOT deploy with facet as zero address", async function () {
      TraderV0 = await ethers.getContractFactory("TraderV0");
      traderFacet = await TraderV0.deploy(maxPerformanceFee, maxManagementFee);

      InchSwapFacet = await ethers.getContractFactory("Inch_Swap_Module");
      inchSwapFacet = await InchSwapFacet.deploy(addresses.INCH_AGGREGATION_ROUTER, addresses.INCH_CLIPPER_EXCHANGE);

      InchLimitOrderFacet = await ethers.getContractFactory("Inch_LimitOrder_Module");
      inchLimitOrderFacet = await InchLimitOrderFacet.deploy(addresses.INCH_AGGREGATION_ROUTER);

      Strategy = await ethers.getContractFactory("TestFixture_Strategy_InchModule");

      await expect(
        Strategy.deploy(
          devWallet.address,
          traderFacet.address,
          traderInitializerParams,
          inchSwapFacet.address,
          ethers.constants.AddressZero,
          assets,
          oracles,
        ),
      ).to.be.revertedWith("Inch_LimitOrder_Cutter: _facet cannot be 0 address");

      await expect(
        Strategy.deploy(
          devWallet.address,
          traderFacet.address,
          traderInitializerParams,
          ethers.constants.AddressZero,
          inchLimitOrderFacet.address,
          assets,
          oracles,
        ),
      ).to.be.revertedWith("Inch_Swap_Cutter: _facet cannot be 0 address");
    });
  });

  describe("Inch_Swap_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, router, executor } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;

      // Uniswap pools
      MIM_USDC = "0x6f539C599321A98A9feff4D925DAE56452a8Fc99";
      WETH_USDC = "0x17c14D2c404D167802b16C450d3c99F88F2c4F4d";
      MIM_DAI = "0x6f539C599321A98A9feff4D925DAE56452a8Fc99";
      UNI_USDC = "0x2dfBbc8C9405c70cA0f81944332841663D2333B1";
      WETH_UNI = "0xC24f7d8E51A64dc1238880BD00bb961D54cbeb29";
    });

    it("Should NOT execute ill-formed swap", async function () {
      desc = [
        test20.address, // srcToken
        DAI.address, //dstToken
        executor, // srcReceiver
        strategyDiamond.address, //dstReceiver
        initialUSDCBalance, //amount
        0, //minReturnAmount
        4, //flags
      ];
      await expect(
        strategyDiamond.inch_swap(0, executor, desc, ethers.utils.toUtf8Bytes(""), ethers.utils.toUtf8Bytes("")),
      ).to.be.revertedWith("Invalid token");

      desc = [
        USDC.address, // srcToken
        test20.address, //dstToken
        executor, // srcReceiver
        strategyDiamond.address, //dstReceiver
        initialUSDCBalance, //amount
        0, //minReturnAmount
        4, //flags
      ];
      await expect(
        strategyDiamond.inch_swap(0, executor, desc, ethers.utils.toUtf8Bytes(""), ethers.utils.toUtf8Bytes("")),
      ).to.be.revertedWith("Invalid token");

      desc = [
        USDC.address, // srcToken
        DAI.address, //dstToken
        executor, // srcReceiver
        citizen1.address, //dstReceiver
        initialUSDCBalance, //amount
        0, //minReturnAmount
        4, //flags
      ];
      await expect(
        strategyDiamond.inch_swap(0, executor, desc, ethers.utils.toUtf8Bytes(""), ethers.utils.toUtf8Bytes("")),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should uniswapV3Swap token to token", async function () {
      quoter = await ethers.getContractAt("IQuoterV2", "0x61fFE014bA17989E743c5F6cB21bF9697530B21e");
      pool = "0x0A5f3C8633B0abe29d229db1f730eD46a60DceD2";
      quote = await quoter.callStatic.quoteExactInputSingle([USDC.address, DAI.address, initialUSDCBalance, 3000, 0]);

      uintAddress = convertToUint256Address(false, false, pool).toHexString();
      await strategyDiamond.inch_uniswapV3Swap(0, initialUSDCBalance, 0, [uintAddress]);
      expect(await DAI.balanceOf(strategyDiamond.address)).to.eq(quote.amountOut);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should uniswapV3Swap ether to USDC", async function () {
      pool = "0x17c14D2c404D167802b16C450d3c99F88F2c4F4d";
      uintAddress = convertToUint256Address(true, false, pool);
      await expect(() => strategyDiamond.inch_uniswapV3Swap(parseEther("1"), parseEther("1"), 0, [uintAddress])).to.changeEtherBalance(
        strategyDiamond,
        parseEther("-1"),
      );
      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gt(initialUSDCBalance);
    });

    it("Should uniswapV3Swap USDC to ether", async function () {
      initBal = await ethers.provider.getBalance(strategyDiamond.address);
      pool = "0x17c14D2c404D167802b16C450d3c99F88F2c4F4d";
      uintAddress = convertToUint256Address(false, true, pool);
      await expect(() => strategyDiamond.inch_uniswapV3Swap(0, initialUSDCBalance, 0, [uintAddress])).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -initialUSDCBalance,
      );
      afterBal = await ethers.provider.getBalance(strategyDiamond.address);
      expect(afterBal).to.be.gt(initBal);
    });

    it("Should uniswapV3Swap USDC to WETH", async function () {
      pool = "0x17c14D2c404D167802b16C450d3c99F88F2c4F4d";
      uintAddress = convertToUint256Address(false, false, pool);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(0);
      await expect(() => strategyDiamond.inch_uniswapV3Swap(0, initialUSDCBalance, 0, [uintAddress])).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -initialUSDCBalance,
      );
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(0);
    });

    // USDC -> WETH
    it("Should do uniswapV3Swap multi-pool token swap with non-approved middle token", async function () {
      pool1Address = convertToUint256Address(false, false, UNI_USDC);
      pool2Address = convertToUint256Address(false, false, WETH_UNI);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(0);
      await expect(() => strategyDiamond.inch_uniswapV3Swap(0, 100e6, 0, [pool1Address, pool2Address])).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -100e6,
      );
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(0);
    });

    it("Should NOT do uniswapV3Swap multi-pool token swap with non-approved start token", async function () {
      pool1Address = convertToUint256Address(true, false, MIM_USDC);
      pool2Address = convertToUint256Address(false, false, WETH_USDC);
      await expect(strategyDiamond.inch_uniswapV3Swap(0, 100e6, 0, [pool1Address, pool2Address])).to.be.revertedWith("Invalid token");
    });

    it("Should NOT do uniswapV3Swap multi-pool token swap with non-approved end token", async function () {
      pool1Address = convertToUint256Address(false, false, WETH_USDC);
      pool2Address = convertToUint256Address(false, false, MIM_USDC);
      await expect(strategyDiamond.inch_uniswapV3Swap(0, 100e6, 0, [pool1Address, pool2Address])).to.be.revertedWith("Invalid token");
    });

    it("Should NOT execute ill-formed uniswapV3Swap", async function () {
      await expect(strategyDiamond.inch_uniswapV3Swap(0, initialUSDCBalance, 0, [MIM_DAI])).to.be.revertedWith("Invalid token");
    });

    it("Should NOT revert clipperSwap with srcToken = zero address", async function () {
      await expect(
        strategyDiamond.inch_clipperSwap(
          parseEther(".092"),
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          USDC.address,
          0,
          0,
          0,
          ethers.utils.formatBytes32String(""),
          ethers.utils.formatBytes32String(""),
        ),
      ).to.not.be.revertedWith("Invalid token");
    });

    it("Should NOT execute ill-formed clipperSwap", async function () {
      await expect(
        strategyDiamond.inch_clipperSwap(
          parseEther(".092"),
          citizen1.address,
          USDC.address,
          WETH.address,
          0,
          0,
          0,
          ethers.utils.formatBytes32String(""),
          ethers.utils.formatBytes32String(""),
        ),
      ).to.be.revertedWith("Invalid clipper exchange");

      await expect(
        strategyDiamond.inch_clipperSwap(
          parseEther(".092"),
          addresses.INCH_CLIPPER_EXCHANGE,
          USDC.address,
          test20.address,
          0,
          0,
          0,
          ethers.utils.formatBytes32String(""),
          ethers.utils.formatBytes32String(""),
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.inch_clipperSwap(
          parseEther(".092"),
          addresses.INCH_CLIPPER_EXCHANGE,
          test20.address,
          USDC.address,
          0,
          0,
          0,
          ethers.utils.formatBytes32String(""),
          ethers.utils.formatBytes32String(""),
        ),
      ).to.be.revertedWith("Invalid token");
    });
  });

  describe("Inch_LimitOrder_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, router, executor } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should NOT init_Inch_LimitOrder again", async function () {
      await expect(strategyDiamond.init_Inch_LimitOrder(assets, oracles)).to.be.reverted; // Proxy__ImplementationIsNotContract
      await expect(strategyDiamond.connect(citizen1).init_Inch_LimitOrder(assets, oracles)).to.be.reverted; // Proxy__ImplementationIsNotContract
    });

    it("Should allow citizen1 to fill order made by devWallet", async function () {
      const citizenIndex = getSlot(citizen1.address, DAI_SLOT);
      await setStorageAt(DAI.address, citizenIndex, toBytes32(parseEther("1000")));
      await DAI.connect(citizen1).approve(router.address, ethers.constants.MaxUint256);

      // Add an order
      limitOrderBuilder = new LimitOrderBuilder("", 1, ethers.provider);
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: USDC.address,
        takerAssetAddress: DAI.address,
        makerAddress: strategyDiamond.address,
        makingAmount: 100e6,
        takingAmount: parseEther("200"),
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });

      await strategyDiamond.inch_addOrder(limitOrder);

      await expect(() => router.connect(citizen1).fillOrder(limitOrder, "0x69", "0x00", 0, parseEther("200"), 0)).to.changeTokenBalance(
        DAI,
        citizen1,
        parseEther("-200"),
      );
      expect(await USDC.balanceOf(citizen1.address)).to.eq(100e6);
      expect(await DAI.balanceOf(strategyDiamond.address)).to.eq(parseEther("200"));
    });

    it("Should fillOrder", async function () {
      const citizenIndex = getSlot(citizen1.address, DAI_SLOT);
      await setStorageAt(DAI.address, citizenIndex, toBytes32(parseEther("100")));
      await DAI.connect(citizen1).approve(router.address, ethers.constants.MaxUint256);

      // Citizen1 makes an order and signs it
      limitOrderBuilder = new LimitOrderBuilder("", 1, ethers.provider);
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: USDC.address,
        makerAddress: citizen1.address,
        makingAmount: "1000",
        takingAmount: "1000",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      limitOrderHash = await router.hashOrder(limitOrder);
      signature = ethers.utils.joinSignature(citizen1._signingKey().signDigest(limitOrderHash));

      await expect(() => strategyDiamond.inch_fillOrder(0, limitOrder, signature, "0x00", 0, 500, 0)).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -500,
      );
      expect(await USDC.balanceOf(citizen1.address)).to.eq(500);
      expect(await DAI.balanceOf(strategyDiamond.address)).to.eq(500);
    });

    it("Should fillOrder using msg.value", async function () {
      const citizenIndex = getSlot(citizen1.address, DAI_SLOT);
      await setStorageAt(DAI.address, citizenIndex, toBytes32(parseEther("3500")));
      await DAI.connect(citizen1).approve(router.address, ethers.constants.MaxUint256);

      // Citizen1 makes an order and signs it
      limitOrderBuilder = new LimitOrderBuilder("", 1, ethers.provider);
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: WETH.address,
        makerAddress: citizen1.address,
        makingAmount: parseEther("3000"),
        takingAmount: parseEther("1"),
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      limitOrderHash = await router.hashOrder(limitOrder);
      signature = ethers.utils.joinSignature(citizen1._signingKey().signDigest(limitOrderHash));

      await expect(() =>
        strategyDiamond.inch_fillOrder(parseEther("1"), limitOrder, signature, "0x00", 0, parseEther("1"), 0),
      ).to.changeEtherBalance(strategyDiamond, parseEther("-1"));
      expect(await DAI.balanceOf(strategyDiamond.address)).to.eq(parseEther("3000"));
    });

    it("Should NOT fillOrder with malicious order", async function () {
      const citizenIndex = getSlot(citizen1.address, DAI_SLOT);
      await setStorageAt(DAI.address, citizenIndex, toBytes32(parseEther("3500")));
      await DAI.connect(citizen1).approve(router.address, ethers.constants.MaxUint256);

      // Citizen1 makes an order and signs it
      limitOrderBuilder = new LimitOrderBuilder("", 1, ethers.provider);
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: WETH.address,
        makerAddress: citizen1.address,
        makingAmount: parseEther("750"),
        takingAmount: parseEther("1"),
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      limitOrderHash = await router.hashOrder(limitOrder);
      signature = ethers.utils.joinSignature(citizen1._signingKey().signDigest(limitOrderHash));

      await expect(
        strategyDiamond.inch_fillOrder(parseEther("1"), limitOrder, signature, "0x00", 0, parseEther("1"), 0),
      ).to.be.revertedWith("GuardError: Invalid order parameters");
    });

    it("Should NOT execute ill-formed fillOrder", async function () {
      limitOrderBuilder = new LimitOrderBuilder("", 1, ethers.provider);
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: test20.address,
        takerAssetAddress: USDC.address,
        makerAddress: citizen1.address,
        makingAmount: "1000",
        takingAmount: "500",
        receiver: citizen1.address,
        // allowedSender = ZERO_ADDRESS,
      });
      await expect(strategyDiamond.inch_fillOrder(0, limitOrder, "0x69", "0x00", 0, 500, 0)).to.be.revertedWith("Invalid token");

      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: test20.address,
        makerAddress: citizen1.address,
        makingAmount: "1000",
        takingAmount: "500",
        receiver: citizen1.address,
        // allowedSender = ZERO_ADDRESS,
      });
      await expect(strategyDiamond.inch_fillOrder(0, limitOrder, "0x69", "0x00", 0, 500, 0)).to.be.revertedWith("Invalid token");
    });

    it("Should cancelOrder", async function () {
      const citizenIndex = getSlot(citizen1.address, DAI_SLOT);
      await setStorageAt(DAI.address, citizenIndex, toBytes32(parseEther("100")));
      await DAI.connect(citizen1).approve(router.address, ethers.constants.MaxUint256);

      // Make an order
      limitOrderBuilder = new LimitOrderBuilder("", 1, ethers.provider);
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: USDC.address,
        takerAssetAddress: DAI.address,
        makerAddress: strategyDiamond.address,
        makingAmount: 100e6,
        takingAmount: parseEther("200"),
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });

      limitOrderHash = await router.hashOrder(limitOrder);
      await strategyDiamond.inch_addOrder(limitOrder);
      await expect(() => router.connect(citizen1).fillOrder(limitOrder, "0x69", "0x00", 0, parseEther("100"), 0)).to.changeTokenBalance(
        DAI,
        citizen1,
        parseEther("-100"),
      );

      await expect(strategyDiamond.inch_cancelOrder(limitOrder)).to.emit(router, "OrderCanceled");
      expect(await router.remaining(limitOrderHash)).to.eq(0);
      await expect(router.connect(citizen1).fillOrder(limitOrder, "0x69", "0x00", 0, 200, 0)).to.be.reverted; // RemainingAmountIsZero()
      expect(await strategyDiamond.isValidSignature(limitOrderHash, "0x69")).to.eq("0x11111111");
    });
  });

  describe("Storage & Signature", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, router, executor } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;

      limitOrderBuilder = new LimitOrderBuilder(addresses.INCH_AGGREGATION_ROUTER, 42161, ethers.provider);
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: USDC.address,
        takerAssetAddress: DAI.address,
        makerAddress: strategyDiamond.address,
        makingAmount: 100e6,
        takingAmount: parseEther("200"),
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      limitOrderHash = await router.hashOrder(limitOrder);
    });

    it("Should inch_addOrder", async function () {
      await strategyDiamond.inch_addOrder(limitOrder);
      expect(await strategyDiamond.isValidSignature(limitOrderHash, "0x69")).to.eq("0x1626ba7e");
    });

    it("Should add luca order #1", async function () {
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: WBTC.address,
        takerAssetAddress: USDC.address,
        makerAddress: strategyDiamond.address,
        makingAmount: "2900000",
        takingAmount: "844219000",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      await strategyDiamond.inch_addOrder(limitOrder);
    });

    it("Should NOT add the reverse of luca order #1", async function () {
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: USDC.address,
        takerAssetAddress: WBTC.address,
        makerAddress: strategyDiamond.address,
        makingAmount: "844219000",
        takingAmount: "2900000",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      await expect(strategyDiamond.inch_addOrder(limitOrder)).to.be.revertedWith("GuardError: Invalid order parameters");
    });

    it("Should add luca order #2", async function () {
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: WBTC.address,
        takerAssetAddress: USDC.address,
        makerAddress: strategyDiamond.address,
        makingAmount: "2900000",
        takingAmount: "838163842",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      await strategyDiamond.inch_addOrder(limitOrder);
    });

    it("Should NOT inch_addOrder with disadvantageous order", async function () {
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: USDC.address,
        makerAddress: strategyDiamond.address,
        makingAmount: parseEther("1000"),
        takingAmount: 500e6,
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      await expect(strategyDiamond.inch_addOrder(limitOrder)).to.be.revertedWith("GuardError: Invalid order parameters");
    });

    it("Should NOT inch_addOrder with non-linear getMakingAmount", async function () {
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: USDC.address,
        makerAddress: strategyDiamond.address,
        makingAmount: "1000",
        takingAmount: "500",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
        getMakingAmount: "0x2222",
        getTakingAmount: "",
      });
      await expect(strategyDiamond.inch_addOrder(limitOrder)).to.be.revertedWith("GuardError: Only linear proportions accepted");
    });

    it("Should NOT inch_addOrder with non-linear getTakingAmount", async function () {
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: USDC.address,
        makerAddress: strategyDiamond.address,
        makingAmount: "1000",
        takingAmount: "500",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
        getMakingAmount: "",
        getTakingAmount: "0x2222",
      });
      await expect(strategyDiamond.inch_addOrder(limitOrder)).to.be.revertedWith("GuardError: Only linear proportions accepted");
    });

    it("Should NOT execute ill-formed inch_addOrder", async function () {
      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: test20.address,
        takerAssetAddress: USDC.address,
        makerAddress: strategyDiamond.address,
        makingAmount: "1000",
        takingAmount: "500",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      await expect(strategyDiamond.inch_addOrder(limitOrder)).to.be.revertedWith("Invalid token");

      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: test20.address,
        makerAddress: strategyDiamond.address,
        makingAmount: "1000",
        takingAmount: "500",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      await expect(strategyDiamond.inch_addOrder(limitOrder)).to.be.revertedWith("Invalid token");

      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: USDC.address,
        makerAddress: devWallet.address,
        makingAmount: "1000",
        takingAmount: "500",
        // receiver: ZERO_ADDRESS,
        // allowedSender = ZERO_ADDRESS,
      });
      await expect(strategyDiamond.inch_addOrder(limitOrder)).to.be.revertedWith("GuardError: Invalid maker");

      limitOrder = limitOrderBuilder.buildLimitOrder({
        makerAssetAddress: DAI.address,
        takerAssetAddress: USDC.address,
        makerAddress: strategyDiamond.address,
        makingAmount: "1000",
        takingAmount: "500",
        receiver: devWallet.address,
        // allowedSender = ZERO_ADDRESS,
      });
      await expect(strategyDiamond.inch_addOrder(limitOrder)).to.be.revertedWith("GuardError: Invalid receiver");
    });

    it("Should inch_removeOrder", async function () {
      await strategyDiamond.inch_addOrder(limitOrder);
      expect(await strategyDiamond.isValidSignature(limitOrderHash, "0x69")).to.eq("0x1626ba7e");
      await strategyDiamond.inch_removeOrder(limitOrder);
      expect(await strategyDiamond.isValidSignature(limitOrderHash, "0x69")).to.eq("0x11111111");
    });

    it("Should inch_getHashes", async function () {
      await strategyDiamond.inch_addOrder(limitOrder);
      expect(await strategyDiamond.inch_getHashes()).to.deep.eq([limitOrderHash]);
      await strategyDiamond.inch_removeOrder(limitOrder);
      expect(await strategyDiamond.inch_getHashes()).to.deep.eq([]);
    });

    it("Should inch_getOracleForAsset", async function () {
      expect(await strategyDiamond.inch_getOracleForAsset(USDC.address)).to.eq(ethers.utils.getAddress(addresses.CHAINLINK_USDC_USD));
      expect(await strategyDiamond.inch_getOracleForAsset(test20.address)).to.eq(ethers.constants.AddressZero);
    });
  });

  // NOTE: Fixtures don't work with reset function
  // These transactions are all based on real transactions from VaultV0 trader
  describe("1Inch forked tests", function () {
    // https://phalcon.xyz/tx/arbitrum/0x5c4868e050f172cda84f33c1b9e414a810f3da8c0577ec9fd3406648a24b1fc8?line=0
    it("Should swap USDC to DAI", async function () {
      reset(process.env.ARBITRUM_URL, 51721153);
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor } = await deployStrategy();

      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, router.address, ethers.constants.MaxUint256);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      myexecutor = "0x521709b3cd7f07e29722be0ba28a8ce0e806dbc3";
      dataParam =
        "0x00000000000000000000000000000000000000000000000000014a00011c4330d5b03a99441b088df2923f9e266c906971af2ded00000000000000000000000000000000000000000000001019be0f96e3bf33d7002424b31a0c000000000000000000000000521709b3cd7f07e29722be0ba28a8ce0e806dbc300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fffd8963efd1fc6a506488495d951d5263988d2500000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000ff970a61a04b1ca14834a43f5de4533ebddb5cc880a06c4eca27da10009cbd5d07dd0cecc66161fc93d7c9000da11111111254eeb25477b68fb85ed929f73a960582";

      await expect(() =>
        strategyDiamond.inch_swap(
          0,
          myexecutor,
          [USDC.address, DAI.address, myexecutor, strategyDiamond.address, 300e6, BigNumber.from("297002842416616518615"), 4],
          ethers.utils.toUtf8Bytes(""),
          dataParam,
        ),
      ).to.changeTokenBalance(USDC, strategyDiamond, -300e6);
      expect(await DAI.balanceOf(strategyDiamond.address)).to.be.gt(0);
    });

    // https://phalcon.xyz/tx/arbitrum/0x8494c5527f74efa8115d4f1d05100d4a4bdfa9510dd6c2cc3141c9b81f2fcda8
    it("Should swap ether for USDC", async function () {
      reset(process.env.ARBITRUM_URL, 50689924);
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor } = await deployStrategy();
      await setBalance(strategyDiamond.address, initialWETHBalance);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      myexecutor = "0x521709b3cd7f07e29722be0ba28a8ce0e806dbc3";
      dataParam =
        "0x0000000000000000000000000000000000000000000000b600008800001a404182af49447d8a07e3bd95bd0d56f35241523fbab1d0e30db048227ec3717f70894f6d9ba0be00774610394ce006ee82af49447d8a07e3bd95bd0d56f35241523fbab153c059a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000521709b3cd7f07e29722be0ba28a8ce0e806dbc380a06c4eca27ff970a61a04b1ca14834a43f5de4533ebddb5cc81111111254eeb25477b68fb85ed929f73a960582";

      await expect(() =>
        strategyDiamond.inch_swap(
          parseEther("1.2"),
          myexecutor,
          [
            addresses.INCH_ETHER_TOKEN,
            USDC.address,
            myexecutor,
            strategyDiamond.address,
            parseEther("1.2"),
            BigNumber.from("1482743096"),
            0,
          ],
          ethers.utils.toUtf8Bytes(""),
          dataParam,
        ),
      ).to.changeTokenBalance(USDC, strategyDiamond, BigNumber.from("1497735319"));
    });

    // https://phalcon.xyz/tx/arbitrum/0x1436bd86896153f9f989009124609b24e008c45ee1d6e495b8216777f3e30725
    it("Should swap USDC for ether", async function () {
      reset(process.env.ARBITRUM_URL, 58603590);
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor } = await deployStrategy();

      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, router.address, ethers.constants.MaxUint256);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      dataParam =
        "0x00000000000000000000000000000000000000000000022b0002150001cb00a007e5c0d20000000000000000000000000000000000000000000001a700016b00011c43307acbea3b8ab7cdf4a595c6ed81e7d3e26038d49400000000000000000000000000000000000000000000000009289d2b8bdcba19002424b31a0c00000000000000000000000064768a3a2453f1e8de9e43e92d65fc36e4c9872d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fffd8963efd1fc6a506488495d951d5263988d2500000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000ff970a61a04b1ca14834a43f5de4533ebddb5cc800a0fbb7cd0600fb5e6d0c1dfed2ba000fbc040ab8df3615ac329c0000000000000000000001595979d7b546e38e414f7e9822514be443a480052982af49447d8a07e3bd95bd0d56f35241523fbab1410182af49447d8a07e3bd95bd0d56f35241523fbab100042e1a7d4d000000000000000000000000000000000000000000000000000000000000000000a0f2fa6b66eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000a3c02352e6f794d000000000000000000159571650632b4c0611111111254eeb25477b68fb85ed929f73a960582";

      await expect(() =>
        strategyDiamond.inch_swap(
          0,
          executor,
          [USDC.address, addresses.INCH_ETHER_TOKEN, executor, strategyDiamond.address, 1216e6, BigNumber.from("730092197753323460"), 4],
          ethers.utils.toUtf8Bytes(""),
          dataParam,
        ),
      ).to.changeTokenBalance(USDC, strategyDiamond, -1216e6);
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.be.gt(initialWETHBalance);
    });

    // https://phalcon.xyz/tx/arbitrum/0xab660827a14c2012629962969a8cbdd0a6a8b3bfca1fc8adcd815f4280e1f62b
    it("Should uniswapV3Swap GMX for ether", async function () {
      reset(process.env.ARBITRUM_URL, 61138995);
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor } = await deployStrategy();

      const index = getSlot(strategyDiamond.address, GMX_SLOT);
      await setStorageAt(GMX.address, index, toBytes32(parseEther("100")));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(GMX.address, router.address, ethers.constants.MaxUint256);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      initBal = await ethers.provider.getBalance(strategyDiamond.address);
      await expect(() =>
        strategyDiamond.inch_uniswapV3Swap(0, BigNumber.from("9565081129651921048"), BigNumber.from("453361178091562290"), [
          BigNumber.from("72370055773322622139731865630583703016275834805848221369532777935219250903170"),
        ]),
      ).to.changeTokenBalance(GMX, strategyDiamond, BigNumber.from("-9565081129651921048"));
      afterBal = await ethers.provider.getBalance(strategyDiamond.address);
      expect(afterBal).to.be.gt(initBal);
    });

    // same transaction as above
    it("Should uniswapV3Swap with api data", async function () {
      reset(process.env.ARBITRUM_URL, 61138995);
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor } = await deployStrategy();

      const index = getSlot(strategyDiamond.address, GMX_SLOT);
      await setStorageAt(GMX.address, index, toBytes32(parseEther("100")));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(GMX.address, router.address, ethers.constants.MaxUint256);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      initBal = await ethers.provider.getBalance(strategyDiamond.address);
      apiData =
        "0xe449022e00000000000000000000000000000000000000000000000084bdfe9c04b1e098000000000000000000000000000000000000000000000000064aa996e719a53200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001a000000000000000000000001aeedd3727a6431b8f070c0afaa81cc74f273882e26b9977";
      params = convertAPIDataToParams(apiData);
      await expect(() => strategyDiamond.inch_uniswapV3Swap(0, params.amount, params.minReturn, params.pools)).to.changeTokenBalance(
        GMX,
        strategyDiamond,
        BigNumber.from("-9565081129651921048"),
      );
      afterBal = await ethers.provider.getBalance(strategyDiamond.address);
      expect(afterBal).to.be.gt(initBal);
    });

    // won't work because the signature
    // https://phalcon.xyz/tx/arbitrum/0x88340d7362bddecfad3dc61152029466f4af10ac99431588b29780cf6cb877f8
    it("Should clipperSwap", async function () {
      reset(process.env.ARBITRUM_URL, 77642486);
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor } = await deployStrategy();
      await setBalance(strategyDiamond.address, initialWETHBalance);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      apiData =
        "0x84bd6d29000000000000000000000000e7b0ce0526fbe3969035a145c9e9691d4d9d216c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ff970a61a04b1ca14834a43f5de4533ebddb5cc80000000000000000000000000000000000000000000000000146d98337560000000000000000000000000000000000000000000000000000000000000a38d3db0000002b686f05200000000005f5e100016345785d8a000000640096642ec2bce3a2311de286b776ab8258f3d1976d366818eeee8b188081e68595245c3f1db5a74a3111bb2e742494ce662fa830ddae584240179c6997fca9d8ad10d82ff7b5e26b9977";
      params = convertAPIDataToParams(apiData);
      await expect(
        strategyDiamond.inch_clipperSwap(
          parseEther(".092"),
          params.clipperExchange,
          params.srcToken,
          params.dstToken,
          params.inputAmount,
          params.outputAmount,
          params.goodUntil,
          params.r,
          params.vs,
        ),
      ).to.be.revertedWith("Message signed by incorrect address");
    });

    it("Should Ramzan swap", async function () {
      reset(process.env.ARBITRUM_URL, 77358809);

      USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
      WETH = await ethers.getContractAt("IWETH", addresses.WETH);
      router = await ethers.getContractAt("IAggregationRouter", addresses.INCH_AGGREGATION_ROUTER);
      ramzan = await ethers.getImpersonatedSigner("0xAF68e7121974B7276777DfFCbC14ee676155693E");
      await setBalance(ramzan.address, initialWETHBalance);

      api_data =
        "0x12aa3caf00000000000000000000000064768a3a2453f1e8de9e43e92d65fc36e4c9872d00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000912ce59144191c1204e64559fe8253a0e49e6548000000000000000000000000afebf9bba7984954e42d7551ab0ce47130bfdc0a000000000000000000000000af68e7121974b7276777dffcbc14ee676155693e00000000000000000000000000000000000000000000000000005af3107a40000000000000000000000000000000000000000000000000000223b1f41c5b37330000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007800000000000000000000000000000000000000000000000000000000005a4020afebf9bba7984954e42d7551ab0ce47130bfdc0a53c059a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111254eeb25477b68fb85ed929f73a9605820000000000000000cfee7c08";
      params = convertAPIDataToParams(api_data);
      await router
        .connect(ramzan)
        .swap(
          params.executor,
          [
            params.desc.srcToken,
            params.desc.dstToken,
            params.desc.srcReceiver,
            params.desc.dstReceiver,
            params.desc.amount,
            params.desc.minReturnAmount,
            params.desc.flags,
          ],
          params.permit,
          params.data,
        );
    });

    // https://explorer.phalcon.xyz/tx/arbitrum/0x6bc7acfcdbdef5bbe5eddaf2ff3c014fe152f574b1c02b0d5370cf65b9856ce9
    it("Should fill order", async function () {
      reset(process.env.ARBITRUM_URL, 56510206);
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor } = await deployStrategy();
      USDT = await ethers.getContractAt("TestFixture_ERC20", addresses.USDT);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, router.address, ethers.constants.MaxUint256);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      order = [
        358416172978, // salt
        USDT.address, // makerAsset
        USDC.address, // takerAsset
        "0xc9c8a2ae2354a97e737301133fcd2f95de88529b", // maker
        ethers.constants.AddressZero, // receiver
        ethers.constants.AddressZero, // allowedSender
        BigNumber.from("1000000000000000"), // makingAmount
        BigNumber.from("1000025000000000"), //takingAmount
        BigNumber.from("4421431254442149611168492388118363282642987198110904030635476664713216"), //offsets
        "0xbf15fcd8000000000000000000000000d7936052d1e096d48c81ef3918f9fd6384108480000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000242cc2878d0065abb18200000000090000c9c8a2ae2354a97e737301133fcd2f95de88529b00000000000000000000000000000000000000000000000000000000", // interactions
      ];
      signature =
        "0x5aaa6554d3fb4746672bd457021a1af1fa2a54e3b00db03328e75b1b0c5a35263f2b36dca205e3c53a10846d8cc3450e72f69466ce20437b1e4e87e7fb70c32a1c";

      await expect(() => strategyDiamond.inch_fillOrder(0, order, signature, "0x", 0, 3000e6, 0)).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -3000e6,
      );
      expect(await USDT.balanceOf(strategyDiamond.address)).to.eq(BigNumber.from("2999925001"));
    });

    // Just taking order from above and making sure trader could add it
    it("Should addOrder", async function () {
      const { strategyDiamond, vault, test20, USDC, DAI, WETH, WBTC, GMX, router, executor } = await deployStrategy();
      USDT = await ethers.getContractAt("TestFixture_ERC20", addresses.USDT);

      order = [
        358416172978, // salt
        USDT.address, // makerAsset
        USDC.address, // takerAsset
        strategyDiamond.address, // maker
        ethers.constants.AddressZero, // receiver
        ethers.constants.AddressZero, // allowedSender
        BigNumber.from("1000000000000000"), // makingAmount
        BigNumber.from("1000025000000000"), //takingAmount
        BigNumber.from("4421431254442149611168492388118363282642987198110904030635476664713216"), //offsets
        "0xbf15fcd8000000000000000000000000d7936052d1e096d48c81ef3918f9fd6384108480000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000242cc2878d0065abb18200000000090000c9c8a2ae2354a97e737301133fcd2f95de88529b00000000000000000000000000000000000000000000000000000000", // interactions
      ];
      await strategyDiamond.inch_addOrder(order);
      hash = await router.hashOrder(order);
      expect(await strategyDiamond.inch_getHashes()).to.deep.eq([hash]);
    });
  });
});
