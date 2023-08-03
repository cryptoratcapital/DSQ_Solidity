const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { time, setBalance, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { toBytes32, setStorageAt, setTokenBalance } = require("../../helpers/storageHelpers.js");
const { getGLPPurchaseOutput, getGLPRedeemOutput } = require("../../helpers/gmx/calculationHelpers.js");
const addressesAndParams = require("../../helpers/addressesAndParams.json");
const { getNetworkConfig, forkOrSkip } = require("../../helpers/forkHelpers.js");

use(solidity);
const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, feeReceiver] = provider.getWallets();

let forkConfigs = {
  avax: {
    name: "avax",
    url: process.env.AVAX_URL || "https://rpc.ankr.com/avalanche",
    blockNumber: 27951255,
    addresses: addressesAndParams["avax_mainnet"].addresses,
    parameters: addressesAndParams["avax_mainnet"].parameters,
  },
};

let forkConfig = getNetworkConfig(forkConfigs);

let traderInitializerParams;
if (forkConfig !== undefined) {
  addresses = forkConfig.addresses;
  USDC_SLOT = forkConfig.parameters.USDC_SLOT;

  const initialPerformanceFee = parseEther("0.1"); // 10% fee
  const initialManagementFee = parseEther("0.01"); // 1% fee

  const strategyDiamondName = "TestFixture_Strategy_GLPModule";
  const allowedTokens = [addresses.USDC, addresses.WNATIVE, addresses.GMX_GLP];
  const allowedSpenders = [addresses.GMX_GLP_MANAGER];
  traderInitializerParams = [strategyDiamondName, allowedTokens, allowedSpenders, initialPerformanceFee, initialManagementFee];
}
const initialUSDCBalance = BigNumber.from(10000e6);
const initialNATIVEBalance = parseEther("100");

const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

async function deployStrategy() {
  Trader = await ethers.getContractFactory("TraderV0");
  traderFacet = await Trader.deploy(maxPerformanceFee, maxManagementFee);

  GMXGLPModule = await ethers.getContractFactory("GMX_GLP_Module");
  gmxGLPModule = await GMXGLPModule.deploy(addresses.GMX_GLP_REWARDROUTER, addresses.GMX_GMX_REWARDROUTER);

  Strategy = await ethers.getContractFactory("TestFixture_Strategy_GLPModule");
  strategy = await Strategy.deploy(devWallet.address, traderFacet.address, traderInitializerParams, gmxGLPModule.address);

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_GLPModule", strategy.address);

  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  WNATIVE = await ethers.getContractAt("contracts/trader/external/IWETH.sol:IWETH", addresses.WNATIVE);

  gmx_vault = await ethers.getContractAt("contracts/trader/external/gmx_interfaces/IVault.sol:IVault", addresses.GMX_VAULT);
  gmx_vaultUtils = await ethers.getContractAt("IVaultUtils", addresses.GMX_VAULT_UTILS);
  gmx_glpManager = await ethers.getContractAt("IGlpManager", addresses.GMX_GLP_MANAGER);
  gmx_glp = await ethers.getContractAt("TestFixture_ERC20", addresses.GMX_GLP);
  gmx_rewardReader = await ethers.getContractAt("IRewardReader", addresses.GMX_REWARD_READER);
  gmx_fglp = await ethers.getContractAt("TestFixture_ERC20", addresses.GMX_FGLP);
  gmx_fsglp = await ethers.getContractAt("TestFixture_ERC20", addresses.GMX_FSGLP);
  gmx_rewardRouterV2 = await ethers.getContractAt("IRewardRouterV2", addresses.GMX_GLP_REWARDROUTER);

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "USDC Vault", "DSQ-USDC-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  console.log(await traderFacet.EXECUTOR_ROLE());
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return {
    strategyDiamond,
    vault,
    test20,
    USDC,
    WNATIVE,
    gmx_vault,
    gmx_vaultUtils,
    gmx_glp,
    gmx_glpManager,
    gmx_rewardReader,
    gmx_fglp,
    gmx_fsglp,
    gmx_rewardRouterV2,
  };
}

describe("TestFixture_Strategy_GLP_Module", function () {
  before(async function () {
    if (await forkOrSkip(forkConfig)) this.skip();
  });

  describe("GMX_GLP_Module", function () {
    beforeEach(async function () {
      const {
        strategyDiamond,
        vault,
        test20,
        USDC,
        WNATIVE,
        gmx_vault,
        gmx_vaultUtils,
        gmx_glp,
        gmx_glpManager,
        gmx_rewardReader,
        gmx_fglp,
        gmx_fsglp,
        gmx_rewardRouterV2,
      } = await loadFixture(deployStrategy);

      await setTokenBalance(addresses.USDC, USDC_SLOT, strategyDiamond.address, initialUSDCBalance);
      await setBalance(strategyDiamond.address, initialNATIVEBalance);

      await strategyDiamond.approve(addresses.USDC, addresses.GMX_GLP_MANAGER, initialUSDCBalance);
    });

    it("gmx_mintAndStakeGlp: Should execute a well-formed call", async function () {
      expect(await gmx_glp.balanceOf(strategyDiamond.address)).to.eq(0);
      const glpAmount = await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, initialUSDCBalance);
      await strategyDiamond.gmx_mintAndStakeGlp(USDC.address, initialUSDCBalance, 0, glpAmount);
      expect(await gmx_fsglp.balanceOf(strategyDiamond.address)).to.eq(glpAmount);
    });

    it("inputGuard_gmx_mintAndStakeGlp: Should NOT execute an ill-formed call", async function () {
      expect(await gmx_glp.balanceOf(strategyDiamond.address)).to.eq(0);
      const glpAmount = await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, initialUSDCBalance);
      await expect(strategyDiamond.gmx_mintAndStakeGlp(test20.address, initialUSDCBalance, 0, glpAmount)).to.be.revertedWith(
        "Invalid token",
      );
    });

    it("gmx_mintAndStakeGlpETH: Should execute a well-formed call", async function () {
      expect(await gmx_glp.balanceOf(strategyDiamond.address)).to.eq(0);
      const glpAmount = await getGLPPurchaseOutput(
        gmx_vault,
        gmx_vaultUtils,
        gmx_glpManager,
        gmx_glp,
        WNATIVE.address,
        18,
        parseEther("1"),
      );
      await strategyDiamond.gmx_mintAndStakeGlpETH(parseEther("1"), 0, glpAmount);
      expect(await gmx_fsglp.balanceOf(strategyDiamond.address)).to.eq(glpAmount);
    });

    it("gmx_unstakeAndRedeemGlp: Should execute a well-formed call", async function () {
      // Stake
      const glpAmount = await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, initialUSDCBalance);
      await strategyDiamond.gmx_mintAndStakeGlp(USDC.address, initialUSDCBalance, 0, glpAmount);
      expect(await gmx_fsglp.balanceOf(strategyDiamond.address)).to.eq(glpAmount);

      // Calculate output amount for redeem
      const outputAmount = await getGLPRedeemOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, glpAmount);

      // Unstake
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(0);
      await strategyDiamond.gmx_unstakeAndRedeemGlp(USDC.address, glpAmount, 0, strategyDiamond.address);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(outputAmount);
    });

    it("inputGuard_gmx_unstakeAndRedeemGlp: Should NOT execute an ill-formed call", async function () {
      // Stake
      const glpAmount = await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, initialUSDCBalance);
      await strategyDiamond.gmx_mintAndStakeGlp(USDC.address, initialUSDCBalance, 0, glpAmount);
      expect(await gmx_fsglp.balanceOf(strategyDiamond.address)).to.eq(glpAmount);

      // Out-of-mandate token
      await expect(strategyDiamond.gmx_unstakeAndRedeemGlp(test20.address, glpAmount, 0, strategyDiamond.address)).to.be.revertedWith(
        "Invalid token",
      );
      // Invalid receiver
      await expect(strategyDiamond.gmx_unstakeAndRedeemGlp(USDC.address, glpAmount, 0, citizen1.address)).to.be.revertedWith(
        "GMX_GLP_Module: Invalid receiver",
      );
    });

    it("gmx_unstakeAndRedeemGlpETH: Should execute a well-formed call", async function () {
      // Stake
      const glpAmount = await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, initialUSDCBalance);
      await strategyDiamond.gmx_mintAndStakeGlp(USDC.address, initialUSDCBalance, 0, glpAmount);
      expect(await gmx_fsglp.balanceOf(strategyDiamond.address)).to.eq(glpAmount);

      // Calculate output amount for redeem
      const outputAmount = await getGLPRedeemOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, WNATIVE.address, glpAmount);

      // Unstake
      await expect(() => strategyDiamond.gmx_unstakeAndRedeemGlpETH(glpAmount, 0, strategyDiamond.address)).to.changeEtherBalance(
        strategyDiamond,
        outputAmount,
      );
    });

    it("inputGuard_gmx_unstakeAndRedeemGlpETH: Should NOT execute an ill-formed call", async function () {
      // Stake
      const glpAmount = await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, initialUSDCBalance);
      await strategyDiamond.gmx_mintAndStakeGlp(USDC.address, initialUSDCBalance, 0, glpAmount);
      expect(await gmx_fsglp.balanceOf(strategyDiamond.address)).to.eq(glpAmount);

      // Invalid receiver
      await expect(strategyDiamond.gmx_unstakeAndRedeemGlpETH(glpAmount, 0, citizen1.address)).to.be.revertedWith(
        "GMX_GLP_Module: Invalid receiver",
      );
    });

    it("gmx_claim: Should execute a well-formed call", async function () {
      // Stake
      const glpAmount = await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, initialUSDCBalance);
      await strategyDiamond.gmx_mintAndStakeGlp(USDC.address, initialUSDCBalance, 0, glpAmount);
      expect(await gmx_fsglp.balanceOf(strategyDiamond.address)).to.eq(glpAmount);

      // Time passes, rewards accrue
      let data = await gmx_rewardReader.getStakingInfo(strategyDiamond.address, [gmx_fglp.address]);
      console.log(data);
      time.increase(31 * 24 * 3600);
      data = await gmx_rewardReader.getStakingInfo(strategyDiamond.address, [gmx_fglp.address]);
      console.log(data);

      // TODO: It is claiming but the calculation is failing, need to write a helper
      await expect(() => strategyDiamond.gmx_claim()).to.changeTokenBalance(WNATIVE, strategyDiamond, data[0]);
    });

    it("gmx_handleRewards: Should execute a well-formed call", async function () {
      // Stake
      const glpAmount = await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, initialUSDCBalance);
      await strategyDiamond.gmx_mintAndStakeGlp(USDC.address, initialUSDCBalance, 0, glpAmount);
      expect(await gmx_fsglp.balanceOf(strategyDiamond.address)).to.eq(glpAmount);

      // Time passes, rewards accrue
      let data = await gmx_rewardReader.getStakingInfo(strategyDiamond.address, [gmx_fglp.address]);
      console.log(data);
      time.increase(31 * 24 * 3600);
      data = await gmx_rewardReader.getStakingInfo(strategyDiamond.address, [gmx_fglp.address]);
      console.log(data);

      // TODO: It is claiming but the calculation is failing, need to write a helper
      await expect(() => strategyDiamond.gmx_handleRewards(false, false, false, false, false, true, false)).to.changeTokenBalance(
        WNATIVE,
        strategyDiamond,
        data[0],
      );
    });
  });

  xdescribe("Mainnet fork sanity checking", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WNATIVE, gmx_glp, gmx_glpManager } = await loadFixture(deployStrategy);

      await setTokenBalance(addresses.USDC, USDC_SLOT, strategyDiamond.address, initialUSDCBalance);

      await strategyDiamond.approve(addresses.USDC, addresses.GMX_GLP_REWARDROUTER, initialUSDCBalance);
    });

    it("WNATIVE: Test fixture should work", async function () {
      expect(await WNATIVE.balanceOf(citizen1.address)).to.eq(0);
      await expect(() => WNATIVE.connect(citizen1).deposit({ value: ethers.utils.parseEther("1") })).to.changeEtherBalances(
        [citizen1, WNATIVE],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
      expect(await WNATIVE.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
    });

    it("Sanity check balance setter function", async function () {
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(initialUSDCBalance);
      const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [strategyDiamond.address, USDC_SLOT], // key, slot
      );

      await setStorageAt(addresses.USDC, index, toBytes32(BigNumber.from(69)));

      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(BigNumber.from(69));
    });

    it("GLP price should fetch", async function () {
      console.log(await getGLPPurchaseOutput(gmx_vault, gmx_vaultUtils, gmx_glpManager, gmx_glp, USDC.address, 6, parseUnits("1", 6)));
    });
  });
});
