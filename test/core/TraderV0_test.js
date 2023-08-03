const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { setBalance, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const addressesAndParams = require("../helpers/addressesAndParams.json");
const { setTokenBalance, toBytes32, setStorageAt } = require("../helpers/storageHelpers");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, feeReceiver] = provider.getWallets();

const CHAIN = "arb_mainnet";
const addresses = addressesAndParams[CHAIN].addresses;
const USDC_SLOT = addressesAndParams[CHAIN].parameters.USDC_SLOT;

const initialUSDCBalance = BigNumber.from(10000e6);
const initialAVAXBalance = parseEther("100");
const initialPerformanceFee = parseEther("0.1"); // 10% fee
const initialManagementFee = parseEther("0.01"); // 1% fee

const maxPerformanceFee = parseEther("0.2"); // 20% fee
const maxManagementFee = parseEther("0.02"); // 2% fee

const traderName = "TRIVIAL++";
const allowedTokens = [addresses.USDC, addresses.WNATIVE];
const allowedSpenders = [addresses.GMX_ROUTER, addresses.GMX_POSITIONROUTER, addresses.GMX_ORDERBOOK];
const traderInitializerParams = [traderName, allowedTokens, allowedSpenders, initialPerformanceFee, initialManagementFee];

const YEAR_ONE = 365 * 24 * 3600;
const DAY_ONE = 24 * 3600;
const FEE_DENOMINATOR = parseEther("1");

async function deployStrategy() {
  setBalance(devWallet.address, parseEther("1000"));
  Trader = await ethers.getContractFactory("TraderV0");
  traderFacet = await Trader.deploy(maxPerformanceFee, maxManagementFee);

  Strategy = await ethers.getContractFactory("TestFixture_TrivialStrategy");
  strategy = await Strategy.deploy(devWallet.address, traderFacet.address, traderInitializerParams);

  strategyDiamond = await ethers.getContractAt("StrategyDiamond_TestFixture_TrivialStrategy", strategy.address);

  // await strategyDiamond.initializeTraderV0([traderName, allowedTokens, allowedSpenders, initialPerformanceFee, initialManagementFee]);

  Test20 = await ethers.getContractFactory("TestFixture_ERC20");
  test20 = await Test20.deploy("Test20", "Test20");

  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  WNATIVE = await ethers.getContractAt("IWETH", addresses.WNATIVE);

  Vault = await ethers.getContractFactory("VaultV1");
  vault = await Vault.deploy(USDC.address, "USDC Vault", "DSQ-USDC-V1", strategyDiamond.address, 1e12);

  await strategyDiamond.setVault(vault.address);
  await strategyDiamond.setFeeReceiver(feeReceiver.address);
  await strategyDiamond.grantRole(traderFacet.EXECUTOR_ROLE(), devWallet.address);

  return { strategyDiamond, vault, test20, USDC, WNATIVE };
}

describe("TraderV0", function () {
  describe("Core", function () {
    beforeEach(async function () {
      const { strategyDiamond, vault, test20, USDC, WNATIVE } = await loadFixture(deployStrategy);
    });

    it("Should set parameters on construction", async function () {
      expect(await strategyDiamond.name()).to.eq(traderName);
      expect(await strategyDiamond.MAX_PERFORMANCE_FEE_RATE()).to.eq(maxPerformanceFee);
      expect(await strategyDiamond.MAX_MANAGEMENT_FEE_RATE()).to.eq(maxManagementFee);
      let data = await strategyDiamond.getAllowedTokens();
      expect(data).to.have.same.members(allowedTokens);
      data = await strategyDiamond.getAllowedSpenders();
      expect(data).to.have.same.members(allowedSpenders);
    });

    it("Should NOT set vault a second time", async function () {
      await expect(strategyDiamond.setVault(vault.address)).to.be.revertedWith("!set");
    });

    it("Should NOT set vault to zero address", async function () {
      await expect(strategyDiamond.setVault(ethers.constants.AddressZero)).to.be.revertedWith("!vault");
    });

    it("Should not approve a token which is not in allowedTokens", async function () {
      await expect(strategyDiamond.approve(test20.address, addresses.GMX_ROUTER, 1000)).to.be.revertedWith("!token");
    });

    it("Should not approve a spender which is not in allowedSpenders", async function () {
      await expect(strategyDiamond.approve(addresses.USDC, citizen1.address, 1000)).to.be.revertedWith("!spender");
    });

    it("Should execute a well-formed approval", async function () {
      await strategyDiamond.approve(addresses.USDC, addresses.GMX_ROUTER, 1000);
      expect(await USDC.allowance(strategyDiamond.address, addresses.GMX_ROUTER)).to.eq(1000);
      await strategyDiamond.approve(addresses.USDC, addresses.GMX_ROUTER, 0);
      expect(await USDC.allowance(strategyDiamond.address, addresses.GMX_ROUTER)).to.eq(0);
    });

    it("Should set new fees ONLY within the allowed boundaries", async function () {
      // Performance fee too high
      await expect(strategyDiamond.setFeeRates(parseEther("0.5"), initialManagementFee)).to.be.revertedWith("!rates");

      // Performance fee too high
      await expect(strategyDiamond.setFeeRates(initialPerformanceFee, parseEther("0.5"))).to.be.revertedWith("!rates");

      // Acceptable range
      let newPerformanceFee = parseEther("0.05");
      let newManagementFee = parseEther("0.005");
      await expect(strategyDiamond.setFeeRates(newPerformanceFee, newManagementFee))
        .to.emit(strategyDiamond, "FeesSet")
        .withArgs(initialPerformanceFee, newPerformanceFee, initialManagementFee, newManagementFee);

      expect(await strategyDiamond.performanceFeeRate()).to.eq(newPerformanceFee);
      expect(await strategyDiamond.managementFeeRate()).to.eq(newManagementFee);

      // Disable fees
      await expect(strategyDiamond.setFeeRates(0, 0))
        .to.emit(strategyDiamond, "FeesSet")
        .withArgs(newPerformanceFee, 0, newManagementFee, 0);

      expect(await strategyDiamond.performanceFeeRate()).to.eq(0);
      expect(await strategyDiamond.managementFeeRate()).to.eq(0);
    });

    it("Should NOT set new fees during an epoch", async function () {
      let index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [citizen1.address, USDC_SLOT], // key, slot
      );
      await setStorageAt(addresses.USDC, index, toBytes32(ethers.utils.parseUnits("1000", 6)));

      await USDC.connect(citizen1).approve(vault.address, 1e9);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      fundingStart = timestampBefore + 10;
      epochStart = fundingStart + 3 * 24 * 3600;
      epochEnd = epochStart + 7 * 24 * 3600;

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
      await network.provider.send("evm_mine");

      await strategyDiamond.connect(devWallet).custodyFunds();

      // Performance fee too high
      await expect(strategyDiamond.setFeeRates(initialPerformanceFee, initialManagementFee)).to.be.revertedWith("Custodied");
    });

    it("Should conduct an epoch including custody, return, and fees", async function () {
      await setTokenBalance(addresses.USDC, USDC_SLOT, citizen1.address, ethers.utils.parseUnits("1000", 6));

      await USDC.connect(citizen1).approve(vault.address, 1e9);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      fundingStart = timestampBefore + 10;
      epochStart = fundingStart + 3 * 24 * 3600;
      epochEnd = epochStart + 7 * 24 * 3600;

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
      await network.provider.send("evm_mine");

      await expect(strategyDiamond.connect(devWallet).custodyFunds()).to.emit(vault, "FundsCustodied").withArgs(1, 1e9);

      expect(await USDC.balanceOf(vault.address)).to.eq(0);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(1000e6);

      // Trade successfully, making 100% profits :rocket:
      await setTokenBalance(addresses.USDC, USDC_SLOT, strategyDiamond.address, ethers.utils.parseUnits("2000", 6));

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600 - 1]);

      const PERFORMANCE_FEE = ethers.utils.parseUnits("100", 6);
      const MANAGEMENT_FEE = ethers.utils
        .parseUnits("1000", 6)
        .mul(initialManagementFee)
        .mul(DAY_ONE * 7)
        .div(YEAR_ONE)
        .div(FEE_DENOMINATOR);

      await expect(strategyDiamond.connect(devWallet).returnFunds())
        .to.emit(strategyDiamond, "FundsReturned")
        .withArgs(1000e6, 2000e6, PERFORMANCE_FEE, MANAGEMENT_FEE);
      expect(await USDC.balanceOf(vault.address)).to.eq(2000e6 - PERFORMANCE_FEE - MANAGEMENT_FEE);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(PERFORMANCE_FEE.add(MANAGEMENT_FEE));
    });

    it("Should take management fees but NOT performance fees if epoch was breakeven", async function () {
      let index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [citizen1.address, USDC_SLOT], // key, slot
      );
      await setStorageAt(addresses.USDC, index, toBytes32(ethers.utils.parseUnits("1000", 6)));

      await USDC.connect(citizen1).approve(vault.address, 1e9);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      fundingStart = timestampBefore + 10;
      epochStart = fundingStart + 3 * 24 * 3600;
      epochEnd = epochStart + 7 * 24 * 3600;

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
      await network.provider.send("evm_mine");

      await strategyDiamond.connect(devWallet).custodyFunds();

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600 - 1]);

      const PERFORMANCE_FEE = ethers.utils.parseUnits("0", 6);
      const MANAGEMENT_FEE = ethers.utils
        .parseUnits("1000", 6)
        .mul(initialManagementFee)
        .mul(DAY_ONE * 7)
        .div(YEAR_ONE)
        .div(FEE_DENOMINATOR);

      await expect(strategyDiamond.connect(devWallet).returnFunds())
        .to.emit(strategyDiamond, "FundsReturned")
        .withArgs(1000e6, 1000e6, PERFORMANCE_FEE, MANAGEMENT_FEE);
      expect(await USDC.balanceOf(vault.address)).to.eq(1000e6 - PERFORMANCE_FEE - MANAGEMENT_FEE);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(PERFORMANCE_FEE.add(MANAGEMENT_FEE));
    });

    it("Should take management fees but NOT performance fees if epoch was a net loss", async function () {
      let index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [citizen1.address, USDC_SLOT], // key, slot
      );
      await setStorageAt(addresses.USDC, index, toBytes32(ethers.utils.parseUnits("1000", 6)));

      await USDC.connect(citizen1).approve(vault.address, 1e9);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      fundingStart = timestampBefore + 10;
      epochStart = fundingStart + 3 * 24 * 3600;
      epochEnd = epochStart + 7 * 24 * 3600;

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
      await network.provider.send("evm_mine");

      await strategyDiamond.connect(devWallet).custodyFunds();

      // Trade unsuccessfully, making -50% profits :cry:

      await setTokenBalance(addresses.USDC, USDC_SLOT, strategyDiamond.address, ethers.utils.parseUnits("500", 6));

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600 - 1]);

      const PERFORMANCE_FEE = ethers.utils.parseUnits("0", 6);
      const MANAGEMENT_FEE = ethers.utils
        .parseUnits("1000", 6)
        .mul(initialManagementFee)
        .mul(DAY_ONE * 7)
        .div(YEAR_ONE)
        .div(FEE_DENOMINATOR);

      await expect(strategyDiamond.connect(devWallet).returnFunds())
        .to.emit(strategyDiamond, "FundsReturned")
        .withArgs(1000e6, 500e6, PERFORMANCE_FEE, MANAGEMENT_FEE);
      expect(await USDC.balanceOf(vault.address)).to.eq(500e6 - PERFORMANCE_FEE - MANAGEMENT_FEE);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(PERFORMANCE_FEE.add(MANAGEMENT_FEE));
    });

    it("Should withdraw fees", async function () {
      let index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [citizen1.address, USDC_SLOT], // key, slot
      );
      await setStorageAt(addresses.USDC, index, toBytes32(ethers.utils.parseUnits("1000", 6)));

      await USDC.connect(citizen1).approve(vault.address, 1e9);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      fundingStart = timestampBefore + 10;
      epochStart = fundingStart + 3 * 24 * 3600;
      epochEnd = epochStart + 7 * 24 * 3600;

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
      await network.provider.send("evm_mine");

      await strategyDiamond.connect(devWallet).custodyFunds();

      // Trade successfully, making 100% profits :rocket:
      await setTokenBalance(addresses.USDC, USDC_SLOT, strategyDiamond.address, ethers.utils.parseUnits("2000", 6));

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600 - 1]);

      const PERFORMANCE_FEE = ethers.utils.parseUnits("100", 6);
      const MANAGEMENT_FEE = ethers.utils
        .parseUnits("1000", 6)
        .mul(initialManagementFee)
        .mul(DAY_ONE * 7)
        .div(YEAR_ONE)
        .div(FEE_DENOMINATOR);

      await expect(strategyDiamond.connect(devWallet).returnFunds())
        .to.emit(strategyDiamond, "FundsReturned")
        .withArgs(1000e6, 2000e6, PERFORMANCE_FEE, MANAGEMENT_FEE);
      expect(await USDC.balanceOf(vault.address)).to.eq(2000e6 - PERFORMANCE_FEE - MANAGEMENT_FEE);
      expect(await USDC.balanceOf(strategyDiamond.address)).to.eq(PERFORMANCE_FEE.add(MANAGEMENT_FEE));

      expect(await USDC.balanceOf(feeReceiver.address)).to.eq(0);
      expect(await strategyDiamond.connect(devWallet).withdrawFees())
        .to.emit(strategyDiamond, "FeesWithdrawn")
        .withArgs(devWallet.address, PERFORMANCE_FEE.add(MANAGEMENT_FEE));
      expect(await USDC.balanceOf(feeReceiver.address)).to.eq(PERFORMANCE_FEE.add(MANAGEMENT_FEE));
    });

    it("Should NOT withdraw fees if none have been earned", async function () {
      let index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [citizen1.address, USDC_SLOT], // key, slot
      );
      await setStorageAt(addresses.USDC, index, toBytes32(ethers.utils.parseUnits("1000", 6)));

      await USDC.connect(citizen1).approve(vault.address, 1e9);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      fundingStart = timestampBefore + 10;
      epochStart = fundingStart + 3 * 24 * 3600;
      epochEnd = epochStart + 7 * 24 * 3600;

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
      await network.provider.send("evm_mine");

      await strategyDiamond.connect(devWallet).custodyFunds();

      await expect(strategyDiamond.connect(devWallet).withdrawFees()).to.be.revertedWith("!fees");
    });

    it("Should NOT call admin functions without proper role", async function () {
      let index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [citizen1.address, USDC_SLOT], // key, slot
      );
      await setStorageAt(addresses.USDC, index, toBytes32(ethers.utils.parseUnits("1000", 6)));

      await USDC.connect(citizen1).approve(vault.address, 1e9);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      fundingStart = timestampBefore + 10;
      epochStart = fundingStart + 3 * 24 * 3600;
      epochEnd = epochStart + 7 * 24 * 3600;

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
      await network.provider.send("evm_mine");

      await expect(strategyDiamond.connect(citizen1).custodyFunds()).to.be.revertedWith("AccessControl:");
      await expect(strategyDiamond.connect(citizen1).returnFunds()).to.be.revertedWith("AccessControl:");
      await expect(strategyDiamond.connect(citizen1).withdrawFees()).to.be.revertedWith("AccessControl:");
      await expect(strategyDiamond.connect(citizen1).approve(USDC.address, addresses.GMX_ROUTER, 0)).to.be.revertedWith("AccessControl:");
    });
  });
});
