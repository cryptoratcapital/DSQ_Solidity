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

  Strategy = await ethers.getContractFactory("Strategy_GM");
  strategy = await Strategy.deploy(devWallet.address, traderFacet.address, traderInitializerParams, [
    gmxSwapModule.address,
    gmxPositionRouterModule.address,
    gmxOrderbookModule.address,
  ]);

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

describe("GMX Modules Test", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("GMX_Swap_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH } = await loadFixture(deployStrategy);

      const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [strategyDiamond.address, USDC_SLOT], // key, slot
      );

      await setStorageAt(addresses.USDC, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialAVAXBalance);

      await strategyDiamond.approve(addresses.USDC, addresses.GMX_ROUTER, initialUSDCBalance);
    });

    it("swap: Should execute a well-formed swap", async function () {
      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(0);
      const swapPath = [addresses.USDC, addresses.WETH];
      await strategyDiamond.gmx_swap(swapPath, initialUSDCBalance, 0, strategyDiamond.address);
      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(BigNumber.from("8198070919500000000"));
    });

    it("inputGuard_gmx_swap: Should NOT execute an ill-formed swap", async function () {
      const swapPath = [addresses.USDC, addresses.WETH];
      const badSwapPath = [addresses.USDC, test20.address];
      await expect(strategyDiamond.gmx_swap(badSwapPath, initialUSDCBalance, 0, strategyDiamond.address)).to.be.revertedWith(
        "Invalid swap path",
      );
      await expect(strategyDiamond.gmx_swap(swapPath, initialUSDCBalance, 0, devWallet.address)).to.be.revertedWith(
        "GuardError: GMX swap recipient",
      );
    });

    it("swapETHToTokens: Should execute a well-formed swap", async function () {
      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(0);
      const swapPath = [addresses.WETH, addresses.USDC];
      await strategyDiamond.gmx_swapETHToTokens(ethers.utils.parseEther("100"), swapPath, 0, strategyDiamond.address);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.gte(initialUSDCBalance);
    });

    it("inputGuard_gmx_swapETHToTokens: Should NOT execute an ill-formed swap", async function () {
      const swapPath = [addresses.WETH, addresses.USDC];
      const badSwapPath = [addresses.WETH, test20.address];
      await expect(
        strategyDiamond.gmx_swapETHToTokens(ethers.utils.parseEther("100"), badSwapPath, 0, strategyDiamond.address),
      ).to.be.revertedWith("Invalid swap path");
      await expect(strategyDiamond.gmx_swapETHToTokens(ethers.utils.parseEther("100"), swapPath, 0, devWallet.address)).to.be.revertedWith(
        "GuardError: GMX swap recipient",
      );
    });

    it("swapTokensToEth: Should execute a well-formed swap", async function () {
      expect(await WETH.balanceOf(strategyDiamond.address)).to.eq(0);
      const swapPath = [addresses.USDC, addresses.WETH];
      await expect(() =>
        strategyDiamond.gmx_swapTokensToETH(swapPath, initialUSDCBalance, 0, strategyDiamond.address),
      ).to.changeEtherBalance(strategyDiamond, BigNumber.from("8198070919500000000"));
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(0);
    });

    it("inputGuard_gmx_swapTokensToETH: Should NOT execute an ill-formed swap", async function () {
      const swapPath = [addresses.USDC, addresses.WETH];
      const badSwapPath = [addresses.USDC, test20.address];
      await expect(strategyDiamond.gmx_swapTokensToETH(badSwapPath, initialUSDCBalance, 0, strategyDiamond.address)).to.be.revertedWith(
        "Invalid swap path",
      );
      await expect(strategyDiamond.gmx_swapTokensToETH(swapPath, initialUSDCBalance, 0, devWallet.address)).to.be.revertedWith(
        "GuardError: GMX swap recipient",
      );
    });
  });

  describe("GMX_OrderBook_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH } = await loadFixture(deployStrategy);

      const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [strategyDiamond.address, USDC_SLOT], // key, slot
      );

      await setStorageAt(addresses.USDC, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialAVAXBalance);

      await strategyDiamond.approve(addresses.USDC, addresses.GMX_ROUTER, initialUSDCBalance);
    });

    it("createIncreaseOrder: Should create a well-formed limit increase order for AVAX", async function () {
      // Limit buy WETH using $1000 of USDC
      const amountIn = 1000e6;
      await strategyDiamond.gmx_createIncreaseOrder(
        [addresses.USDC],
        amountIn,
        addresses.WETH,
        0,
        0, //TODO - Size parameter is weird
        addresses.WETH,
        true,
        BigNumber.from("11970000000000000000000000000000"),
        false,
        ethers.utils.parseEther("0.01"),
        false,
        { value: ethers.utils.parseEther("0.01") },
      );
    });

    it("inputGuard_gmx_createIncreaseOrder: Should NOT create an ill-formed limit increase order", async function () {
      // Limit buy WETH using $1000 of USDC
      const amountIn = 1000e6;
      await expect(
        strategyDiamond.gmx_createIncreaseOrder(
          [addresses.USDC],
          amountIn,
          test20.address,
          0,
          0, //TODO - Size parameter is weird
          addresses.WETH,
          true,
          BigNumber.from("11970000000000000000000000000000"),
          false,
          ethers.utils.parseEther("0.01"),
          false,
          { value: ethers.utils.parseEther("0.01") },
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.gmx_createIncreaseOrder(
          [addresses.USDC],
          amountIn,
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          test20.address,
          true,
          BigNumber.from("11970000000000000000000000000000"),
          false,
          ethers.utils.parseEther("0.01"),
          false,
          { value: ethers.utils.parseEther("0.01") },
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.gmx_createIncreaseOrder(
          [addresses.USDC, test20.address],
          amountIn,
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          addresses.WETH,
          true,
          BigNumber.from("11970000000000000000000000000000"),
          false,
          ethers.utils.parseEther("0.01"),
          false,
          { value: ethers.utils.parseEther("0.01") },
        ),
      ).to.be.revertedWith("Invalid swap path");

      await expect(
        strategyDiamond.gmx_createIncreaseOrder(
          [addresses.USDC],
          amountIn,
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          addresses.WETH,
          true,
          BigNumber.from("11970000000000000000000000000000"),
          false,
          ethers.utils.parseEther("0.01"),
          false,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("GuardError: GMX execution fee");
    });

    it("createDecreaseOrder: Should create a well-formed limit decrease order for AVAX", async function () {
      await expect(
        strategyDiamond.gmx_createDecreaseOrder(
          addresses.WETH,
          1, //TODO - Size parameter is weird
          addresses.WETH,
          0,
          true,
          BigNumber.from("11970000000000000000000000000000"),
          true,
          ethers.utils.parseEther("0.02"),
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.not.be.reverted;
    });

    it("inputGuard_gmx_createDecreaseOrder: Should NOT create an ill-formed limit decrease order for AVAX", async function () {
      await expect(
        strategyDiamond.gmx_createDecreaseOrder(
          test20.address,
          1, //TODO - Size parameter is weird
          addresses.WETH,
          0,
          true,
          BigNumber.from("11970000000000000000000000000000"),
          true,
          ethers.utils.parseEther("0.02"),
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.gmx_createDecreaseOrder(
          addresses.WETH,
          1, //TODO - Size parameter is weird
          test20.address,
          0,
          true,
          BigNumber.from("11970000000000000000000000000000"),
          true,
          ethers.utils.parseEther("0.02"),
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.gmx_createDecreaseOrder(
          addresses.WETH,
          1, //TODO - Size parameter is weird
          addresses.WETH,
          0,
          true,
          BigNumber.from("11970000000000000000000000000000"),
          true,
          ethers.utils.parseEther("0.02"),
          { value: ethers.utils.parseEther("0.03") },
        ),
      ).to.be.revertedWith("GuardError: GMX execution fee");
    });

    it("createSwapOrder: Should create a well-formed limit swap order for AVAX", async function () {
      // Limit buy WETH using $1000 of USDC
      const amountIn = 1000e6;
      await expect(
        strategyDiamond.gmx_createSwapOrder(
          [addresses.USDC, addresses.WETH],
          amountIn,
          0,
          0,
          true,
          ethers.utils.parseEther("0.01"),
          false,
          false,
          {
            value: ethers.utils.parseEther("0.01"),
          },
        ),
      ).to.not.be.reverted;
    });

    it("inputGuard_gmx_createSwapOrder: Should NOT create an ill-formed limit swap order for AVAX", async function () {
      // Limit buy WETH using $1000 of USDC
      const amountIn = 1000e6;
      await expect(
        strategyDiamond.gmx_createSwapOrder(
          [addresses.USDC, test20.address],
          amountIn,
          0,
          0,
          true,
          ethers.utils.parseEther("0.01"),
          false,
          false,
          {
            value: ethers.utils.parseEther("0.01"),
          },
        ),
      ).to.be.revertedWith("Invalid swap path");

      await expect(
        strategyDiamond.gmx_createSwapOrder(
          [addresses.USDC, addresses.WETH],
          amountIn,
          0,
          0,
          true,
          ethers.utils.parseEther("0.01"),
          false,
          false,
          {
            value: ethers.utils.parseEther("0.02"),
          },
        ),
      ).to.be.revertedWith("GuardError: GMX execution fee");
    });
  });

  describe("GMX_PositionRouter_Module", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH } = await loadFixture(deployStrategy);

      const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [strategyDiamond.address, USDC_SLOT], // key, slot
      );

      await setStorageAt(addresses.USDC, index, toBytes32(initialUSDCBalance));
      await setBalance(strategyDiamond.address, initialAVAXBalance);

      await strategyDiamond.approve(addresses.USDC, addresses.GMX_ROUTER, initialUSDCBalance);
    });

    it("createIncreasePosition: Should create a well-formed increase position for AVAX", async function () {
      // Long WETH using $1000 of USDC
      const amountIn = 1000e6;
      await expect(
        strategyDiamond.gmx_createIncreasePosition(
          [addresses.USDC],
          addresses.WETH,
          amountIn,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.not.be.reverted;
    });

    it("inputGuard_gmx_createIncreasePosition: Should NOT create an ill-formed increase position", async function () {
      // Long WETH using $1000 of USDC
      const amountIn = 1000e6;
      await expect(
        strategyDiamond.gmx_createIncreasePosition(
          [addresses.USDC],
          test20.address,
          amountIn,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.gmx_createIncreasePosition(
          [test20.address],
          addresses.WETH,
          amountIn,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid swap path");

      await expect(
        strategyDiamond.gmx_createIncreasePosition(
          [addresses.USDC, test20.address],
          addresses.WETH,
          amountIn,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid swap path");

      await expect(
        strategyDiamond.gmx_createIncreasePosition(
          [addresses.USDC],
          addresses.WETH,
          amountIn,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          devWallet.address,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("GuardError: GMX callback target");

      await expect(
        strategyDiamond.gmx_createIncreasePosition(
          [addresses.USDC],
          addresses.WETH,
          amountIn,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.03") },
        ),
      ).to.be.revertedWith("GuardError: GMX execution fee");
    });

    it("createIncreasePositionETH: Should create a well-formed increase position for AVAX", async function () {
      // Long WETH using 1 AVAX
      const valueIn = ethers.utils.parseEther("1");
      await strategyDiamond.gmx_createIncreasePositionETH(
        valueIn,
        [addresses.WETH],
        addresses.WETH,
        0,
        0, //TODO - Size parameter is weird
        true,
        BigNumber.from("11970000000000000000000000000000"),
        ethers.utils.parseEther("0.02"),
        ethers.constants.HashZero,
        ethers.constants.AddressZero,
        { value: ethers.utils.parseEther("0.02") },
      );
    });

    it("inputGuard_gmx_createIncreasePositionETH: Should NOT create an ill-formed increase position", async function () {
      // Long WETH using 1 AVAX
      const valueIn = ethers.utils.parseEther("1");
      await expect(
        strategyDiamond.gmx_createIncreasePositionETH(
          valueIn,
          [addresses.WETH],
          test20.address,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.gmx_createIncreasePositionETH(
          valueIn,
          [test20.address],
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid swap path");

      await expect(
        strategyDiamond.gmx_createIncreasePositionETH(
          valueIn,
          [addresses.USDC, test20.address],
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid swap path");

      await expect(
        strategyDiamond.gmx_createIncreasePositionETH(
          valueIn,
          [addresses.WETH],
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          devWallet.address,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("GuardError: GMX callback target");

      await expect(
        strategyDiamond.gmx_createIncreasePositionETH(
          valueIn,
          [addresses.WETH],
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          true,
          BigNumber.from("11970000000000000000000000000000"),
          ethers.utils.parseEther("0.02"),
          ethers.constants.HashZero,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("1.02") },
        ),
      ).to.be.revertedWith("GuardError: GMX execution fee");
    });

    it("createDecreasePosition: Should create a well-formed decrease position for AVAX", async function () {
      await expect(
        strategyDiamond.gmx_createDecreasePosition(
          [addresses.USDC],
          addresses.WETH,
          addresses.USDC,
          0, //TODO - Size parameter is weird
          true,
          strategyDiamond.address,
          BigNumber.from("11970000000000000000000000000000"),
          0,
          ethers.utils.parseEther("0.02"),
          false,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.not.be.reverted;
    });

    it("inputGuard_gmx_createDecreasePosition: Should NOT create an ill-formed decrease position", async function () {
      // Long WETH using $1000 of USDC
      const amountIn = 1000e6;
      await expect(
        strategyDiamond.gmx_createDecreasePosition(
          [addresses.USDC],
          test20.address,
          0,
          0, //TODO - Size parameter is weird
          true,
          strategyDiamond.address,
          BigNumber.from("11970000000000000000000000000000"),
          0,
          ethers.utils.parseEther("0.02"),
          false,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid token");

      await expect(
        strategyDiamond.gmx_createDecreasePosition(
          [addresses.USDC, test20.address],
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          true,
          strategyDiamond.address,
          BigNumber.from("11970000000000000000000000000000"),
          0,
          ethers.utils.parseEther("0.02"),
          false,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("Invalid swap path");

      await expect(
        strategyDiamond.gmx_createDecreasePosition(
          [addresses.USDC],
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          true,
          strategyDiamond.address,
          BigNumber.from("11970000000000000000000000000000"),
          0,
          ethers.utils.parseEther("0.02"),
          false,
          devWallet.address,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("GuardError: GMX callback target");

      await expect(
        strategyDiamond.gmx_createDecreasePosition(
          [addresses.USDC],
          addresses.WETH,
          0,
          0, //TODO - Size parameter is weird
          true,
          devWallet.address,
          BigNumber.from("11970000000000000000000000000000"),
          0,
          ethers.utils.parseEther("0.02"),
          false,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.02") },
        ),
      ).to.be.revertedWith("GuardError: GMX DecreasePosition recipient");

      await expect(
        strategyDiamond.gmx_createDecreasePosition(
          [addresses.USDC],
          addresses.WETH,
          addresses.USDC,
          0, //TODO - Size parameter is weird
          true,
          strategyDiamond.address,
          BigNumber.from("11970000000000000000000000000000"),
          0,
          ethers.utils.parseEther("0.02"),
          false,
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.03") },
        ),
      ).to.be.revertedWith("GuardError: GMX execution fee");
    });
  });

  xdescribe("Mainnet fork sanity checking", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WETH } = await loadFixture(deployStrategy);

      const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [strategyDiamond.address, USDC_SLOT], // key, slot
      );

      await setStorageAt(addresses.USDC, index, toBytes32(initialUSDCBalance));

      await strategyDiamond.approve(addresses.USDC, addresses.GMX_ROUTER, initialUSDCBalance);
    });

    it("WETH: Test fixture should work", async function () {
      expect(await WETH.balanceOf(citizen1.address)).to.eq(0);
      await expect(() => WETH.connect(citizen1).deposit({ value: ethers.utils.parseEther("1") })).to.changeEtherBalances(
        [citizen1, WETH],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
      expect(await WETH.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
    });
  });
});
