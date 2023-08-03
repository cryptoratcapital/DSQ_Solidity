const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { setBalance, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const addressesAndParams = require("../../helpers/addressesAndParams.json");
const { getNetworkConfig, forkOrSkip } = require("../../helpers/forkHelpers.js");
const { toBytes32, setStorageAt, getSlot } = require("../../helpers/storageHelpers.js");

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

  const strategyDiamondName = "GM++";
  const allowedTokens = [addresses.USDC, addresses.WETH];
  const allowedSpenders = [addresses.GMX_ROUTER, addresses.GMX_POSITIONROUTER, addresses.GMX_ORDERBOOK];
  traderInitializerParams = [strategyDiamondName, allowedTokens, allowedSpenders, initialPerformanceFee, initialManagementFee];
}

const initialUSDCBalance = BigNumber.from(10000e6);
const initialAVAXBalance = parseEther("100");

const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

async function deployStrategy() {
  setBalance(devWallet.address, parseEther("1000"));
  Trader = await ethers.getContractFactory("TraderV0");
  traderFacet = await Trader.deploy(maxPerformanceFee, maxManagementFee);

  GMXSwapModule = await ethers.getContractFactory("GMX_Swap_Module");
  gmxSwapModule = await GMXSwapModule.deploy(addresses.GMX_ROUTER);

  GMXPositionRouterModule = await ethers.getContractFactory("GMX_PositionRouter_Module");
  gmxPositionRouterModule = await GMXPositionRouterModule.deploy(addresses.GMX_ROUTER, addresses.GMX_POSITIONROUTER);

  GMXOrderBookModule = await ethers.getContractFactory("GMX_OrderBook_Module");
  gmxOrderbookModule = await GMXOrderBookModule.deploy(addresses.GMX_ROUTER, addresses.GMX_ORDERBOOK);

  // Deploy Strategy
  facets = [gmxSwapModule.address, gmxPositionRouterModule.address, gmxOrderbookModule.address];

  Strategy = await ethers.getContractFactory("Strategy_GM");
  strategy = await Strategy.deploy(devWallet.address, traderFacet.address, traderInitializerParams, facets);

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_GM", strategy.address);

  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  WETH = await ethers.getContractAt("IWETH", addresses.WETH);

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "USDC Vault", "DSQ-USDC-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return { strategyDiamond, vault, test20, USDC, WETH };
}

describe("GM++", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("Interfaces", function () {
    beforeEach(async function () {
      const { strategy, strategyDiamond, facets } = await loadFixture(deployStrategy);
    });

    it("Should link the expected facet addresses", async function () {
      let expectedFacets = [strategy.address, traderFacet.address];
      expectedFacets = expectedFacets.concat(facets);
      expect(expectedFacets.length).to.eq(5);
      expect(await strategy.facetAddresses()).to.deep.eq(expectedFacets);
    });

    it("GMX: Should correctly assign selectors to their facet", async function () {
      let selectors = ["0xad91c2f7", "0xa00b9bed", "0x49ce42af"];
      expect(await strategy.facetFunctionSelectors(gmxSwapModule.address)).to.deep.eq(selectors);

      selectors = ["0x6f1efa06", "0x6a1b0bc4", "0xa3d43dc6", "0x06fdfa68", "0x4641c5f5"];
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
    });
  });
});
