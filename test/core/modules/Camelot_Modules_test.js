const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther, formatEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { setBalance, loadFixture, reset } = require("@nomicfoundation/hardhat-network-helpers");
const { toBytes32, setStorageAt, getSlot, findBalanceSlot } = require("../../helpers/storageHelpers.js");
const { calculateLiquidityAmount } = require("../../helpers/camelot/calculationHelpers.js");
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
    blockNumber: 41600000,
    addresses: addressesAndParams["arb_mainnet"].addresses,
    parameters: addressesAndParams["arb_mainnet"].parameters,
  },
};

let forkConfig = getNetworkConfig(forkConfigs);

let traderInitializerParams;
if (forkConfig !== undefined) {
  addresses = forkConfig.addresses;
  USDC_SLOT = forkConfig.parameters.USDC_SLOT;
  USDT_SLOT = forkConfig.parameters.USDT_SLOT;
  DAI_SLOT = forkConfig.parameters.DAI_SLOT;

  const initialPerformanceFee = parseEther("0.1"); // 10% fee
  const initialManagementFee = parseEther("0.01"); // 1% fee

  const strategyDiamondName = "TestFixture_Strategy_Camelot";
  const allowedTokens = [addresses.USDC, addresses.WETH, addresses.DAI, addresses.GMX, addresses.USDT];
  const allowedSpenders = [addresses.CAMELOT_ROUTER, addresses.CAMELOT_POSITION_MANAGER, addresses.CAMELOT_ODOS_ROUTER];
  traderInitializerParams = [strategyDiamondName, allowedTokens, allowedSpenders, initialPerformanceFee, initialManagementFee];
}

const initialUSDCBalance = BigNumber.from(10000e6);
const initialWETHBalance = parseEther("100");

const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

async function deployStrategy() {
  TraderV0 = await ethers.getContractFactory("TraderV0");
  traderFacet = await TraderV0.deploy(maxPerformanceFee, maxManagementFee);

  CamelotLPFacet = await ethers.getContractFactory("Camelot_LP_Module");
  camelotLPFacet = await CamelotLPFacet.deploy(addresses.CAMELOT_ROUTER, addresses.WETH);

  CamelotV3Facet = await ethers.getContractFactory("Camelot_V3_Module");
  camelotV3Facet = await CamelotV3Facet.deploy(addresses.CAMELOT_POSITION_MANAGER, addresses.CAMELOT_ODOS_ROUTER);

  CamelotNFTPoolFacet = await ethers.getContractFactory("Camelot_NFTPool_Module");
  camelotNFTPoolFacet = await CamelotNFTPoolFacet.deploy();

  CamelotNitroPoolFacet = await ethers.getContractFactory("Camelot_NitroPool_Module");
  camelotNitroPoolFacet = await CamelotNitroPoolFacet.deploy();

  CamelotSwapFacet = await ethers.getContractFactory("Camelot_Swap_Module");
  camelotSwapFacet = await CamelotSwapFacet.deploy(addresses.CAMELOT_ROUTER);

  CamelotStorageFacet = await ethers.getContractFactory("Camelot_Storage_Module");
  camelotStorageFacet = await CamelotStorageFacet.deploy(addresses.CAMELOT_NFTPOOL_FACTORY);

  Strategy = await ethers.getContractFactory("TestFixture_Strategy_Camelot");
  strategy = await Strategy.deploy(
    devWallet.address,
    traderFacet.address,
    traderInitializerParams,
    camelotLPFacet.address,
    camelotNFTPoolFacet.address,
    camelotNitroPoolFacet.address,
    camelotSwapFacet.address,
    camelotStorageFacet.address,
    camelotV3Facet.address,
  );

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_Camelot", strategy.address);

  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  WETH = await ethers.getContractAt("IWETH", addresses.WETH);
  DAI = await ethers.getContractAt("TestFixture_ERC20", addresses.DAI);
  GMX = await ethers.getContractAt("TestFixture_ERC20", addresses.GMX);
  router = await ethers.getContractAt("ICamelotRouter", addresses.CAMELOT_ROUTER);
  pair = await ethers.getContractAt("ICamelotPair", router.getPair(WETH.address, USDC.address));
  nftPoolFactory = await ethers.getContractAt("INFTPoolFactory", addresses.CAMELOT_NFTPOOL_FACTORY);
  nftPool = await ethers.getContractAt("INFTPool", await nftPoolFactory.getPool(pair.address));
  nitroPoolFactory = await ethers.getContractAt("INitroPoolFactory", addresses.CAMELOT_NITROPOOL_FACTORY);
  nitroPool = await ethers.getContractAt("INitroPool", await nitroPoolFactory.getNftPoolPublishedNitroPool(nftPool.address, 0));
  odosRouter = await ethers.getContractAt("IOdosRouter", addresses.CAMELOT_ODOS_ROUTER);

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "ARB++ Vault", "ARB-DSQ-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return {
    strategyDiamond,
    vault,
    test20,
    USDC,
    WETH,
    DAI,
    GMX,
    router,
    pair,
    nftPoolFactory,
    nftPool,
    nitroPoolFactory,
    nitroPool,
    odosRouter,
  };
}

describe("Camelot Modules", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("Camelot_Storage_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH } = await loadFixture(deployStrategy);
    });

    it("Should manageNFTPools", async function () {
      expect(await strategyDiamond.getAllowedNFTPools()).to.deep.equal([]);
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      expect(await strategyDiamond.getAllowedNFTPools()).to.deep.equal([nftPool.address]);
      await strategyDiamond.manageNFTPools([nftPool.address], [false]);
      expect(await strategyDiamond.getAllowedNFTPools()).to.deep.equal([]);
    });

    it("Should manageNitroPools", async function () {
      expect(await strategyDiamond.getAllowedNitroPools()).to.deep.equal([]);
      await strategyDiamond.manageNitroPools([citizen1.address], [true]);
      expect(await strategyDiamond.getAllowedNitroPools()).to.deep.equal([citizen1.address]);
      await strategyDiamond.manageNitroPools([citizen1.address], [false]);
      expect(await strategyDiamond.getAllowedNitroPools()).to.deep.equal([]);
    });

    it("Should manageExecutors", async function () {
      expect(await strategyDiamond.getAllowedExecutors()).to.deep.equal([]);
      await strategyDiamond.manageExecutors([citizen1.address], [true]);
      expect(await strategyDiamond.getAllowedExecutors()).to.deep.equal([citizen1.address]);
      await strategyDiamond.manageExecutors([citizen1.address], [false]);
      expect(await strategyDiamond.getAllowedExecutors()).to.deep.equal([]);
    });

    it("Should manageReceivers", async function () {
      expect(await strategyDiamond.getAllowedReceivers()).to.deep.equal([]);
      await strategyDiamond.manageReceivers([citizen1.address], [true]);
      expect(await strategyDiamond.getAllowedReceivers()).to.deep.equal([citizen1.address]);
      await strategyDiamond.manageReceivers([citizen1.address], [false]);
      expect(await strategyDiamond.getAllowedReceivers()).to.deep.equal([]);
    });
  });

  describe("Camelot_Swap_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, addresses.CAMELOT_ROUTER, initialUSDCBalance);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should swapExactTokensForTokens", async function () {
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(10000e6);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(0);
      const swapPath = [USDC.address, WETH.address];

      amountOut = await pair.getAmountOut(initialUSDCBalance, USDC.address);
      await strategyDiamond.camelot_swapExactTokensForTokens(
        initialUSDCBalance,
        0,
        swapPath,
        strategyDiamond.address,
        ethers.constants.AddressZero,
        timestamp + 100,
      );

      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(amountOut);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should NOT execute ill-formed swapExactTokensForTokens", async function () {
      const swapPath = [USDC.address, WETH.address];
      const badSwapPath = [USDC.address, test20.address];
      await expect(
        strategyDiamond.camelot_swapExactTokensForTokens(
          initialUSDCBalance,
          0,
          badSwapPath,
          strategyDiamond.address,
          ethers.constants.AddressZero,
          timestamp + 100,
        ),
      ).to.be.revertedWith("Invalid swap path");
      await expect(
        strategyDiamond.camelot_swapExactTokensForTokens(
          initialUSDCBalance,
          0,
          swapPath,
          devWallet.address,
          ethers.constants.AddressZero,
          timestamp + 100,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapExactETHForTokens", async function () {
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(10000e6);
      const swapPath = [WETH.address, USDC.address];

      amountOut = await pair.getAmountOut(parseEther("1"), WETH.address);
      await expect(() =>
        strategyDiamond.camelot_swapExactETHForTokens(
          parseEther("1"),
          0,
          swapPath,
          strategyDiamond.address,
          ethers.constants.AddressZero,
          timestamp + 100,
        ),
      ).to.changeEtherBalance(strategyDiamond, parseEther("-1"));
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(amountOut.add(initialUSDCBalance));
    });

    it("Should NOT execute ill-formed swapExactETHForTokens", async function () {
      const swapPath = [WETH.address, USDC.address];
      const badSwapPath = [WETH.address, test20.address];
      await expect(
        strategyDiamond.camelot_swapExactETHForTokens(
          parseEther("1"),
          0,
          badSwapPath,
          strategyDiamond.address,
          ethers.constants.AddressZero,
          timestamp + 100,
        ),
      ).to.be.revertedWith("Invalid swap path");
      await expect(
        strategyDiamond.camelot_swapExactETHForTokens(
          parseEther("1"),
          0,
          swapPath,
          devWallet.address,
          ethers.constants.AddressZero,
          timestamp + 100,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should swapExactTokensForETH", async function () {
      const initialBalance = await ethers.provider.getBalance(strategyDiamond.address);
      const swapPath = [USDC.address, WETH.address];

      amountOut = await pair.getAmountOut(initialUSDCBalance, USDC.address);
      await strategyDiamond.camelot_swapExactTokensForETH(
        initialUSDCBalance,
        0,
        swapPath,
        strategyDiamond.address,
        ethers.constants.AddressZero,
        timestamp + 100,
      );
      expect(await ethers.provider.getBalance(strategyDiamond.address)).to.eq(amountOut.add(initialBalance));
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should NOT execute ill-formed swapExactTokensForETH", async function () {
      const swapPath = [WETH.address, USDC.address];
      const badSwapPath = [WETH.address, test20.address];
      await expect(
        strategyDiamond.camelot_swapExactTokensForETH(
          initialUSDCBalance,
          0,
          badSwapPath,
          strategyDiamond.address,
          ethers.constants.AddressZero,
          timestamp + 100,
        ),
      ).to.be.revertedWith("Invalid swap path");
      await expect(
        strategyDiamond.camelot_swapExactTokensForETH(
          initialUSDCBalance,
          0,
          swapPath,
          devWallet.address,
          ethers.constants.AddressZero,
          timestamp + 100,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });
  });

  describe("Camelot_LP_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, pair, router } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      MathHelper = await ethers.getContractFactory("TestFixture_MathHelper");
      mathHelper = await MathHelper.deploy();

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, router.address, initialUSDCBalance);
      await strategyDiamond.approve(WETH.address, router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should addLiquidity", async function () {
      const swapPath = [USDC.address, WETH.address];
      await strategyDiamond.camelot_swapExactTokensForTokens(
        initialUSDCBalance / 2,
        0,
        swapPath,
        strategyDiamond.address,
        ethers.constants.AddressZero,
        timestamp + 100,
      );
      usdcBal = await USDC.balanceOf(strategyDiamond.address);
      wethBal = await WETH.balanceOf(strategyDiamond.address);

      totalSupply = await pair.totalSupply();
      reserveInfo = await pair.getReserves();
      kLast = await pair.kLast();
      ownerFeeShare = BigNumber.from(40000);
      feeDenominator = BigNumber.from(100000);
      liq = await mathHelper.estimateLiquidity(
        wethBal,
        usdcBal,
        reserveInfo.reserve0,
        reserveInfo.reserve1,
        totalSupply,
        kLast,
        feeDenominator,
        ownerFeeShare,
      );

      strategyDiamond.camelot_addLiquidity(USDC.address, WETH.address, usdcBal, wethBal, 0, 0, strategyDiamond.address, timestamp + 100);
      expect(await pair.balanceOf(strategyDiamond.address)).to.eq(liq);
    });

    it("Should NOT execute ill-formed addLiquidity", async function () {
      await expect(
        strategyDiamond.camelot_addLiquidity(USDC.address, test20.address, 0, 0, 0, 0, strategyDiamond.address, timestamp + 100),
      ).to.be.revertedWith("Invalid token");
      await expect(
        strategyDiamond.camelot_addLiquidity(USDC.address, WETH.address, 0, 0, 0, 0, devWallet.address, timestamp + 100),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should removeLiquidity", async function () {
      const swapPath = [USDC.address, WETH.address];
      await strategyDiamond.camelot_swapExactTokensForTokens(
        initialUSDCBalance / 2,
        0,
        swapPath,
        strategyDiamond.address,
        ethers.constants.AddressZero,
        timestamp + 100,
      );
      usdcBal = await USDC.balanceOf(strategyDiamond.address);
      wethBal = await WETH.balanceOf(strategyDiamond.address);

      totalSupply = await pair.totalSupply();
      reserveInfo = await pair.getReserves();
      kLast = await pair.kLast();
      ownerFeeShare = BigNumber.from(40000);
      feeDenominator = BigNumber.from(100000);
      liq = await mathHelper.estimateLiquidity(
        wethBal,
        usdcBal,
        reserveInfo.reserve0,
        reserveInfo.reserve1,
        totalSupply,
        kLast,
        feeDenominator,
        ownerFeeShare,
      );

      await strategyDiamond.camelot_addLiquidity(
        USDC.address,
        WETH.address,
        usdcBal,
        wethBal,
        0,
        0,
        strategyDiamond.address,
        timestamp + 100,
      );
      expect(await pair.balanceOf(strategyDiamond.address)).to.eq(liq);

      await strategyDiamond.camelot_removeLiquidity(USDC.address, WETH.address, liq, 0, 0, strategyDiamond.address, timestamp + 100);
      expect(await pair.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should NOT execute ill-formed removeLiquidity", async function () {
      await expect(
        strategyDiamond.camelot_removeLiquidity(USDC.address, test20.address, 0, 0, 0, strategyDiamond.address, timestamp + 100),
      ).to.be.revertedWith("Invalid token");
      await expect(
        strategyDiamond.camelot_removeLiquidity(USDC.address, WETH.address, 0, 0, 0, devWallet.address, timestamp + 100),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should addLiquidityETH", async function () {
      totalSupply = await pair.totalSupply();
      reserveInfo = await pair.getReserves();
      kLast = await pair.kLast();
      ownerFeeShare = BigNumber.from(40000);
      feeDenominator = BigNumber.from(100000);
      liq = await mathHelper.estimateLiquidity(
        parseEther("50"),
        initialUSDCBalance,
        reserveInfo.reserve0,
        reserveInfo.reserve1,
        totalSupply,
        kLast,
        feeDenominator,
        ownerFeeShare,
      );

      await strategyDiamond.camelot_addLiquidityETH(
        parseEther("50"),
        USDC.address,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 100,
      );
      expect(await pair.balanceOf(strategyDiamond.address)).to.eq(liq);
    });

    it("Should NOT execute ill-formed addLiquidityETH", async function () {
      await expect(
        strategyDiamond.camelot_addLiquidityETH(
          parseEther("50"),
          test20.address,
          initialUSDCBalance,
          0,
          0,
          strategyDiamond.address,
          timestamp + 100,
        ),
      ).to.be.revertedWith("Invalid token");
      await expect(
        strategyDiamond.camelot_addLiquidityETH(
          parseEther("50"),
          USDC.address,
          initialUSDCBalance,
          0,
          0,
          devWallet.address,
          timestamp + 100,
        ),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should removeLiquidityETH", async function () {
      totalSupply = await pair.totalSupply();
      reserveInfo = await pair.getReserves();
      kLast = await pair.kLast();
      ownerFeeShare = BigNumber.from(40000);
      feeDenominator = BigNumber.from(100000);
      liq = await mathHelper.estimateLiquidity(
        parseEther("50"),
        initialUSDCBalance,
        reserveInfo.reserve0,
        reserveInfo.reserve1,
        totalSupply,
        kLast,
        feeDenominator,
        ownerFeeShare,
      );

      await strategyDiamond.camelot_addLiquidityETH(
        parseEther("50"),
        USDC.address,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 100,
      );
      expect(await pair.balanceOf(strategyDiamond.address)).to.eq(liq);

      await strategyDiamond.camelot_removeLiquidityETH(USDC.address, liq, 0, 0, strategyDiamond.address, timestamp + 100);
      expect(await pair.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("Should NOT execute ill-formed removeLiquidityETH", async function () {
      await expect(
        strategyDiamond.camelot_removeLiquidityETH(test20.address, 0, 0, 0, strategyDiamond.address, timestamp + 100),
      ).to.be.revertedWith("Invalid token");
      await expect(
        strategyDiamond.camelot_removeLiquidityETH(USDC.address, 0, 0, 0, devWallet.address, timestamp + 100),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });
  });

  describe("Camelot_NFTPool_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, router, pair, nftPoolFactory, nftPool } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, router.address, initialUSDCBalance);
      await strategyDiamond.approve(WETH.address, router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;

      // Start epoch
      await vault.connect(devWallet).startEpoch(timestamp + 10, timestamp + 3 * 24 * 60 * 60, timestamp + 15 * 24 * 60 * 60);

      // Prepare createPosition
      await strategyDiamond.camelot_addLiquidityETH(
        parseEther("50"),
        USDC.address,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 100,
      );
      expect(await pair.balanceOf(strategyDiamond.address)).to.be.gt(0);
      bal = await pair.balanceOf(strategyDiamond.address);
    });

    it("Should createPosition", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 0);
      tokenId = await nftPool.lastTokenId();
      expect((await nftPool.getStakingPosition(tokenId)).amount).to.eq(bal);
    });

    it("Should NOT execute ill-formed createPosition", async function () {
      await expect(strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 0)).to.be.revertedWith("Invalid NFT Pool");
    });

    it("Should NOT createPosition if block.timestamp + lockDuration > epochEnd", async function () {
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);

      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await expect(strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 6 * 24 * 60 * 60)).to.be.revertedWith(
        "InputGuard: Invalid lock duration",
      );
    });

    it("Should addToPosition", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal - 100, 0);
      tokenId = await nftPool.lastTokenId();
      prevAmount = (await nftPool.getStakingPosition(tokenId)).amount;

      await strategyDiamond.camelot_nftpool_addToPosition(nftPool.address, tokenId, 50);
      expect((await nftPool.getStakingPosition(tokenId)).amount).to.eq(prevAmount.add(50));
    });

    it("Should NOT execute ill-formed addToPosition", async function () {
      await expect(strategyDiamond.camelot_nftpool_addToPosition(nftPool.address, tokenId, 50)).to.be.revertedWith("Invalid NFT Pool");
    });

    it("Should harvestPosition", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 0);

      tokenId = await nftPool.lastTokenId();
      expect((await nftPool.getStakingPosition(tokenId)).amount).to.eq(bal);
      await expect(strategyDiamond.camelot_nftpool_harvestPosition(nftPool.address, tokenId)).to.not.be.reverted;
    });

    it("Should NOT execute ill-formed harvestPosition", async function () {
      await expect(strategyDiamond.camelot_nftpool_harvestPosition(nftPool.address, tokenId)).to.be.revertedWith("Invalid NFT Pool");
    });

    it("Should withdrawFromPosition", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 0);

      tokenId = await nftPool.lastTokenId();
      await expect(() => strategyDiamond.camelot_nftpool_withdrawFromPosition(nftPool.address, tokenId, bal)).to.changeTokenBalances(
        pair,
        [nftPool, strategyDiamond],
        [-bal, bal],
      );
    });

    it("Should NOT execute ill-formed withdrawFromPosition", async function () {
      await expect(strategyDiamond.camelot_nftpool_withdrawFromPosition(nftPool.address, tokenId, bal)).to.be.revertedWith(
        "Invalid NFT Pool",
      );
    });

    it("Should lockPosition", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal - 100, 0);

      tokenId = await nftPool.lastTokenId();
      await strategyDiamond.camelot_nftpool_lockPosition(nftPool.address, tokenId, 100);
      expect((await nftPool.getStakingPosition(tokenId)).lockDuration).to.eq(100);
    });

    it("Should NOT execute ill-formed lockPosition", async function () {
      await expect(strategyDiamond.camelot_nftpool_lockPosition(nftPool.address, tokenId, 100)).to.be.revertedWith("Invalid NFT Pool");
    });

    it("Should NOT lockPosition if block.timestamp + lockDuration > epochLength", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal - 100, 0);

      tokenId = await nftPool.lastTokenId();
      await expect(strategyDiamond.camelot_nftpool_lockPosition(nftPool.address, tokenId, 20 * 24 * 60 * 60)).to.be.revertedWith(
        "InputGuard: Invalid lock duration",
      );

      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await expect(strategyDiamond.camelot_nftpool_lockPosition(nftPool.address, tokenId, 6 * 24 * 60 * 60)).to.be.revertedWith(
        "InputGuard: Invalid lock duration",
      );
    });

    it("Should renewLockPosition", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal - 100, 0);
      tokenId = await nftPool.lastTokenId();
      await strategyDiamond.camelot_nftpool_lockPosition(nftPool.address, tokenId, 100);
      expect((await nftPool.getStakingPosition(tokenId)).lockDuration).to.eq(100);

      await ethers.provider.send("evm_increaseTime", [50]);
      await strategyDiamond.camelot_nftpool_renewLockPosition(nftPool.address, tokenId);
      timestamp = (await ethers.provider.getBlock()).timestamp;
      expect((await nftPool.getStakingPosition(tokenId)).startLockTime).to.eq(timestamp);
    });

    it("Should not execute ill-formed renewLockPosition", async function () {
      await expect(strategyDiamond.camelot_nftpool_renewLockPosition(nftPool.address, tokenId)).to.be.revertedWith("Invalid NFT Pool");
    });

    it("Should NOT renewLockPosition if block.timestamp + lockDuration > epochEnd", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal - 100, 0);
      tokenId = await nftPool.lastTokenId();
      await strategyDiamond.camelot_nftpool_lockPosition(nftPool.address, tokenId, 10 * 24 * 60 * 60);
      expect((await nftPool.getStakingPosition(tokenId)).lockDuration).to.eq(10 * 24 * 60 * 60);

      await ethers.provider.send("evm_increaseTime", [9 * 24 * 60 * 60]);
      await expect(strategyDiamond.camelot_nftpool_renewLockPosition(nftPool.address, tokenId)).to.be.revertedWith(
        "InputGuard: Invalid lock duration",
      );
    });

    it("Should splitPosition", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 0);
      tokenId = await nftPool.lastTokenId();

      splitBal = bal - 100;
      await strategyDiamond.camelot_nftpool_splitPosition(nftPool.address, tokenId, splitBal);
      tokenId = await nftPool.lastTokenId();
      expect((await nftPool.getStakingPosition(tokenId)).amount).to.eq(splitBal);
    });

    it("Should not execute ill-formed splitPosition", async function () {
      await expect(strategyDiamond.camelot_nftpool_splitPosition(nftPool.address, tokenId, bal - 100)).to.be.revertedWith(
        "Invalid NFT Pool",
      );
    });

    it("Should mergePositions", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 0);
      firstTokenId = await nftPool.lastTokenId();

      splitBal = bal - 100;
      await strategyDiamond.camelot_nftpool_splitPosition(nftPool.address, firstTokenId, splitBal);
      newTokenId = await nftPool.lastTokenId();
      expect((await nftPool.getStakingPosition(newTokenId)).amount).to.eq(splitBal);

      await strategyDiamond.camelot_nftpool_mergePositions(nftPool.address, [firstTokenId, newTokenId], 0);
      expect((await nftPool.getStakingPosition(firstTokenId)).amount).to.eq(bal);
      expect((await nftPool.getStakingPosition(newTokenId)).amount).to.eq(0);
    });

    it("Should NOT execute ill-formed mergePositions", async function () {
      await expect(strategyDiamond.camelot_nftpool_mergePositions(nftPool.address, [firstTokenId, newTokenId], 0)).to.be.revertedWith(
        "Invalid NFT Pool",
      );
    });

    it("Should NOT mergePositions if block.timestamp + lockDuration > epochEnd", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
      await expect(strategyDiamond.camelot_nftpool_mergePositions(nftPool.address, [0, 1], 8 * 24 * 60 * 60)).to.be.revertedWith(
        "InputGuard: Invalid lock duration",
      );
    });

    it("Should emergencyWithdraw", async function () {
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 0);
      tokenId = await nftPool.lastTokenId();

      await strategyDiamond.camelot_nftpool_emergencyWithdraw(nftPool.address, tokenId);
      expect((await nftPool.getStakingPosition(tokenId)).amount).to.eq(0);
    });

    it("Should NOT execute ill-formed emergencyWithdraw", async function () {
      await expect(strategyDiamond.camelot_nftpool_emergencyWithdraw(nftPool.address, tokenId)).to.be.revertedWith("Invalid NFT Pool");
    });
  });

  describe("Camelot_NitroPool_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH, router, pair, nftPoolFactory, nftPool } = await loadFixture(deployStrategy);

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, router.address, initialUSDCBalance);
      await strategyDiamond.approve(WETH.address, router.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;

      // Start epoch
      await vault.connect(devWallet).startEpoch(timestamp + 10, timestamp + 3 * 24 * 60 * 60, timestamp + 15 * 24 * 60 * 60);

      // Add liquidity and create position in NFTPool
      await strategyDiamond.manageNFTPools([nftPool.address], [true]);
      await strategyDiamond.camelot_addLiquidityETH(
        parseEther("50"),
        USDC.address,
        initialUSDCBalance / 2,
        0,
        0,
        strategyDiamond.address,
        timestamp + 100,
      );
      bal = await pair.balanceOf(strategyDiamond.address);
      await strategyDiamond.camelot_nftpool_createPosition(nftPool.address, bal, 0);
      tokenId = await nftPool.lastTokenId();
    });

    // Block timestamp needs to be before harvest start time
    // Using block 41600000 for testing
    it("Should create NitroPool position via transferring NFT", async function () {
      await strategyDiamond.manageNitroPools([nitroPool.address], [true]);
      await expect(strategyDiamond.camelot_nitropool_transfer(nitroPool.address, nftPool.address, tokenId)).to.emit(nitroPool, "Deposit");
      expect(await nitroPool.userTokenId(strategyDiamond.address, 0)).to.eq(tokenId);
      expect(await nftPool.ownerOf(tokenId)).to.eq(nitroPool.address);
    });

    it("Should NOT execute ill-formed nitropool_transfer", async function () {
      await expect(strategyDiamond.camelot_nitropool_transfer(nitroPool.address, nftPool.address, tokenId)).to.be.revertedWith(
        "Invalid Nitro Pool",
      );
    });

    it("Should withdraw NitroPool position", async function () {
      await strategyDiamond.manageNitroPools([nitroPool.address], [true]);
      await strategyDiamond.camelot_nitropool_transfer(nitroPool.address, nftPool.address, tokenId);
      await expect(strategyDiamond.camelot_nitropool_withdraw(nitroPool.address, tokenId)).to.emit(nitroPool, "Withdraw");

      await expect(nitroPool.userTokenId(strategyDiamond.address, 0)).to.be.revertedWith("EnumerableSet: index out of bounds");
      expect(await nftPool.ownerOf(tokenId)).to.eq(strategyDiamond.address);
    });

    it("Should NOT execute ill-formed nitropool_withdraw", async function () {
      await expect(strategyDiamond.camelot_nitropool_withdraw(nitroPool.address, tokenId)).to.be.revertedWith("Invalid Nitro Pool");
    });

    it("Should emergencyWithdraw from NitroPool", async function () {
      await strategyDiamond.manageNitroPools([nitroPool.address], [true]);
      await strategyDiamond.camelot_nitropool_transfer(nitroPool.address, nftPool.address, tokenId);
      await expect(strategyDiamond.camelot_nitropool_emergencyWithdraw(nitroPool.address, tokenId)).to.emit(nitroPool, "EmergencyWithdraw");
      await expect(nitroPool.userTokenId(strategyDiamond.address, 0)).to.be.revertedWith("EnumerableSet: index out of bounds");
      expect(await nftPool.ownerOf(tokenId)).to.eq(strategyDiamond.address);
    });

    it("Should NOT execute ill-formed emergencyWithdraw", async function () {
      await expect(strategyDiamond.camelot_nitropool_emergencyWithdraw(nitroPool.address, tokenId)).to.be.revertedWith(
        "Invalid Nitro Pool",
      );
    });

    it("Should harvest NitroPool position", async function () {
      await strategyDiamond.manageNitroPools([nitroPool.address], [true]);
      await strategyDiamond.camelot_nitropool_transfer(nitroPool.address, nftPool.address, tokenId);

      harvestStartTime = 1670432400;
      await ethers.provider.send("evm_setNextBlockTimestamp", [harvestStartTime + 100]);
      await expect(strategyDiamond.camelot_nitropool_harvest(nitroPool.address)).to.emit(nitroPool, "Harvest");
    });

    it("Should NOT execute ill-formed harvest", async function () {
      await expect(strategyDiamond.camelot_nitropool_harvest(nitroPool.address)).to.be.revertedWith("Invalid Nitro Pool");
    });
  });

  // These tests replicate transactions from the V0 strategyDiamond contract
  describe("Camelot Integration Live Swaps", function () {
    // https://openchain.xyz/trace/arbitrum/0x1ee6108a3fcca2f20cd3335042c49df78e2e817ae1cb08640eb21f5c46abff3a
    it("Should swap USDC for DAI", async function () {
      reset(forkConfig.url, 54257813);
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, GMX } = await deployStrategy();
      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, addresses.CAMELOT_ROUTER, initialUSDCBalance);

      expect(await DAI.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(10000e6);
      const swapPath = [USDC.address, DAI.address];
      await strategyDiamond.camelot_swapExactTokensForTokens(
        1000e6,
        BigInt("994885234205369377265"),
        swapPath,
        strategyDiamond.address,
        ethers.constants.AddressZero,
        1674208841,
      );
      expect(await DAI.balanceOf(strategyDiamond.address)).to.eq(BigInt("999884657492833544990"));
    });

    // https://openchain.xyz/trace/arbitrum/0x82e1c1f584d96a6f667a3ffda0e1d93d2267d0cf1977cb1b5631b645138064e4
    it("Should swap USDC for GMX (1)", async function () {
      reset(forkConfig.url, 50748207);
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, GMX } = await deployStrategy();
      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, addresses.CAMELOT_ROUTER, initialUSDCBalance);

      expect(await GMX.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(10000e6);
      const swapPath = [USDC.address, GMX.address];
      await strategyDiamond.camelot_swapExactTokensForTokens(
        82e6,
        BigInt("1960790537961317471"),
        swapPath,
        strategyDiamond.address,
        ethers.constants.AddressZero,
        1672823076,
      );
      expect(await GMX.balanceOf(strategyDiamond.address)).to.eq(BigInt("1970643756745042685"));
    });

    // Block: 50752362
    // https://openchain.xyz/trace/arbitrum/0xfcd8be0b6a8323fc08052938dc64feb624ea41f7c7dd32e3d778ee599d141d78
    it("Should swap USDC for GMX (2)", async function () {
      reset(forkConfig.url, 50752362);
      const { strategyDiamond, vault, test20, USDC, WETH, DAI, GMX } = await deployStrategy();
      const index = getSlot(strategyDiamond.address, USDC_SLOT);
      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDC.address, addresses.CAMELOT_ROUTER, initialUSDCBalance);

      expect(await GMX.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(10000e6);
      const swapPath = [USDC.address, GMX.address];
      await strategyDiamond.camelot_swapExactTokensForTokens(
        164e6,
        BigInt("3917190689050743341"),
        swapPath,
        strategyDiamond.address,
        ethers.constants.AddressZero,
        1672824320,
      );
      expect(await GMX.balanceOf(strategyDiamond.address)).to.eq(BigInt("3936875064372606373"));
    });
  });

  // All of these swaps are based on real transactions because I can't craft aggregator data
  // Broke up swap and lp so I could use beforeEach for LP
  describe("Camelot_V3_Module: Swap", function () {
    // https://explorer.phalcon.xyz/tx/arbitrum/0x4585233b49a1b48a56a52869602829474738bf8084cb7c584e774c5be1cf1688
    it("Should camelot_v3_swap ether for token", async function () {
      reset(process.env.ARBITRUM_URL, 83446377);
      const { strategyDiamond, vault, test20, USDC, WETH, pair, router, odosRouter } = await deployStrategy();

      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.manageExecutors([addresses.CAMELOT_ODOS_EXECUTOR], [true]);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      inputs = [[ethers.constants.AddressZero, parseEther(".71"), addresses.CAMELOT_ODOS_EXECUTOR, "0x"]];
      outputs = [[USDC.address, BigNumber.from("97846918849945174016"), strategyDiamond.address]];
      valueOutQuote = ethers.constants.MaxUint256;
      valueOutMin = BigNumber.from("128347308117994021490423496704");
      pathDefinition =
        "0x010207001801010203020b0000040301000b0101050601ff00000000000000002eab95a938d1fabb1b62132bdb0c5a2405a5788700000000000000000000000000000000000000005979d7b546e38e414f7e9822514be443a4800529b93f8a075509e71325c1c2fc8fa6a75f2d536a13308c5b91f63307439fdb51a9fa4dfc979e2ed6b082af49447d8a07e3bd95bd0d56f35241523fbab1";

      await expect(() =>
        strategyDiamond.camelot_v3_swap(
          parseEther(".71"),
          inputs,
          outputs,
          valueOutQuote,
          valueOutMin,
          addresses.CAMELOT_ODOS_EXECUTOR,
          pathDefinition,
        ),
      ).to.changeEtherBalance(strategyDiamond, parseEther("-.71"));
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(BigNumber.from("1324967861")); // User cucked themself out of a little USDC because too low valueOutQuote
    });

    // https://explorer.phalcon.xyz/tx/arbitrum/0x4937d204b07287cad03d50d4570fb08473cae6f5ccb3f622384f19d4ae6e6429
    it("Should camelot_v3_swap token for ether", async function () {
      reset(process.env.ARBITRUM_URL, 83310901);
      const { strategyDiamond, vault, test20, USDC, WETH, pair, router, odosRouter } = await deployStrategy();

      USDT = await ethers.getContractAt("TestFixture_ERC20", addresses.USDT);
      const index = getSlot(strategyDiamond.address, USDT_SLOT);
      await setStorageAt(USDT.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDT.address, odosRouter.address, initialUSDCBalance);
      await strategyDiamond.manageExecutors([addresses.CAMELOT_ODOS_EXECUTOR], [true]);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      inputs = [[USDT.address, BigNumber.from("52038487"), addresses.CAMELOT_ODOS_EXECUTOR, "0x"]];
      outputs = [[ethers.constants.AddressZero, BigNumber.from("185793853167"), strategyDiamond.address]];
      valueOutQuote = ethers.constants.MaxUint256;
      valueOutMin = BigNumber.from("4411695209325799794448269312");
      pathDefinition =
        "0x010205000b0100010201020b0000030400000601000201ff00000000000000008dbbc03de7701cf3336a035695f8d3225418e79ffd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9b7dd20f3fbf4db42fd85c839ac0241d09f72955fff970a61a04b1ca14834a43f5de4533ebddb5cc8";

      initUSDT = await USDT.balanceOf(strategyDiamond.address);
      await expect(() =>
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, valueOutQuote, valueOutMin, addresses.CAMELOT_ODOS_EXECUTOR, pathDefinition),
      ).to.changeEtherBalance(strategyDiamond, BigNumber.from("27935421265276844"));
      expect(await USDT.balanceOf(strategyDiamond.address)).to.eq(initUSDT.sub(52038487));
    });

    it("Should camelot_v3_swap token for ether with low valueOutMin", async function () {
      reset(process.env.ARBITRUM_URL, 83310901);
      const { strategyDiamond, vault, test20, USDC, WETH, pair, router, odosRouter } = await deployStrategy();

      USDT = await ethers.getContractAt("TestFixture_ERC20", addresses.USDT);
      const index = getSlot(strategyDiamond.address, USDT_SLOT);
      await setStorageAt(USDT.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(USDT.address, odosRouter.address, initialUSDCBalance);
      await strategyDiamond.manageExecutors([addresses.CAMELOT_ODOS_EXECUTOR], [true]);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      inputs = [[USDT.address, BigNumber.from("52038487"), addresses.CAMELOT_ODOS_EXECUTOR, "0x"]];
      outputs = [[ethers.constants.AddressZero, BigNumber.from("185793853167"), strategyDiamond.address]];
      valueOutQuote = ethers.constants.MaxUint256;
      valueOutMin = BigNumber.from("1");
      pathDefinition =
        "0x010205000b0100010201020b0000030400000601000201ff00000000000000008dbbc03de7701cf3336a035695f8d3225418e79ffd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9b7dd20f3fbf4db42fd85c839ac0241d09f72955fff970a61a04b1ca14834a43f5de4533ebddb5cc8";

      initUSDT = await USDT.balanceOf(strategyDiamond.address);
      await expect(() =>
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, valueOutQuote, valueOutMin, addresses.CAMELOT_ODOS_EXECUTOR, pathDefinition),
      ).to.changeEtherBalance(strategyDiamond, BigNumber.from("27935421265276844"));
      expect(await USDT.balanceOf(strategyDiamond.address)).to.eq(initUSDT.sub(52038487));
    });

    // https://explorer.phalcon.xyz/tx/arbitrum/0xd93eeb8135a8d589c60f3b273dcaace2e442829afe43fce488f958732b626ccb
    it("Should camelot_v3_swap token for token", async function () {
      reset(process.env.ARBITRUM_URL, 83441671);
      const { strategyDiamond, vault, test20, USDC, DAI, pair, router, odosRouter } = await deployStrategy();

      const index = getSlot(strategyDiamond.address, DAI_SLOT);
      await setStorageAt(DAI.address, index, toBytes32(parseEther("1000")));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(DAI.address, odosRouter.address, parseEther("1000"));
      await strategyDiamond.manageExecutors([addresses.CAMELOT_ODOS_EXECUTOR], [true]);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      lp_pool_address = "0x01efed58b534d7a7464359a6f8d14d986125816b";
      await strategyDiamond.manageReceivers([lp_pool_address], [true]);

      inputs = [[DAI.address, BigNumber.from("100885118936522411518"), lp_pool_address, "0x"]];
      outputs = [[USDC.address, BigNumber.from("97813025933290913792"), strategyDiamond.address]];
      valueOutQuote = ethers.constants.MaxUint256;
      valueOutMin = BigNumber.from("9812348784726192202425827328");
      pathDefinition =
        "0x0102030013010100010201ff000000000000000000000000000000000000000001efed58b534d7a7464359a6f8d14d986125816bda10009cbd5d07dd0cecc66161fc93d7c9000da1";

      await expect(() =>
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, valueOutQuote, valueOutMin, addresses.CAMELOT_ODOS_EXECUTOR, pathDefinition),
      ).to.changeTokenBalance(DAI, strategyDiamond, BigNumber.from("-100885118936522411518"));
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(100821511);
    });

    it("Malicious executor test", async function () {
      reset(process.env.ARBITRUM_URL, 83441671);
      const { strategyDiamond, vault, test20, USDC, DAI, pair, router, odosRouter } = await deployStrategy();
      await strategyDiamond.manageExecutors([addresses.CAMELOT_ODOS_EXECUTOR], [true]);

      const index = getSlot(strategyDiamond.address, DAI_SLOT);
      await setStorageAt(DAI.address, index, toBytes32(BigNumber.from("100885118936522411518")));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(DAI.address, odosRouter.address, parseEther("1000"));

      Malicious = await ethers.getContractFactory("TestFixture_MaliciousExecutor");
      malicious = await Malicious.deploy(USDC.address);

      const usdcIndex = getSlot(malicious.address, USDC_SLOT);
      await setStorageAt(USDC.address, usdcIndex, toBytes32(BigNumber.from(10e6)));

      inputs = [[DAI.address, BigNumber.from("100885118936522411518"), malicious.address, "0x"]];
      outputs = [[USDC.address, BigNumber.from("97813025933290913792"), strategyDiamond.address]];
      valueOutQuote = ethers.constants.MaxUint256;
      valueOutMin = BigNumber.from("1");
      pathDefinition = "0x";

      await expect(
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, valueOutQuote, valueOutMin, malicious.address, pathDefinition),
      ).to.be.revertedWith("Invalid Executor");
    });

    it("Malicious inputs reciever test", async function () {
      reset(process.env.ARBITRUM_URL, 83441671);
      const { strategyDiamond, vault, test20, USDC, DAI, pair, router, odosRouter } = await deployStrategy();
      await strategyDiamond.manageExecutors([addresses.CAMELOT_ODOS_EXECUTOR], [true]);

      const index = getSlot(strategyDiamond.address, DAI_SLOT);
      await setStorageAt(DAI.address, index, toBytes32(parseEther("1000")));
      await setBalance(strategyDiamond.address, initialWETHBalance);
      await strategyDiamond.approve(DAI.address, odosRouter.address, parseEther("1000"));
      timestamp = (await ethers.provider.getBlock()).timestamp;

      inputs = [[DAI.address, BigNumber.from("100885118936522411518"), citizen1.address, "0x"]];
      outputs = [[USDC.address, BigNumber.from("97813025933290913792"), strategyDiamond.address]];
      valueOutQuote = ethers.constants.MaxUint256;
      valueOutMin = BigNumber.from("9812348784726192202425827328");
      pathDefinition =
        "0x0102030013010100010201ff000000000000000000000000000000000000000001efed58b534d7a7464359a6f8d14d986125816bda10009cbd5d07dd0cecc66161fc93d7c9000da1";

      await expect(
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, valueOutQuote, valueOutMin, addresses.CAMELOT_ODOS_EXECUTOR, pathDefinition),
      ).to.be.revertedWith("Invalid Receiver");
    });

    it("Should NOT execute ill-formed swap", async function () {
      reset(process.env.ARBITRUM_URL, 83441671);
      const { strategyDiamond, vault, test20, USDC, DAI, pair, router, odosRouter } = await deployStrategy();
      await strategyDiamond.manageExecutors([addresses.CAMELOT_ODOS_EXECUTOR], [true]);

      inputs = [[USDC.address, BigNumber.from("52038487"), addresses.CAMELOT_ODOS_EXECUTOR, "0x"]];
      outputs = [[ethers.constants.AddressZero, BigNumber.from("185793853167"), citizen1.address]];
      await expect(strategyDiamond.camelot_v3_swap(0, inputs, outputs, 1, 0, addresses.CAMELOT_ODOS_EXECUTOR, "0x")).to.be.revertedWith(
        "GuardError: Invalid valueOutQuote",
      );

      inputs = [[test20.address, BigNumber.from("52038487"), addresses.CAMELOT_ODOS_EXECUTOR, "0x"]];
      outputs = [[ethers.constants.AddressZero, BigNumber.from("185793853167"), strategyDiamond.address]];
      await expect(
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, ethers.constants.MaxUint256, 0, addresses.CAMELOT_ODOS_EXECUTOR, "0x"),
      ).to.be.revertedWith("Invalid token");

      inputs = [[USDC.address, BigNumber.from("52038487"), addresses.CAMELOT_ODOS_EXECUTOR, "0x"]];
      outputs = [[test20.address, BigNumber.from("185793853167"), strategyDiamond.address]];
      await expect(
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, ethers.constants.MaxUint256, 0, addresses.CAMELOT_ODOS_EXECUTOR, "0x"),
      ).to.be.revertedWith("Invalid token");

      inputs = [[USDC.address, BigNumber.from("52038487"), addresses.CAMELOT_ODOS_EXECUTOR, "0x"]];
      outputs = [[ethers.constants.AddressZero, BigNumber.from("185793853167"), citizen1.address]];
      await expect(
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, ethers.constants.MaxUint256, 0, addresses.CAMELOT_ODOS_EXECUTOR, "0x"),
      ).to.be.revertedWith("GuardError: Invalid recipient");

      await strategyDiamond.manageExecutors([addresses.CAMELOT_ODOS_EXECUTOR], [false]);
      inputs = [[USDC.address, BigNumber.from("52038487"), addresses.CAMELOT_ODOS_EXECUTOR, "0x"]];
      outputs = [[ethers.constants.AddressZero, BigNumber.from("185793853167"), strategyDiamond.address]];
      await expect(
        strategyDiamond.camelot_v3_swap(0, inputs, outputs, ethers.constants.MaxUint256, 0, addresses.CAMELOT_ODOS_EXECUTOR, "0x"),
      ).to.be.revertedWith("Invalid Executor");
    });
  });

  describe("Camelot_V3_Module: LP", function () {
    beforeEach(async function () {
      reset(process.env.ARBITRUM_URL, 83000000);
      const { strategyDiamond, vault, test20, USDC, WETH, pair, router } = await deployStrategy();

      const index = getSlot(strategyDiamond.address, USDC_SLOT);

      positionManager = await ethers.getContractAt("INonfungiblePositionManager", addresses.CAMELOT_POSITION_MANAGER);
      weth_usdc_v3_pool = await ethers.getContractAt("IAlgebraPool", addresses.CAMELOT_WETH_USDC_V3_POOL);

      await setStorageAt(USDC.address, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialWETHBalance);

      await strategyDiamond.approve(USDC.address, positionManager.address, initialUSDCBalance);
      await strategyDiamond.approve(WETH.address, positionManager.address, ethers.constants.MaxUint256);

      timestamp = (await ethers.provider.getBlock()).timestamp;

      // Get the next tokenId
      tokenId = await strategyDiamond.callStatic.camelot_v3_mint(initialWETHBalance, [
        WETH.address,
        USDC.address,
        -201840,
        -199680,
        initialWETHBalance,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 10,
      ]);
    });

    it("Should camelot_v3_mint (create liquidityPosition)", async function () {
      await strategyDiamond.camelot_v3_mint(initialWETHBalance, [
        WETH.address,
        USDC.address,
        -201840,
        -199680,
        initialWETHBalance,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 10,
      ]);
      expect((await positionManager.positions(tokenId)).liquidity).to.be.gt(0);
    });

    it("Should NOT execute ill-formed camelot_v3_mint", async function () {
      await expect(
        strategyDiamond.camelot_v3_mint(initialWETHBalance, [
          test20.address,
          USDC.address,
          -201840,
          -199680,
          initialWETHBalance,
          initialUSDCBalance,
          0,
          0,
          strategyDiamond.address,
          timestamp + 10,
        ]),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.camelot_v3_mint(initialWETHBalance, [
          WETH.address,
          test20.address,
          -201840,
          -199680,
          initialWETHBalance,
          initialUSDCBalance,
          0,
          0,
          strategyDiamond.address,
          timestamp + 10,
        ]),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.camelot_v3_mint(initialWETHBalance, [
          WETH.address,
          USDC.address,
          -201840,
          -199680,
          initialWETHBalance,
          initialUSDCBalance,
          0,
          0,
          citizen1.address,
          timestamp + 10,
        ]),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should camelot_v3_increaseLiquidity", async function () {
      await strategyDiamond.camelot_v3_mint(initialWETHBalance.div(2), [
        WETH.address,
        USDC.address,
        -201840,
        -199680,
        initialWETHBalance.div(2),
        initialUSDCBalance / 2,
        0,
        0,
        strategyDiamond.address,
        timestamp + 10,
      ]);
      await ethers.provider.getBalance(strategyDiamond.address);

      currentLiquidity = (await positionManager.positions(tokenId)).liquidity;
      await strategyDiamond.camelot_v3_increaseLiquidity(parseEther("1"), [tokenId, parseEther("1"), 100e6, 0, 0, timestamp + 10]);
      expect((await positionManager.positions(tokenId)).liquidity).to.be.gt(currentLiquidity);
    });

    it("Should not execute ill-formed camelot_v3_increaseLiquidity", async function () {
      badTokenId = 2602;
      await expect(
        strategyDiamond.camelot_v3_increaseLiquidity(parseEther("1"), [badTokenId, parseEther("1"), 100e6, 0, 0, timestamp + 10]),
      ).to.be.revertedWith("GuardError: Invalid tokenId");
    });

    it("Should camelot_v3_decreaseLiquidity", async function () {
      await strategyDiamond.camelot_v3_mint(initialWETHBalance, [
        WETH.address,
        USDC.address,
        -201840,
        -199680,
        initialWETHBalance,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 10,
      ]);

      currentLiquidity = (await positionManager.positions(tokenId)).liquidity;
      await strategyDiamond.camelot_v3_decreaseLiquidity([tokenId, currentLiquidity.sub(1000), 0, 0, timestamp + 10]);
      expect((await positionManager.positions(tokenId)).liquidity).to.eq(1000);
    });

    it("Should camelot_v3_collect", async function () {
      await strategyDiamond.camelot_v3_mint(initialWETHBalance, [
        WETH.address,
        USDC.address,
        -201840,
        -199680,
        initialWETHBalance,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 10,
      ]);
      currentLiquidity = (await positionManager.positions(tokenId)).liquidity;
      await strategyDiamond.camelot_v3_decreaseLiquidity([tokenId, currentLiquidity, 0, 0, timestamp + 10]);

      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(0);
      await strategyDiamond.camelot_v3_collect([tokenId, strategyDiamond.address, parseEther("10000"), parseEther("10000")]);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gt(0);
    });

    it("Should NOT execute ill-formed camelot_v3_collect", async function () {
      await expect(
        strategyDiamond.camelot_v3_collect([tokenId, citizen1.address, parseEther("10000"), parseEther("10000")]),
      ).to.be.revertedWith("GuardError: Invalid recipient");
    });

    it("Should camelot_v3_burn", async function () {
      await strategyDiamond.camelot_v3_mint(initialWETHBalance, [
        WETH.address,
        USDC.address,
        -201840,
        -199680,
        initialWETHBalance,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 10,
      ]);
      currentLiquidity = (await positionManager.positions(tokenId)).liquidity;
      await strategyDiamond.camelot_v3_decreaseLiquidity([tokenId, currentLiquidity, 0, 0, timestamp + 10]);
      await strategyDiamond.camelot_v3_collect([tokenId, strategyDiamond.address, parseEther("10000"), parseEther("10000")]);

      await strategyDiamond.camelot_v3_burn(tokenId);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gt(0);
      await expect(positionManager.ownerOf(tokenId)).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });

    it("Should camelot_v3_decreaseLiquidityAndCollect", async function () {
      await strategyDiamond.camelot_v3_mint(initialWETHBalance, [
        WETH.address,
        USDC.address,
        -201840,
        -199680,
        initialWETHBalance,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 10,
      ]);

      currentLiquidity = (await positionManager.positions(tokenId)).liquidity;
      await strategyDiamond.camelot_v3_decreaseLiquidityAndCollect(
        [tokenId, currentLiquidity.sub(1000), 0, 0, timestamp + 10],
        [tokenId, strategyDiamond.address, parseEther("10000"), parseEther("10000")],
      );
      expect((await positionManager.positions(tokenId)).liquidity).to.eq(1000);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gt(0);
    });

    it("Should NOT execute ill-formed camelot_v3_decreaseLiquidityAndCollect", async function () {
      await expect(
        strategyDiamond.camelot_v3_decreaseLiquidityAndCollect(
          [tokenId, currentLiquidity.sub(1000), 0, 0, timestamp + 10],
          [tokenId, citizen1.address, parseEther("10000"), parseEther("10000")],
        ),
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should camelot_v3_decreaseLiquidityCollectAndBurn", async function () {
      await strategyDiamond.camelot_v3_mint(initialWETHBalance, [
        WETH.address,
        USDC.address,
        -201840,
        -199680,
        initialWETHBalance,
        initialUSDCBalance,
        0,
        0,
        strategyDiamond.address,
        timestamp + 10,
      ]);

      currentLiquidity = (await positionManager.positions(tokenId)).liquidity;
      await strategyDiamond.camelot_v3_decreaseLiquidityCollectAndBurn(
        [tokenId, currentLiquidity, 0, 0, timestamp + 10],
        [tokenId, strategyDiamond.address, parseEther("10000"), parseEther("10000")],
        tokenId,
      );
      expect(await WETH.balanceOf(strategyDiamond.address)).to.be.gt(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.be.gt(0);
      await expect(positionManager.ownerOf(tokenId)).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });

    it("Should NOT execute ill-formed camelot_v3_decreaseLiquidityCollectAndBurn", async function () {
      await expect(
        strategyDiamond.camelot_v3_decreaseLiquidityCollectAndBurn(
          [tokenId, currentLiquidity.sub(1000), 0, 0, timestamp + 10],
          [tokenId, citizen1.address, parseEther("10000"), parseEther("10000")],
          tokenId,
        ),
      ).to.be.revertedWith("Invalid recipient");
    });
  });
});
