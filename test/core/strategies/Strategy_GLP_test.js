const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
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

  const initialPerformanceFee = parseEther("0.1"); // 10% fee
  const initialManagementFee = parseEther("0.01"); // 1% fee

  const strategyDiamondName = "GLP++";
  const allowedTokens = [
    addresses.USDC,
    addresses.WETH,
    addresses.DAI,
    addresses.GMX,
    addresses.WBTC,
    addresses.INCH_ETHER_TOKEN,
    addresses.USDT,
  ];
  const allowedSpenders = [
    addresses.GMX_ROUTER,
    addresses.GMX_POSITIONROUTER,
    addresses.GMX_ORDERBOOK,
    addresses.CAMELOT_ROUTER,
    addresses.AAVE_POOL,
    addresses.GMX_GLP_MANAGER,
    addresses.INCH_AGGREGATION_ROUTER,
    addresses.LYRA_LIQUIDITY_POOL_WETH,
    addresses.LYRA_WETH_OPTION_MARKET,
    addresses.RYSK_LIQUIDITY_POOL,
    addresses.RYSK_ALPHA_OPTION_HANDLER,
    addresses.TRADERJOE_LBROUTER,
    addresses.TRADERJOE_LEGACY_LBROUTER,
  ];
  traderInitializerParams = [strategyDiamondName, allowedTokens, allowedSpenders, initialPerformanceFee, initialManagementFee];
}

const initialUSDCBalance = BigNumber.from(10000e6);
const initialWETHBalance = parseEther("100");

const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

const assets = [addresses.DAI, addresses.USDC, addresses.USDT, addresses.WETH];

const oracles = [addresses.CHAINLINK_DAI_USD, addresses.CHAINLINK_USDC_USD, addresses.CHAINLINK_USDT_USD, addresses.CHAINLINK_WETH_USD];

async function deployStrategy() {
  // Deploy facets
  TraderV0 = await ethers.getContractFactory("TraderV0");
  traderFacet = await TraderV0.deploy(maxPerformanceFee, maxManagementFee);

  GMXSwapModule = await ethers.getContractFactory("GMX_Swap_Module");
  gmxSwapModule = await GMXSwapModule.deploy(addresses.GMX_ROUTER);

  GMXPositionRouterModule = await ethers.getContractFactory("GMX_PositionRouter_Module");
  gmxPositionRouterModule = await GMXPositionRouterModule.deploy(addresses.GMX_ROUTER, addresses.GMX_POSITIONROUTER);

  GMXOrderBookModule = await ethers.getContractFactory("GMX_OrderBook_Module");
  gmxOrderbookModule = await GMXOrderBookModule.deploy(addresses.GMX_ROUTER, addresses.GMX_ORDERBOOK);

  GMXGLPModule = await ethers.getContractFactory("GMX_GLP_Module");
  gmxGLPModule = await GMXGLPModule.deploy(addresses.GMX_GLP_REWARDROUTER, addresses.GMX_GMX_REWARDROUTER);

  CamelotLPFacet = await ethers.getContractFactory("Camelot_LP_Module");
  camelotLPFacet = await CamelotLPFacet.deploy(addresses.CAMELOT_ROUTER, addresses.WETH);

  CamelotNFTPoolFacet = await ethers.getContractFactory("Camelot_NFTPool_Module");
  camelotNFTPoolFacet = await CamelotNFTPoolFacet.deploy();

  CamelotNitroPoolFacet = await ethers.getContractFactory("Camelot_NitroPool_Module");
  camelotNitroPoolFacet = await CamelotNitroPoolFacet.deploy();

  CamelotSwapFacet = await ethers.getContractFactory("Camelot_Swap_Module");
  camelotSwapFacet = await CamelotSwapFacet.deploy(addresses.CAMELOT_ROUTER);

  CamelotV3SwapFacet = await ethers.getContractFactory("Camelot_V3Swap_Module");
  camelotV3SwapFacet = await CamelotV3SwapFacet.deploy(addresses.CAMELOT_ODOS_ROUTER);

  CamelotStorageFacet = await ethers.getContractFactory("Camelot_Storage_Module");
  camelotStorageFacet = await CamelotStorageFacet.deploy(addresses.CAMELOT_NFTPOOL_FACTORY, addresses.CAMELOT_NITROPOOL_FACTORY);

  LyraStorageFacet = await ethers.getContractFactory("Lyra_Storage_Module");
  lyraStorageFacet = await LyraStorageFacet.deploy(addresses.LYRA_REGISTRY);

  LyraLPFacet = await ethers.getContractFactory("Lyra_LP_Module");
  lyraLPFacet = await LyraLPFacet.deploy();

  LyraOptionsFacet = await ethers.getContractFactory("Lyra_Options_Module");
  lyraOptionsFacet = await LyraOptionsFacet.deploy();

  LyraRewardsFacet = await ethers.getContractFactory("Lyra_Rewards_Module");
  lyraRewardsFacet = await LyraRewardsFacet.deploy(addresses.LYRA_MULTI_DISTRIBUTOR, addresses.CAMELOT_ROUTER);

  AaveLendingFacet = await ethers.getContractFactory("Aave_Lending_Module");
  aaveLendingFacet = await AaveLendingFacet.deploy(addresses.AAVE_POOL);

  TraderJoeSwapFacet = await ethers.getContractFactory("TraderJoe_Swap_Module");
  traderJoeSwapFacet = await TraderJoeSwapFacet.deploy(addresses.TRADERJOE_LBROUTER);

  TraderJoeLegacyLPFacet = await ethers.getContractFactory("TraderJoe_Legacy_LP_Module");
  traderJoeLegacyLPFacet = await TraderJoeLegacyLPFacet.deploy(addresses.TRADERJOE_LEGACY_LBROUTER, addresses.TRADERJOE_LEGACY_LBFACTORY);

  TraderJoeLPFacet = await ethers.getContractFactory("TraderJoe_LP_Module");
  traderJoeLPFacet = await TraderJoeLPFacet.deploy(addresses.TRADERJOE_LBROUTER, addresses.TRADERJOE_LBFACTORY);

  InchSwapFacet = await ethers.getContractFactory("Inch_Swap_Module");
  inchSwapFacet = await InchSwapFacet.deploy(addresses.INCH_AGGREGATION_ROUTER, addresses.INCH_CLIPPER_EXCHANGE);

  InchLimitOrderFacet = await ethers.getContractFactory("Inch_LimitOrder_Module");
  inchLimitOrderFacet = await InchLimitOrderFacet.deploy(addresses.INCH_AGGREGATION_ROUTER);

  // Deploy Strategy
  facets = [
    gmxSwapModule.address,
    gmxPositionRouterModule.address,
    gmxOrderbookModule.address,
    gmxGLPModule.address,
    camelotSwapFacet.address,
    camelotV3SwapFacet.address,
    camelotStorageFacet.address,
    lyraStorageFacet.address,
    lyraLPFacet.address,
    lyraOptionsFacet.address,
    lyraRewardsFacet.address,
    aaveLendingFacet.address,
    traderJoeSwapFacet.address,
    traderJoeLegacyLPFacet.address,
    traderJoeLPFacet.address,
    inchSwapFacet.address,
    inchLimitOrderFacet.address,
  ];

  Strategy = await ethers.getContractFactory("Strategy_GLP");
  strategy = await Strategy.deploy(devWallet.address, traderFacet.address, traderInitializerParams, facets, assets, oracles);

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_GLP", strategy.address);

  // Prepare other fixtures
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

  // Deploy Vault
  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "GLP++ Vault", "GLP-DSQ-V1", strategyDiamond.address, 1e12);

  // Configure Diamond
  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return {
    strategy,
    strategyDiamond,
    facets,
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
  };
}

describe("GLP++ Strategy", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("Interfaces", function () {
    beforeEach(async function () {
      const { strategy, strategyDiamond, facets } = await loadFixture(deployStrategy);
    });

    it("Should link the expected facet addresses", async function () {
      let expectedFacets = [traderFacet.address];
      expectedFacets = expectedFacets.concat(facets);
      expect(expectedFacets.length).to.eq(18);
      expect(await strategy.facetAddresses()).to.deep.eq(expectedFacets);
    });

    it("GMX: Should correctly assign selectors to their facet", async function () {
      let selectors = ["0xad91c2f7", "0xc86d3ed8", "0x49ce42af"];
      expect(await strategy.facetFunctionSelectors(gmxSwapModule.address)).to.deep.eq(selectors);

      selectors = ["0x6f1efa06", "0xcd65badb", "0xa3d43dc6", "0x06fdfa68", "0x4641c5f5"];
      expect(await strategy.facetFunctionSelectors(gmxPositionRouterModule.address)).to.deep.eq(selectors);

      selectors = [
        "0x80bdb0cb",
        "0x6144cf2a",
        "0x93125359",
        "0x2502a398",
        "0x4e67050c",
        "0x2a344ab2",
        "0x3053f600",
        "0xd9e4003e",
        "0x62231e3c",
      ];
      expect(await strategy.facetFunctionSelectors(gmxOrderbookModule.address)).to.deep.eq(selectors);

      selectors = [
        "0xc9274977",
        "0x0f208703",
        "0xd6c9d62a",
        "0x55583e31",
        "0xdd56398d",
        "0xe33a6e2c",
        "0xa4364f66",
        "0x4215fefa",
        "0xf3bf4a0f",
      ];
      expect(await strategy.facetFunctionSelectors(gmxGLPModule.address)).to.deep.eq(selectors);
    });

    it("Camelot: Should correctly assign selectors to their facet", async function () {
      let selectors = ["0xad78f426", "0xfe6f6d1a", "0xa861681f"];
      expect(await strategy.facetFunctionSelectors(camelotSwapFacet.address)).to.deep.eq(selectors);

      expect(await strategy.facetFunctionSelectors(camelotLPFacet.address)).to.deep.eq([]);

      expect(await strategy.facetFunctionSelectors(camelotNFTPoolFacet.address)).to.deep.eq([]);

      expect(await strategy.facetFunctionSelectors(camelotNitroPoolFacet.address)).to.deep.eq([]);

      expect(await strategy.facetFunctionSelectors(camelotStorageFacet.address)).to.deep.eq([
        "0x3b6a43d7",
        "0x150c8b37",
        "0x86009784",
        "0x5fc484a1",
        "0x49ed80c4",
        "0x357f7051",
        "0xa00906c7",
        "0xbecfb24f",
      ]);

      expect(await strategy.facetFunctionSelectors(camelotV3SwapFacet.address)).to.deep.eq(["0x84e4a75b"]);
    });

    it("Aave: Should correctly assign selectors to their facet", async function () {
      let selectors = ["0x9b7c1910", "0x4341f600", "0x73d57d9c", "0x2100c0b6", "0x1e9e1c45", "0xf846f74b"];
      expect(await strategy.facetFunctionSelectors(aaveLendingFacet.address)).to.deep.eq(selectors);
    });

    it("Lyra: Should correctly assign selectors to their facet", async function () {
      let selectors = ["0xbab15ea0", "0xda6af577"];
      expect(await strategy.facetFunctionSelectors(lyraLPFacet.address)).to.deep.eq(selectors);

      selectors = ["0x33ab8932", "0x5ad203d3", "0xc0522ead", "0xff648a61"];
      expect(await strategy.facetFunctionSelectors(lyraOptionsFacet.address)).to.deep.eq(selectors);

      selectors = ["0x58fef3cf", "0xccfe1624", "0x10e3cae8", "0xd83610c0", "0xffafd099"];
      expect(await strategy.facetFunctionSelectors(lyraStorageFacet.address)).to.deep.eq(selectors);

      selectors = ["0x6848edb9", "0x87af2f50", "0x503fcee7"];
      expect(await strategy.facetFunctionSelectors(lyraRewardsFacet.address)).to.deep.eq(selectors);
    });

    it("Trader Joe: Should correctly assign selectors to their facet", async function () {
      let selectors = ["0x460a03a8", "0x791a05ff", "0x42876737", "0xe68348c6", "0x18429273"];
      expect(await strategy.facetFunctionSelectors(traderJoeLegacyLPFacet.address)).to.deep.eq(selectors);

      selectors = ["0x4ba47a6e", "0xd0f5cb42", "0xcf63bdcc", "0xffdcc54b", "0xc408fb6a"];
      expect(await strategy.facetFunctionSelectors(traderJoeLPFacet.address)).to.deep.eq(selectors);

      selectors = [
        "0xaa25a1bc",
        "0x657ded9d",
        "0x6e688dc9",
        "0xd23bfab2",
        "0xf994f0f2",
        "0xab6c46fa",
        "0x8ffaaa6d",
        "0xac05de2d",
        "0x7830df9c",
      ];
      expect(await strategy.facetFunctionSelectors(traderJoeSwapFacet.address)).to.deep.eq(selectors);
    });

    it("1Inch: Should correctly assign selectors to their facet", async function () {
      let selectors = ["0xfbd85702", "0xdc3a2507", "0x4af1cb15", "0xae20e63f", "0x1626ba7e", "0x5f9f2664", "0xa6063111"];
      expect(await strategy.facetFunctionSelectors(inchLimitOrderFacet.address)).to.deep.eq(selectors);

      selectors = ["0xb911a26f", "0x68865bc7", "0x803871a4"];
      expect(await strategy.facetFunctionSelectors(inchSwapFacet.address)).to.deep.eq(selectors);
    });
  });
});
