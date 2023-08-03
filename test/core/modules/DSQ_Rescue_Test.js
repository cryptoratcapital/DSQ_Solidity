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

  const strategyDiamondName = "DSQ Rescue";
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
  strategyDiamond = await ethers.getContractFactory("TraderV0");
  traderFacet = await strategyDiamond.deploy(maxPerformanceFee, maxManagementFee);

  RescueFacet = await ethers.getContractFactory("DSQ_Rescue_Module");
  rescueFacet = await RescueFacet.deploy();

  Strategy = await ethers.getContractFactory("TestFixture_Strategy_DSQRescue");
  strategy = await Strategy.deploy(devWallet.address, traderFacet.address, traderInitializerParams, rescueFacet.address);

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_DSQRescue", strategy.address);

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

describe("Rescue Module", function () {
  describe("Rescue Module", function () {
    it("arbitraryCall: Should execute a well formed call", async function () {
      const { strategyDiamond, vault, test20, USDC, WETH } = await loadFixture(deployStrategy);

      const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [strategyDiamond.address, USDC_SLOT], // key, slot
      );

      await setStorageAt(addresses.USDC, index, toBytes32(initialUSDCBalance));

      expect(await USDC.allowance(strategyDiamond.address, citizen1.address)).to.eq(0);

      IERC20 = new ethers.utils.Interface(["function approve(address spender, uint256 amount) external returns (bool)"]);
      const payload = IERC20.encodeFunctionData("approve", [citizen1.address, 1e6]);

      expect(await strategyDiamond.arbitraryCall(USDC.address, 0, payload))
        .to.emit(USDC, "Approval")
        .withArgs(strategyDiamond.address, citizen1.address, 1e6);

      expect(await USDC.allowance(strategyDiamond.address, citizen1.address)).to.eq(1e6);
    });

    it("arbitraryCall: Should ONLY be callable by DEFAULT_ADMIN_ROLE", async function () {
      const { strategyDiamond, vault, test20, USDC, WETH } = await loadFixture(deployStrategy);

      const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [strategyDiamond.address, USDC_SLOT], // key, slot
      );

      await setStorageAt(addresses.USDC, index, toBytes32(initialUSDCBalance));

      expect(await USDC.allowance(strategyDiamond.address, citizen1.address)).to.eq(0);

      IERC20 = new ethers.utils.Interface(["function approve(address spender, uint256 amount) external returns (bool)"]);
      const payload = IERC20.encodeFunctionData("approve", [citizen1.address, 1e6]);

      await expect(strategyDiamond.connect(citizen1).arbitraryCall(USDC.address, 0, payload)).to.be.revertedWith("AccessControl:");

      expect(await USDC.allowance(strategyDiamond.address, citizen1.address)).to.eq(0);
    });
  });
});
