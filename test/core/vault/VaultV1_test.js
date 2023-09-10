const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers, network } = require("hardhat");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, trader] = provider.getWallets();

const MAX_DEPOSITS = 1e12;

describe("Vault V1", function () {
  beforeEach(async function () {
    Test20 = await ethers.getContractFactory("TestFixture_ERC20");
    USDC = await Test20.deploy("USDC", "USDC");
    await USDC.setTokenDecimals(6);

    Vault = await ethers.getContractFactory("VaultV1");
    vault = await Vault.deploy(USDC.address, "USDC Vault", "DSQ-USDC-V1", trader.address, MAX_DEPOSITS);

    await USDC.connect(devWallet).mintTo(citizen1.address, 1e9);
    await USDC.connect(devWallet).mintTo(citizen2.address, 1e9);

    await USDC.connect(citizen1).approve(vault.address, 1e9);
    await USDC.connect(citizen2).approve(vault.address, 1e9);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;
    fundingStart = timestampBefore + 10;
    epochStart = fundingStart + 3 * 24 * 3600;
    epochEnd = epochStart + 7 * 24 * 3600;

    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);
  });

  it("Should start an epoch", async function () {
    expect(await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd))
      .to.emit(vault, "EpochStarted")
      .withArgs(1, fundingStart, epochStart, epochEnd);
  });

  it("Should start the next epoch if funds are not taken into custody during an epoch", async function () {
    expect(await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd))
      .to.emit(vault, "EpochStarted")
      .withArgs(1, fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_setNextBlockTimestamp", [epochEnd + 1]);

    // Should start the next oen
    expect(await vault.connect(devWallet).startEpoch(epochEnd + 10, epochEnd + 50 * 3600, epochEnd + 14 * 24 * 3600))
      .to.emit(vault, "EpochStarted")
      .withArgs(2, epochEnd + 10, epochEnd + 50 * 3600, epochEnd + 14 * 24 * 3600);
  });

  it("Should NOT start an epoch during an epoch", async function () {
    expect(await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd))
      .to.emit(vault, "EpochStarted")
      .withArgs(1, fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_setNextBlockTimestamp", [epochStart + 1]);

    // Not during
    await expect(vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd)).to.be.revertedWith("during");
  });

  it("Should NOT start an epoch if funds are custodied", async function () {
    expect(await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd))
      .to.emit(vault, "EpochStarted")
      .withArgs(1, fundingStart, epochStart, epochEnd);

    await USDC.connect(devWallet).mintTo(vault.address, 1000e6);
    await network.provider.send("evm_setNextBlockTimestamp", [epochStart + 1]);

    await vault.connect(trader).custodyFunds();

    await network.provider.send("evm_setNextBlockTimestamp", [epochEnd + 1]);

    // Not while custodied
    await expect(vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd)).to.be.revertedWith("!allowed");
  });

  it("Should NOT start an epoch with improper timing parameters", async function () {
    await expect(vault.connect(devWallet).startEpoch(0, epochStart, epochEnd)).to.be.revertedWith("!timing");
    await expect(vault.connect(devWallet).startEpoch(fundingStart, fundingStart + 3600, epochEnd)).to.be.revertedWith("!timing");
    await expect(vault.connect(devWallet).startEpoch(fundingStart, epochStart, fundingStart)).to.be.revertedWith("!timing");
    await expect(vault.connect(devWallet).startEpoch(fundingStart + 10, epochStart, epochStart + 31 * 24 * 3600)).to.be.revertedWith(
      "!epochLen",
    );
  });

  it("Should deposit/mint only during funding window", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart + 100, epochStart, epochEnd);

    await expect(vault.connect(citizen1).deposit(1e9, citizen1.address)).to.be.revertedWith("!funding");

    await network.provider.send("evm_increaseTime", [100]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    expect(await vault.connect(citizen2).mint(1e9, citizen2.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen2.address, citizen2.address, 1e9, 1e9);

    await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(citizen2).deposit(1e9, citizen2.address)).to.be.revertedWith("!funding");

    await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(citizen2).deposit(1e9, citizen2.address)).to.be.revertedWith("!funding");
  });

  it("Should withdraw/redeem at correct times", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart + 100, epochStart, epochEnd);

    await expect(vault.connect(citizen1).deposit(1e9, citizen1.address)).to.be.revertedWith("!funding");

    await network.provider.send("evm_increaseTime", [100]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    expect(await vault.connect(citizen2).mint(1e9, citizen2.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen2.address, citizen2.address, 1e9, 1e9);

    // Should withdraw before start
    expect(await vault.connect(citizen1).withdraw(1e3, citizen1.address, citizen1.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen1.address, citizen1.address, citizen1.address, 1e3, 1e3);

    expect(await vault.connect(citizen2).redeem(1e3, citizen2.address, citizen2.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen2.address, citizen2.address, citizen2.address, 1e3, 1e3);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(1e3);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(1e3);
    expect(await USDC.balanceOf(trader.address)).to.eq(0);
    expect(await USDC.balanceOf(vault.address)).to.eq(1999998000);

    // Should NOT withdraw during
    await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(citizen1).withdraw(1e9, citizen1.address, citizen1.address)).to.be.revertedWith("during");

    await expect(vault.connect(citizen2).redeem(1e9, citizen2.address, citizen2.address)).to.be.revertedWith("during");

    // Should withdraw after
    await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await network.provider.send("evm_mine");

    expect(await vault.connect(citizen1).withdraw(1e9 - 1e3, citizen1.address, citizen1.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen1.address, citizen1.address, citizen1.address, 1e9 - 1e3, 1e9 - 1e3);

    expect(await vault.connect(citizen2).redeem(1e9 - 1e3, citizen2.address, citizen2.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen2.address, citizen2.address, citizen2.address, 1e9 - 1e3, 1e9 - 1e3);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(1e9);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(1e9);
    expect(await USDC.balanceOf(trader.address)).to.eq(0);
    expect(await USDC.balanceOf(vault.address)).to.eq(0);
  });

  it("Should custody funds at the appropriate time", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_increaseTime", [10]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    await expect(vault.connect(trader).custodyFunds()).to.be.revertedWith("!during");

    await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(trader).custodyFunds()).to.emit(vault, "FundsCustodied").withArgs(1, 1e9);

    await expect(vault.connect(trader).custodyFunds()).to.be.revertedWith("custodied");
  });

  it("Should NOT custody funds after the epoch", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_increaseTime", [10]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    await expect(vault.connect(trader).custodyFunds()).to.be.revertedWith("!during");

    await network.provider.send("evm_increaseTime", [14 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(trader).custodyFunds()).to.be.revertedWith("!during");
  });

  it("Should return funds at appropriate times", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_increaseTime", [10]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    await network.provider.send("evm_increaseTime", [7 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(trader).returnFunds(1e9)).to.be.revertedWith("!custody");

    await expect(vault.connect(trader).custodyFunds()).to.emit(vault, "FundsCustodied").withArgs(1, 1e9);

    await USDC.connect(trader).approve(vault.address, 1e9);
    await expect(vault.connect(trader).returnFunds(0)).to.be.revertedWith("!amount");
    await expect(vault.connect(trader).returnFunds(1e9)).to.emit(vault, "FundsReturned").withArgs(1, 1e9);
  });

  it("Should conduct multiple epochs appropriately", async function () {
    // 1
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_increaseTime", [10]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);
    expect(await vault.connect(citizen2).deposit(1e9, citizen2.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen2.address, citizen2.address, 1e9, 1e9);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(0);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(0);
    expect(await USDC.balanceOf(trader.address)).to.eq(0);
    expect(await USDC.balanceOf(vault.address)).to.eq(2e9);

    expect(await vault.totalDeposits()).to.eq(2e9);

    await network.provider.send("evm_increaseTime", [3 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(trader).custodyFunds()).to.emit(vault, "FundsCustodied").withArgs(1, 2e9);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(0);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(0);
    expect(await USDC.balanceOf(trader.address)).to.eq(2e9);
    expect(await USDC.balanceOf(vault.address)).to.eq(0);

    await network.provider.send("evm_increaseTime", [6 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await USDC.connect(trader).approve(vault.address, 2e9);
    await expect(vault.connect(trader).returnFunds(2e9)).to.emit(vault, "FundsReturned").withArgs(1, 2e9);

    expect(await vault.totalDeposits()).to.eq(2e9);

    // 2
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;
    fundingStart = timestampBefore + 10;
    epochStart = fundingStart + 3 * 24 * 3600;
    epochEnd = epochStart + 7 * 24 * 3600;

    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

    expect(await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd))
      .to.emit(vault, "EpochStarted")
      .withArgs(2, fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_increaseTime", [10]);

    expect(await vault.connect(citizen1).withdraw(1e9, citizen1.address, citizen1.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen1.address, citizen1.address, citizen1.address, 1e9, 1e9);

    expect(await vault.totalDeposits()).to.eq(1e9);

    await network.provider.send("evm_increaseTime", [3 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(trader).custodyFunds()).to.emit(vault, "FundsCustodied").withArgs(2, 1e9);

    await network.provider.send("evm_increaseTime", [6 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await USDC.connect(trader).approve(vault.address, 1e9);
    await expect(vault.connect(trader).returnFunds(1e9)).to.emit(vault, "FundsReturned").withArgs(2, 1e9);

    // Withdraw at end of 2
    expect(await vault.connect(citizen2).withdraw(1e9, citizen2.address, citizen2.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen2.address, citizen2.address, citizen2.address, 1e9, 1e9);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(1e9);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(1e9);
    expect(await USDC.balanceOf(trader.address)).to.eq(0);
    expect(await USDC.balanceOf(vault.address)).to.eq(0);

    expect(await vault.totalDeposits()).to.eq(0);
  });

  it("Should conduct multiple epochs appropriately including profits and losses", async function () {
    // 1
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_increaseTime", [10]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);
    expect(await vault.connect(citizen2).deposit(1e9, citizen2.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen2.address, citizen2.address, 1e9, 1e9);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(0);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(0);
    expect(await USDC.balanceOf(trader.address)).to.eq(0);
    expect(await USDC.balanceOf(vault.address)).to.eq(2e9);

    expect(await vault.totalDeposits()).to.eq(2e9);

    await network.provider.send("evm_increaseTime", [3 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(trader).custodyFunds()).to.emit(vault, "FundsCustodied").withArgs(1, 2e9);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(0);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(0);
    expect(await USDC.balanceOf(trader.address)).to.eq(2e9);
    expect(await USDC.balanceOf(vault.address)).to.eq(0);

    await network.provider.send("evm_increaseTime", [6 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await USDC.connect(devWallet).mintTo(trader.address, 1e9);
    await USDC.connect(trader).approve(vault.address, 3e9);
    await expect(vault.connect(trader).returnFunds(3e9)).to.emit(vault, "FundsReturned").withArgs(1, 3e9);

    expect(await vault.totalDeposits()).to.eq(3e9);

    // 2
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;
    fundingStart = timestampBefore + 10;
    epochStart = fundingStart + 3 * 24 * 3600;
    epochEnd = epochStart + 7 * 24 * 3600;

    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart - 1]);

    expect(await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd))
      .to.emit(vault, "EpochStarted")
      .withArgs(2, fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_increaseTime", [10]);

    expect(await vault.connect(citizen1).withdraw(1e9, citizen1.address, citizen1.address)).to.emit(vault, "Withdraw");
    // .withArgs(citizen1.address, citizen1.address, citizen1.address, 1e9, 1e9);

    expect(await vault.totalDeposits()).to.eq(2e9);

    await network.provider.send("evm_increaseTime", [3 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await expect(vault.connect(trader).custodyFunds()).to.emit(vault, "FundsCustodied").withArgs(2, 2e9);

    await network.provider.send("evm_increaseTime", [6 * 24 * 3600]);
    await network.provider.send("evm_mine");

    await USDC.connect(trader).approve(vault.address, 1e9);
    await expect(vault.connect(trader).returnFunds(1e9)).to.emit(vault, "FundsReturned").withArgs(2, 1e9);

    // Withdraw at end of 2
    expect(await vault.connect(citizen2).redeem(1e9, citizen2.address, citizen2.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen2.address, citizen2.address, citizen2.address, 0.75e9, 1e9);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(1e9);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(0.75e9);
    expect(await USDC.balanceOf(trader.address)).to.eq(1e9);
    expect(await USDC.balanceOf(vault.address)).to.eq(0.25e9);

    expect(await vault.totalDeposits()).to.eq(0.25e9);
  });

  it("Should NOT deposit more than max", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart + 100, epochStart, epochEnd);

    expect(await vault.maxDeposits()).to.eq(MAX_DEPOSITS);
    expect(await vault.connect(devWallet).setMaxDeposits(1e9));
    expect(await vault.maxDeposits()).to.eq(1e9);

    await network.provider.send("evm_increaseTime", [100]);

    expect(await vault.totalDeposits()).to.eq(0);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    await expect(vault.connect(citizen2).mint(1e9, citizen2.address)).to.be.revertedWith("!maxMint");
    await expect(vault.connect(citizen2).deposit(1e9, citizen2.address)).to.be.revertedWith("!maxDeposit");

    expect(await vault.totalDeposits()).to.eq(1e9);

    await vault.connect(citizen1).withdraw(0.5e9, citizen1.address, citizen1.address);

    expect(await vault.totalDeposits()).to.eq(0.5e9);

    expect(await vault.connect(citizen2).deposit(0.5e9, citizen2.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen2.address, citizen2.address, 0.5e9, 0.5e9);

    await expect(vault.connect(citizen2).mint(0.5e9, citizen2.address)).to.be.revertedWith("!maxMint");
    await expect(vault.connect(citizen2).deposit(0.5e9, citizen2.address)).to.be.revertedWith("!maxDeposit");

    expect(await vault.totalDeposits()).to.eq(1e9);
  });

  it("Should block further deposits when max deposits < total deposits", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart + 100, epochStart, epochEnd);

    expect(await vault.maxDeposits()).to.eq(MAX_DEPOSITS);

    await network.provider.send("evm_increaseTime", [105]);

    expect(await vault.totalDeposits()).to.eq(0);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    expect(await vault.connect(devWallet).setMaxDeposits(0.5e9));
    expect(await vault.maxDeposits()).to.eq(0.5e9);

    await expect(vault.connect(citizen2).mint(1e9, citizen2.address)).to.be.revertedWith("!maxMint");
    await expect(vault.connect(citizen2).deposit(1e9, citizen2.address)).to.be.revertedWith("!maxDeposit");

    expect(await vault.totalDeposits()).to.eq(1e9);

    await vault.connect(citizen1).withdraw(1e9, citizen1.address, citizen1.address);

    expect(await vault.totalDeposits()).to.eq(0);

    expect(await USDC.balanceOf(citizen1.address)).to.eq(1e9);
    expect(await USDC.balanceOf(citizen2.address)).to.eq(1e9);
    expect(await USDC.balanceOf(trader.address)).to.eq(0);
    expect(await USDC.balanceOf(vault.address)).to.eq(0);
  });

  it("Should recover all funds if there are profits", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart + 100, epochStart, epochEnd);

    expect(await vault.maxDeposits()).to.eq(MAX_DEPOSITS);

    await network.provider.send("evm_increaseTime", [105]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    await USDC.connect(devWallet).mintTo(vault.address, 1e9);

    expect(await vault.balanceOf(citizen1.address)).to.eq(1e9);
    expect(await USDC.balanceOf(vault.address)).to.eq(2e9);

    await expect(() => vault.connect(citizen1).redeem(1e9, citizen1.address, citizen1.address)).to.changeTokenBalance(
      USDC,
      citizen1,
      2e9 - 1,
    );
  });

  it("Should return max deposit of zero if custodied", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart + 100, epochStart, epochEnd);

    expect(await vault.maxDeposit(citizen1.address)).to.eq(MAX_DEPOSITS);

    await network.provider.send("evm_increaseTime", [105]);

    expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);

    await network.provider.send("evm_setNextBlockTimestamp", [epochStart]);
    await vault.connect(trader).custodyFunds();
    expect(await vault.maxDeposit(citizen1.address)).to.eq(0);
  });

  it("Should get current epoch info", async function () {
    currentEpoch = await vault.getCurrentEpochInfo();

    expect(currentEpoch.fundingStart).to.eq(0);
    expect(currentEpoch.epochStart).to.eq(0);
    expect(currentEpoch.epochEnd).to.eq(0);

    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
    currentEpoch = await vault.getCurrentEpochInfo();

    expect(currentEpoch.fundingStart).to.eq(fundingStart);
    expect(currentEpoch.epochStart).to.eq(epochStart);
    expect(currentEpoch.epochEnd).to.eq(epochEnd);
  });

  it("Should split profits with two equal deposits", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
    await vault.connect(citizen1).deposit(1e9, citizen1.address);
    await vault.connect(citizen2).deposit(1e9, citizen2.address);

    await network.provider.send("evm_setNextBlockTimestamp", [epochStart]);
    await USDC.connect(devWallet).mintTo(vault.address, 2e9);
    await vault.connect(trader).custodyFunds();

    await USDC.connect(trader).approve(vault.address, 4e9);
    await vault.connect(trader).returnFunds(4e9);

    expect(await vault.connect(citizen1).redeem(1e9, citizen1.address, citizen1.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen1.address, citizen1.address, citizen1.address, 2e9 - 1, 1e9);

    expect(await vault.connect(citizen2).redeem(1e9, citizen2.address, citizen2.address))
      .to.emit(vault, "Withdraw")
      .withArgs(citizen2.address, citizen2.address, citizen2.address, 2e9, 1e9);
  });

  it("previewDeposit should return half shares if assets double", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
    await vault.connect(citizen1).deposit(1e9, citizen1.address);
    await vault.connect(citizen2).deposit(1e9, citizen2.address);
    expect(await vault.balanceOf(citizen1.address)).to.eq(1e9);
    expect(await vault.balanceOf(citizen2.address)).to.eq(1e9);

    await network.provider.send("evm_setNextBlockTimestamp", [epochStart]);
    await USDC.connect(devWallet).mintTo(vault.address, 2e9);
    await vault.connect(trader).custodyFunds();

    await USDC.connect(trader).approve(vault.address, 4e9);
    await vault.connect(trader).returnFunds(4e9);

    fundingStart = (await ethers.provider.getBlock()).timestamp + 10;
    epochStart = fundingStart + 3 * 24 * 3600;
    epochEnd = epochStart + 7 * 24 * 3600;
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
    await network.provider.send("evm_mine");

    // assets / total assets * total supply
    // (1e9 / 4e9) * 2e9 = 5e8
    expect(await vault.previewDeposit(1e9)).to.eq(1e9 / 2);
  });

  it("previewDeposit should return double shares if assets halve", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
    await vault.connect(citizen1).deposit(1e9, citizen1.address);
    await vault.connect(citizen2).deposit(1e9, citizen2.address);
    expect(await vault.balanceOf(citizen1.address)).to.eq(1e9);
    expect(await vault.balanceOf(citizen2.address)).to.eq(1e9);

    await network.provider.send("evm_setNextBlockTimestamp", [epochStart]);
    await USDC.connect(devWallet).mintTo(vault.address, 2e9);
    await vault.connect(trader).custodyFunds();

    await USDC.connect(trader).approve(vault.address, 1e9);
    await vault.connect(trader).returnFunds(1e9);

    fundingStart = (await ethers.provider.getBlock()).timestamp + 10;
    epochStart = fundingStart + 3 * 24 * 3600;
    epochEnd = epochStart + 7 * 24 * 3600;
    await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
    await network.provider.send("evm_mine");

    // assets / total assets * total supply
    // (1e9 / 1e9) * 2e9 = 2e9
    expect(await vault.previewDeposit(1e9)).to.eq(1e9 * 2 - 1);
  });

  it("should NOT fail with share attack", async function () {
    await vault.connect(devWallet).startEpoch(fundingStart + 100, epochStart, epochEnd);
    await network.provider.send("evm_setNextBlockTimestamp", [fundingStart + 100]);

    await expect(vault.connect(citizen1).deposit(1, citizen1.address))
      .to.emit(vault, "Deposit")
      .withArgs(citizen1.address, citizen1.address, 1, 1);

    await USDC.connect(citizen1).transfer(vault.address, 100e6 - 1);

    expect(await vault.connect(citizen2).deposit(190e6, citizen2.address));
    expect(await vault.balanceOf(citizen1.address)).to.eq(1);
    expect(await vault.balanceOf(citizen2.address)).to.be.gt(1);
  });

  describe("ERC4626 Property Tests", function () {
    it("Should return 0 for previewDeposit when not funding or custodied", async function () {
      expect(await vault.connect(citizen1).previewDeposit(1e9)).to.eq(0);
      await expect(vault.connect(citizen1).deposit(1e9)).to.be.reverted;
    });

    it("Should previewDeposit when funding and not custodied", async function () {
      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
      await network.provider.send("evm_mine");

      expect(await vault.connect(citizen1).previewDeposit(1e9)).to.eq(1e9);
      expect(await vault.connect(citizen1).deposit(1e9, citizen1.address))
        .to.emit(vault, "Deposit")
        .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);
    });

    it("Should return 0 for previewMint when not funding or custodied", async function () {
      expect(await vault.connect(citizen1).previewMint(1e9)).to.eq(0);
      await expect(vault.connect(citizen1).mint(1e9)).to.be.reverted;
    });

    it("Should previewMint when funding and not custodied", async function () {
      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);
      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
      await network.provider.send("evm_mine");

      expect(await vault.connect(citizen1).previewMint(1e9)).to.eq(1e9);
      expect(await vault.connect(citizen1).mint(1e9, citizen1.address))
        .to.emit(vault, "Deposit")
        .withArgs(citizen1.address, citizen1.address, 1e9, 1e9);
    });

    it("Should return 0 for previewWithdraw when during epoch", async function () {
      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);
      await vault.connect(citizen2).deposit(1e9, citizen2.address);
      expect(await vault.balanceOf(citizen1.address)).to.eq(1e9);
      expect(await vault.balanceOf(citizen2.address)).to.eq(1e9);

      await network.provider.send("evm_setNextBlockTimestamp", [epochStart]);
      await USDC.connect(devWallet).mintTo(vault.address, 2e9);
      await vault.connect(trader).custodyFunds();

      expect(await vault.connect(citizen1).previewWithdraw(1e9)).to.eq(0);
      await expect(vault.connect(citizen1).withdraw(1e9)).to.be.reverted;
    });

    it("Should previewWithdraw when not during epoch and not custodied", async function () {
      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_setNextBlockTimestamp", [epochStart]);
      await vault.connect(trader).custodyFunds();

      await USDC.connect(trader).approve(vault.address, 1e9);
      await vault.connect(trader).returnFunds(1e9);

      expect(await vault.connect(citizen1).previewWithdraw(1e9)).to.eq(1e9);
      expect(await vault.connect(citizen1).withdraw(1e9, citizen1.address, citizen1.address))
        .to.emit(vault, "Withdraw")
        .withArgs(citizen1.address, citizen1.address, citizen1.address, 1e9, 1e9);
    });

    it("Should return 0 for previewRedeem when during epoch", async function () {
      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);
      await vault.connect(citizen2).deposit(1e9, citizen2.address);
      expect(await vault.balanceOf(citizen1.address)).to.eq(1e9);
      expect(await vault.balanceOf(citizen2.address)).to.eq(1e9);

      await network.provider.send("evm_setNextBlockTimestamp", [epochStart]);
      await USDC.connect(devWallet).mintTo(vault.address, 2e9);
      await vault.connect(trader).custodyFunds();

      expect(await vault.connect(citizen1).previewRedeem(1e9)).to.eq(0);
      await expect(vault.connect(citizen1).redeem(1e9)).to.be.reverted;
    });

    it("Should previewRedeem when not during epoch and not custodied", async function () {
      await vault.connect(devWallet).startEpoch(fundingStart, epochStart, epochEnd);

      await network.provider.send("evm_setNextBlockTimestamp", [fundingStart]);
      await vault.connect(citizen1).deposit(1e9, citizen1.address);

      await network.provider.send("evm_setNextBlockTimestamp", [epochStart]);
      await vault.connect(trader).custodyFunds();

      await USDC.connect(trader).approve(vault.address, 1e9);
      await vault.connect(trader).returnFunds(1e9);

      expect(await vault.connect(citizen1).previewRedeem(1e9)).to.eq(1e9);
      expect(await vault.connect(citizen1).redeem(1e9, citizen1.address, citizen1.address))
        .to.emit(vault, "Withdraw")
        .withArgs(citizen1.address, citizen1.address, citizen1.address, 1e9, 1e9);
    });
  });
});
