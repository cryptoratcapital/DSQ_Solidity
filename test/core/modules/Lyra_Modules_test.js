const { expect, use } = require("chai");
const { solidity, deployMockContract } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther, formatEther, parseUnits } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { setBalance, loadFixture, reset } = require("@nomicfoundation/hardhat-network-helpers");
const { toBytes32, setStorageAt, getSlot, findBalanceSlot } = require("../../helpers/storageHelpers.js");
const addressesAndParams = require("../../helpers/addressesAndParams.json");
const GMXAdapterABI = require("../../helpers/gmx/abi.js");
const { getNetworkConfig, forkOrSkip } = require("../../helpers/forkHelpers.js");

require("dotenv").config();
use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, feeReceiver] = provider.getWallets();

let forkConfigs = {
  arbitrum: {
    name: "arbitrum",
    url: process.env.ARBITRUM_URL || "https://rpc.ankr.com/arbitrum",
    blockNumber: 70171432,
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
  ARB_SLOT = forkConfig.parameters.ARB_SLOT;

  const initialPerformanceFee = parseEther("0.1"); // 10% fee
  const initialManagementFee = parseEther("0.01"); // 1% fee

  const strategyDiamondName = "ARB++";
  const allowedTokens = [addresses.USDC, addresses.WETH, addresses.DAI, addresses.GMX, addresses.WBTC, addresses.LYRA];
  const allowedSpenders = [
    addresses.GMX_ROUTER,
    addresses.GMX_POSITIONROUTER,
    addresses.GMX_ORDERBOOK,
    addresses.CAMELOT_ROUTER,
    addresses.LYRA_LIQUIDITY_POOL_WETH,
    addresses.LYRA_WETH_OPTION_MARKET,
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

  LyraStorageFacet = await ethers.getContractFactory("Lyra_Storage_Module");
  lyraStorageFacet = await LyraStorageFacet.deploy(addresses.LYRA_REGISTRY);

  LyraLPFacet = await ethers.getContractFactory("Lyra_LP_Module");
  lyraLPFacet = await LyraLPFacet.deploy();

  LyraOptionsFacet = await ethers.getContractFactory("Lyra_Options_Module");
  lyraOptionsFacet = await LyraOptionsFacet.deploy();

  LyraRewardsFacet = await ethers.getContractFactory("Lyra_Rewards_Module");
  lyraRewardsFacet = await LyraRewardsFacet.deploy(addresses.LYRA_MULTI_DISTRIBUTOR, addresses.CAMELOT_ROUTER);

  Strategy = await ethers.getContractFactory("TestFixture_Strategy_Lyra");
  strategy = await Strategy.deploy(
    devWallet.address,
    traderFacet.address,
    traderInitializerParams,
    lyraStorageFacet.address,
    lyraLPFacet.address,
    lyraOptionsFacet.address,
    lyraRewardsFacet.address,
  );

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_Lyra", strategy.address);

  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  WETH = await ethers.getContractAt("IWETH", addresses.WETH);
  WBTC = await ethers.getContractAt("TestFixture_ERC20", addresses.WBTC);
  pool = await ethers.getContractAt("ILiquidityPool", addresses.LYRA_LIQUIDITY_POOL_WETH);
  liquidityToken = await ethers.getContractAt("TestFixture_ERC20", addresses.LYRA_LIQUIDITY_TOKEN_WETH);
  weth_option_market = await ethers.getContractAt("IOptionMarket", addresses.LYRA_WETH_OPTION_MARKET);
  weth_option_token = await ethers.getContractAt("IOptionToken", addresses.LYRA_WETH_OPTION_TOKEN);

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "ETH++ Vault", "ETH-DSQ-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  await strategyDiamond.connect(devWallet).addLyraMarket(addresses.LYRA_WETH_OPTION_MARKET);

  return { strategyDiamond, vault, test20, USDC, WETH, WBTC, pool, liquidityToken, weth_option_market, weth_option_token };
}

// Tests have to be on blockNumber - 70171432
describe("Lyra", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("Lyra_Common_Storage", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, pool, liquidityToken } = await loadFixture(deployStrategy);
      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, weth_option_market.address, initialUSDCBalance);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should addLyraMarket", async function () {
      await expect(strategyDiamond.connect(devWallet).addLyraMarket(addresses.LYRA_WETH_OPTION_MARKET))
        .to.emit(strategyDiamond, "NewLyraMarket")
        .withArgs(addresses.LYRA_WETH_OPTION_MARKET, addresses.LYRA_LIQUIDITY_POOL_WETH);
      await expect(
        strategyDiamond
          .connect(devWallet)
          .lyra_openPosition(weth_option_market.address, [
            89,
            0,
            3,
            0,
            parseEther("1"),
            0,
            0,
            ethers.constants.MaxUint256,
            ethers.constants.AddressZero,
          ]),
      ).to.not.be.reverted;
      expect(await strategyDiamond.getAllowedLyraMarkets()).to.include(addresses.LYRA_WETH_OPTION_MARKET);
    });

    it("Should NOT addLyraMarket if not EXECUTOR_ROLE", async function () {
      await expect(strategyDiamond.connect(citizen1).addLyraMarket(addresses.LYRA_WBTC_OPTION_MARKET)).to.be.reverted;
    });

    it("Should NOT addLyraMarket for incorrect address", async function () {
      await expect(strategyDiamond.connect(devWallet).addLyraMarket(addresses.LYRA_LIQUIDITY_POOL)).to.be.reverted;
    });

    it("Should NOT addLyraMarket with a quote or base asset outside the mandate", async function () {
      strategy2 = await Strategy.deploy(
        devWallet.address,
        traderFacet.address,
        [
          "Lyra Strategy",
          [addresses.USDC, addresses.WETH, addresses.DAI, addresses.GMX, addresses.LYRA],
          [
            addresses.GMX_ROUTER,
            addresses.GMX_POSITIONROUTER,
            addresses.GMX_ORDERBOOK,
            addresses.CAMELOT_ROUTER,
            addresses.LYRA_LIQUIDITY_POOL_WETH,
            addresses.LYRA_WETH_OPTION_MARKET,
          ],
          parseEther("0.1"),
          parseEther("0.01"),
        ],
        lyraStorageFacet.address,
        lyraLPFacet.address,
        lyraOptionsFacet.address,
        lyraRewardsFacet.address,
      );

      strategyDiamond2 = await ethers.getContractAt("StrategyDiamond_TestFixture_Lyra", strategy2.address);
      await expect(strategyDiamond2.connect(devWallet).addLyraMarket(addresses.LYRA_WBTC_OPTION_MARKET)).to.be.revertedWith(
        "Invalid token",
      );
    });

    it("Should removeLyraMarket", async function () {
      await strategyDiamond.connect(devWallet).addLyraMarket(addresses.LYRA_WBTC_OPTION_MARKET);
      await expect(strategyDiamond.connect(devWallet).removeLyraMarket(addresses.LYRA_WBTC_OPTION_MARKET))
        .to.emit(strategyDiamond, "RemovedLyraMarket")
        .withArgs(addresses.LYRA_WBTC_OPTION_MARKET, addresses.LYRA_LIQUIDITY_POOL_WBTC);
      await expect(
        strategyDiamond
          .connect(devWallet)
          .lyra_openPosition(addresses.LYRA_WBTC_OPTION_MARKET, [
            89,
            0,
            3,
            0,
            parseEther("1"),
            0,
            0,
            ethers.constants.MaxUint256,
            ethers.constants.AddressZero,
          ]),
      ).to.be.revertedWith("Invalid market");
      expect(await strategyDiamond.getAllowedLyraMarkets()).to.not.include(addresses.LYRA_WBTC_OPTION_MARKET);
    });

    it("Should NOT removeLyraMarket if not EXECUTOR_ROLE", async function () {
      await strategyDiamond.connect(devWallet).addLyraMarket(addresses.LYRA_WBTC_OPTION_MARKET);
      await expect(strategyDiamond.connect(citizen1).removeLyraMarket(addresses.LYRA_WBTC_OPTION_MARKET)).to.be.revertedWith(
        "AccessControl: ",
      );
    });

    it("Should getAllowedLyraMarkets", async function () {
      await strategyDiamond.connect(devWallet).addLyraMarket(addresses.LYRA_WBTC_OPTION_MARKET);
      expect(await strategyDiamond.getAllowedLyraMarkets()).to.deep.eq([
        addresses.LYRA_WETH_OPTION_MARKET,
        addresses.LYRA_WBTC_OPTION_MARKET,
      ]);
    });

    it("Should getAllowedLyraPools", async function () {
      expect(await strategyDiamond.getAllowedLyraPools()).to.deep.eq([addresses.LYRA_LIQUIDITY_POOL_WETH]);

      await strategyDiamond.connect(devWallet).addLyraMarket(addresses.LYRA_WBTC_OPTION_MARKET);
      expect(await strategyDiamond.getAllowedLyraPools()).to.deep.eq([
        addresses.LYRA_LIQUIDITY_POOL_WETH,
        addresses.LYRA_LIQUIDITY_POOL_WBTC,
      ]);
    });

    it("Should getLyraPoolQuoteAsset", async function () {
      await strategyDiamond.connect(devWallet).addLyraMarket(addresses.LYRA_WETH_OPTION_MARKET);
      expect(await strategyDiamond.getLyraPoolQuoteAsset(addresses.LYRA_LIQUIDITY_POOL_WETH)).to.eq(addresses.USDC);
    });
  });

  describe("Lyra_LP_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, pool, liquidityToken } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should initiateDeposit", async function () {
      this.timeout(0);
      initBal = await liquidityToken.balanceOf(strategyDiamond.address);
      await expect(
        strategyDiamond.connect(devWallet).lyra_initiateDeposit(pool.address, strategyDiamond.address, initialUSDCBalance),
      ).to.emit(pool, "DepositQueued");

      // Mock oracle to return price. Overwrite lastUpdatedTime for GreekCache
      await deployMockAndOverwriteAddress(pool.address, parseEther("1641.6"));
      await increaseTimeAndUpdateGreekCache();
      await pool.processDepositQueue(200);

      afterBal = await liquidityToken.balanceOf(strategyDiamond.address);
      expect(afterBal).to.be.gt(initBal);
    });

    it("Should NOT execute ill-formed initiateDeposit", async function () {
      await expect(
        strategyDiamond.connect(devWallet).lyra_initiateDeposit(citizen1.address, strategyDiamond.address, 100e6),
      ).to.be.revertedWith("Invalid pool");
      await expect(strategyDiamond.connect(devWallet).lyra_initiateDeposit(pool.address, citizen1.address, 100e6)).to.be.revertedWith(
        "GuardError: Invalid recipient",
      );
    });

    it("Should initiateWithdraw", async function () {
      this.timeout(0);
      await expect(strategyDiamond.connect(devWallet).lyra_initiateDeposit(pool.address, strategyDiamond.address, 100e6)).to.emit(
        pool,
        "DepositQueued",
      );

      // Mock oracle to return price. Overwrite lastUpdatedTime for GreekCache
      await deployMockAndOverwriteAddress(pool.address, parseEther("1641.6"));
      await increaseTimeAndUpdateGreekCache();
      await pool.processDepositQueue(200);

      initBal = await USDC.balanceOf(strategyDiamond.address);
      await expect(
        strategyDiamond.connect(devWallet).lyra_initiateWithdraw(pool.address, strategyDiamond.address, parseEther("1")),
      ).to.emit(pool, "WithdrawQueued");

      // Overwrite lastUpdatedTime for GreekCache
      await increaseTimeAndUpdateGreekCache();
      await pool.processWithdrawalQueue(200);

      afterBal = await USDC.balanceOf(strategyDiamond.address);
      expect(afterBal).to.be.gt(initBal);
    });

    it("Should NOT execute ill-formed initiateWithdraw", async function () {
      await expect(
        strategyDiamond.connect(devWallet).lyra_initiateWithdraw(citizen1.address, strategyDiamond.address, 100e6),
      ).to.be.revertedWith("Invalid pool");
      await expect(strategyDiamond.connect(devWallet).lyra_initiateWithdraw(pool.address, citizen1.address, 100e6)).to.be.revertedWith(
        "GuardError: Invalid recipient",
      );
    });
  });

  describe("Lyra_Options_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, weth_option_market, weth_option_token } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, weth_option_market.address, initialUSDCBalance);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should openNewPosition for LONG_CALL", async function () {
      initBal = await USDC.balanceOf(strategyDiamond.address);
      await expect(
        strategyDiamond
          .connect(devWallet)
          .lyra_openPosition(weth_option_market.address, [
            89,
            0,
            3,
            0,
            parseEther("1"),
            0,
            0,
            ethers.constants.MaxUint256,
            ethers.constants.AddressZero,
          ]),
      ).to.emit(weth_option_market, "Trade");
      afterBal = await USDC.balanceOf(strategyDiamond.address);

      expect(afterBal).to.be.lt(initBal);
      positions = await weth_option_token.getOwnerPositions(strategyDiamond.address);
      expect(positions[0].strikeId).to.eq(89);
      expect(positions[0].optionType).to.eq(0);
      expect(positions[0].amount).to.eq(parseEther("1"));
      expect(positions[0].state).to.eq(1); // ACTIVE
    });

    it("Should openNewPosition for SHORT_CALL_QUOTE", async function () {
      initBal = await USDC.balanceOf(strategyDiamond.address);
      await expect(
        strategyDiamond
          .connect(devWallet)
          .lyra_openPosition(weth_option_market.address, [
            89,
            0,
            3,
            3,
            parseEther("1"),
            parseEther("1500"),
            0,
            ethers.constants.MaxUint256,
            ethers.constants.AddressZero,
          ]),
      ).to.emit(weth_option_market, "Trade");
      afterBal = await USDC.balanceOf(strategyDiamond.address);

      expect(afterBal).to.be.lt(initBal);
      positions = await weth_option_token.getOwnerPositions(strategyDiamond.address);
      expect(positions[0].strikeId).to.eq(89);
      expect(positions[0].optionType).to.eq(3);
      expect(positions[0].amount).to.eq(parseEther("1"));
      expect(positions[0].collateral).to.eq(parseEther("1500"));
      expect(positions[0].state).to.eq(1); // ACTIVE
    });

    it("Should not execute ill-formed openNewPosition", async function () {
      await expect(
        strategyDiamond
          .connect(devWallet)
          .lyra_openPosition(citizen1.address, [
            89,
            0,
            3,
            0,
            parseEther("1"),
            0,
            0,
            ethers.constants.MaxUint256,
            ethers.constants.AddressZero,
          ]),
      ).to.be.revertedWith("Invalid market");
    });

    it("Should addCollateral", async function () {
      await strategyDiamond
        .connect(devWallet)
        .lyra_openPosition(weth_option_market.address, [
          89,
          0,
          3,
          3,
          parseEther("1"),
          parseEther("1500"),
          0,
          ethers.constants.MaxUint256,
          ethers.constants.AddressZero,
        ]);
      positions = await weth_option_token.getOwnerPositions(strategyDiamond.address);
      expect(positions[0].collateral).to.eq(parseEther("1500"));

      await expect(() =>
        strategyDiamond.connect(devWallet).lyra_addCollateral(weth_option_market.address, positions[0].positionId, parseEther("100")),
      ).to.changeTokenBalance(USDC, strategyDiamond, -100e6);
      positions = await weth_option_token.getOwnerPositions(strategyDiamond.address);
      expect(positions[0].collateral).to.eq(parseEther("1600"));
    });

    it("Should not execute ill-formed addCollateral", async function () {
      await expect(strategyDiamond.connect(devWallet).lyra_addCollateral(citizen1.address, 3632, 100e6)).to.be.revertedWith(
        "Invalid market",
      );
    });

    it("Should closePosition", async function () {
      await expect(
        strategyDiamond.lyra_openPosition(weth_option_market.address, [
          89,
          0,
          3,
          0,
          parseEther("1"),
          0,
          0,
          ethers.constants.MaxUint256,
          ethers.constants.AddressZero,
        ]),
      ).to.emit(weth_option_market, "Trade");
      positions = await weth_option_token.getOwnerPositions(strategyDiamond.address);
      expect(positions[0].amount).to.eq(parseEther("1"));

      positionId = positions[0].positionId;
      await strategyDiamond.lyra_closePosition(weth_option_market.address, [
        89,
        positionId,
        3,
        0,
        parseEther("1"),
        0,
        0,
        ethers.constants.MaxUint256,
        ethers.constants.AddressZero,
      ]);
      position = await weth_option_token.getOptionPosition(positionId);
      expect(position.amount).to.eq(0);
      expect(position.state).to.eq(2); // 2 = CLOSED
    });

    it("Should not execute ill-formed closePosition", async function () {
      await expect(
        strategyDiamond.lyra_closePosition(citizen1.address, [
          89,
          0,
          3,
          0,
          parseEther("1"),
          0,
          0,
          ethers.constants.MaxUint256,
          ethers.constants.AddressZero,
        ]),
      ).to.be.revertedWith("Invalid market");
    });

    it("Should forceClosePosition", async function () {
      await expect(
        strategyDiamond.lyra_openPosition(weth_option_market.address, [
          89,
          0,
          3,
          0,
          parseEther("1"),
          0,
          0,
          ethers.constants.MaxUint256,
          ethers.constants.AddressZero,
        ]),
      ).to.emit(weth_option_market, "Trade");
      positions = await weth_option_token.getOwnerPositions(strategyDiamond.address);
      expect(positions[0].amount).to.eq(parseEther("1"));

      // Mock oracle to return price. Overwrite lastUpdatedTime for GreekCache
      // Have to lower price for forceClose to pass
      await deployMockAndOverwriteAddress(weth_option_market.address, parseEther("641.6"));
      await strategyDiamond.lyra_forceClosePosition(weth_option_market.address, [
        89,
        positions[0].positionId,
        3,
        0,
        parseEther("1"),
        0,
        0,
        ethers.constants.MaxUint256,
        ethers.constants.AddressZero,
      ]);
    });

    it("Should not execute ill-formed forceClosePosition", async function () {
      await expect(
        strategyDiamond.lyra_forceClosePosition(citizen1.address, [
          89,
          0,
          3,
          0,
          parseEther("1"),
          0,
          0,
          ethers.constants.MaxUint256,
          ethers.constants.AddressZero,
        ]),
      ).to.be.revertedWith("Invalid market");
    });
  });

  describe("Lyra_Rewards_Module", function () {
    beforeEach(async function () {
      await reset(forkConfig.url, 126531323);
      const { strategyDiamond, vault, test20, USDC, WETH, weth_option_market, weth_option_token } = await deployStrategy();
      await setBalance(strategyDiamond.address, initialWETHBalance);

      timestamp = (await ethers.provider.getBlock()).timestamp;
      multiDistributor = await ethers.getContractAt("IMultiDistributor", addresses.LYRA_MULTI_DISTRIBUTOR);
      const distributorSlot = getSlot(multiDistributor.address, USDC_SLOT);
      await setStorageAt(USDC.address, distributorSlot, toBytes32(initialUSDCBalance));

      distributorRewardsWhitelisted = await ethers.getImpersonatedSigner("0x8ca2c6d79dbc78ceca382136be590ea63eb28b89");
      distributorOwner = await ethers.getImpersonatedSigner("0x2CcF21e5912e9ecCcB0ecdEe9744E5c507cf88AE");
      await setBalance(distributorOwner.address, initialWETHBalance);

      lyra = await ethers.getContractAt("TestFixture_ERC20", addresses.LYRA);
      arb = await ethers.getContractAt("TestFixture_ERC20", addresses.ARB);
      arb_weth_pair = await ethers.getContractAt("ICamelotPair", "0xa6c5C7D189fA4eB5Af8ba34E63dCDD3a635D433f");
      lyra_weth_pair = await ethers.getContractAt("ICamelotPair", "0x5Fa594Dd5e198DE5E7EF539F1b8fB154AeFD3891");

      batchId = await ethers.provider.getStorageAt(multiDistributor.address, 1);
    });

    it("lyra_claimRewards: should NOT claim a token that is not in the mandate", async function () {
      await multiDistributor
        .connect(distributorRewardsWhitelisted)
        .addToClaims([parseEther("100")], [strategyDiamond.address], addresses.USDT, timestamp, "StrategyDiamond");
      await multiDistributor.connect(distributorOwner).approveClaims([batchId], true);
      await expect(strategyDiamond.lyra_claimRewards([batchId])).to.be.revertedWith("Invalid token");
    });

    it("lyra_claimRewards: should claim a token in the mandate", async function () {
      await multiDistributor
        .connect(distributorRewardsWhitelisted)
        .addToClaims([100e6], [strategyDiamond.address], addresses.USDC, timestamp, "StrategyDiamond");
      await multiDistributor.connect(distributorOwner).approveClaims([batchId], true);
      await expect(() => strategyDiamond.lyra_claimRewards([batchId])).to.changeTokenBalance(USDC, strategyDiamond, 100e6);
    });

    it("Should lyra_dump", async function () {
      await multiDistributor
        .connect(distributorRewardsWhitelisted)
        .addToClaims([100e6], [strategyDiamond.address], addresses.USDC, timestamp, "StrategyDiamond");
      await multiDistributor.connect(distributorOwner).approveClaims([batchId], true);
      await expect(() => strategyDiamond.lyra_claimRewards([batchId])).to.changeTokenBalance(USDC, strategyDiamond, 100e6);

      beforeBal = await WETH.balanceOf(strategyDiamond.address);
      await expect(() => strategyDiamond.lyra_dump([[[USDC.address, WETH.address], 10]])).to.changeTokenBalance(
        USDC,
        strategyDiamond,
        -100e6,
      );
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(beforeBal);
    });

    it("Should NOT lyra_dump if less than amountOut", async function () {
      await multiDistributor
        .connect(distributorRewardsWhitelisted)
        .addToClaims([100e6], [strategyDiamond.address], addresses.USDC, timestamp, "StrategyDiamond");
      await multiDistributor.connect(distributorOwner).approveClaims([batchId], true);
      await expect(() => strategyDiamond.lyra_claimRewards([batchId])).to.changeTokenBalance(USDC, strategyDiamond, 100e6);

      await expect(strategyDiamond.lyra_dump([[[USDC.address, WETH.address], parseEther("100")]])).to.be.revertedWith(
        "CamelotRouter: INSUFFICIENT_OUTPUT_AMOUNT",
      );
    });

    it("Should NOT lyra_dump if swap path is empty", async function () {
      await expect(strategyDiamond.lyra_dump([[[], parseEther("100")]])).to.be.revertedWith("Lyra_Rewards_Module: Empty path");
    });

    it("Should NOT lyra_dump if swap path contains bad token", async function () {
      await expect(strategyDiamond.lyra_dump([[[USDC.address, addresses.USDT], parseEther("100")]])).to.be.revertedWith("Invalid token");
    });

    it("Should lyra_claimAndDump", async function () {
      await multiDistributor
        .connect(distributorRewardsWhitelisted)
        .addToClaims([100e6], [strategyDiamond.address], addresses.USDC, timestamp, "StrategyDiamond");
      await multiDistributor.connect(distributorOwner).approveClaims([batchId], true);

      beforeBal = await WETH.balanceOf(strategyDiamond.address);
      await expect(strategyDiamond.lyra_claimAndDump([batchId], [[[USDC.address, WETH.address], 10]]));
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(beforeBal);
    });

    it("Should NOT lyra_claimAndDump if first swap token doesn't match reward token", async function () {
      await multiDistributor
        .connect(distributorRewardsWhitelisted)
        .addToClaims([100e6], [strategyDiamond.address], addresses.USDC, timestamp, "StrategyDiamond");
      await multiDistributor.connect(distributorOwner).approveClaims([batchId], true);

      await expect(strategyDiamond.lyra_claimAndDump([batchId], [[[WETH.address, WETH.address], 10]])).to.be.revertedWith(
        "Lyra_Rewards_Module: Claim token does not start path",
      );
    });

    it("Should NOT lyra_claimAndDump if path is empty", async function () {
      await expect(strategyDiamond.lyra_claimAndDump([batchId], [[[], 10]])).to.be.revertedWith("Lyra_Rewards_Module: Empty path");
    });

    it("Should NOT lyra_claimAndDump if array lengths do not match", async function () {
      await expect(strategyDiamond.lyra_claimAndDump([batchId, batchId], [[[USDC.address, WETH.address], 10]])).to.be.revertedWith(
        "Lyra_Rewards_Module: Length mismatch",
      );
    });

    it("Should NOT lyra_claimAndDump if path contains bad token", async function () {
      await multiDistributor
        .connect(distributorRewardsWhitelisted)
        .addToClaims([100e6], [strategyDiamond.address], addresses.USDC, timestamp, "StrategyDiamond");
      await multiDistributor.connect(distributorOwner).approveClaims([batchId], true);

      await expect(strategyDiamond.lyra_claimAndDump([batchId], [[[USDC.address, addresses.USDT], 10]])).to.be.revertedWith(
        "Invalid token",
      );
    });
  });

  describe("TraderV0 Trade Simluations", function () {
    // https://phalcon.xyz/tx/arbitrum/0xfe5dbcbff78d36e2c27d70118e6b433fa7648d7c8cf977cd68bdd07fe9c275be
    it("Should openPosition", async function () {
      // ---------- SETUP -------------------

      reset(process.env.ARBITRUM_URL, 57305269);
      const { strategyDiamond, vault, test20, USDC, WETH, WBTC, pool, liquidityToken, weth_option_market, weth_option_token } =
        await deployStrategy();

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, weth_option_market.address, initialUSDCBalance);

      timestamp = (await ethers.provider.getBlock()).timestamp;

      // ---------- SETUP -------------------

      initBal = await USDC.balanceOf(strategyDiamond.address);
      await expect(
        strategyDiamond
          .connect(devWallet)
          .lyra_openPosition(weth_option_market.address, [
            44,
            0,
            3,
            0,
            parseEther("1.6"),
            0,
            0,
            BigNumber.from("152319281553571198301"),
            ethers.constants.AddressZero,
          ]),
      ).to.emit(weth_option_market, "Trade");
      afterBal = await USDC.balanceOf(strategyDiamond.address);

      position = await weth_option_token.getPositionWithOwner(184);
      expect(afterBal).to.be.lt(initBal);
      expect(position.owner).to.eq(strategyDiamond.address);
      expect(position.amount).to.eq(parseEther("1.6"));
      expect(position.strikeId).to.eq(44);
      expect(position.state).to.eq(1); // ACTIVE
      expect(position.optionType).to.eq(0);
    });
  });
});

// ---------- HELPERS -------------------

async function increaseTimeAndUpdateGreekCache() {
  await ethers.provider.send("evm_increaseTime", [100 * 24 * 60 * 60]);
  await ethers.provider.send("evm_mine", []);

  // Update Greek Cache update time for isGlobalCacheStale function call
  time = (await ethers.provider.getBlock()).timestamp;
  time = BigNumber.from(time.toString());
  await network.provider.send("hardhat_setStorageAt", [
    addresses.LYRA_GREEK_CACHE,
    ethers.utils.hexlify(forkConfig.parameters.GREEK_CACHE_TIME_SLOT),
    ethers.utils.hexZeroPad(time.toHexString(), 32),
  ]);
}

async function deployMockAndOverwriteAddress(address, price) {
  const mockGMXAdapter = await deployMockContract(devWallet, GMXAdapterABI);
  await mockGMXAdapter.mock.getSpotPriceForMarket.returns(price);
  await network.provider.send("hardhat_setStorageAt", [
    address,
    ethers.utils.hexlify(forkConfig.parameters.LYRA_POOL_GMX_ADAPTER_SLOT),
    ethers.utils.hexZeroPad(mockGMXAdapter.address, 32),
  ]);
  return mockGMXAdapter;
}
