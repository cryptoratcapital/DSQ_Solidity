const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, multisig, treasury] = provider.getWallets();

async function deployFixtures() {
  // Deploy contracts
  DSQ = await ethers.getContractFactory("DSQToken");
  dsq = await DSQ.deploy(treasury.address, ethers.utils.parseEther("500000"));
  ESDSQ = await ethers.getContractFactory("esDSQToken");
  esdsq = await ESDSQ.deploy("Escrowed DSquared Governance Token", "esDSQ");
  DSQStaking = await ethers.getContractFactory("DSQStaking");
  dsqStaking = await DSQStaking.deploy(multisig.address, treasury.address, esdsq.address, dsq.address);
  ESDSQStaking = await ethers.getContractFactory("esDSQStaking");
  esdsqStaking = await ESDSQStaking.deploy(multisig.address, dsq.address, esdsq.address, dsqStaking.address);
  Router = await ethers.getContractFactory("Router");
  router = await Router.deploy(multisig.address, dsq.address, esdsq.address, dsqStaking.address, esdsqStaking.address);

  await esdsq.connect(devWallet).addWhitelistAddress(esdsqStaking.address, true);
  await esdsq.connect(devWallet).addWhitelistAddress(router.address, true);
  await esdsq.connect(devWallet).addWhitelistAddress(dsqStaking.address, true);

  return { dsq, esdsq, dsqStaking, esdsqStaking, router };
}

/* eslint-disable mocha/no-skipped-tests */
xdescribe("esDSQStaking", function () {
  beforeEach(async function () {
    const { dsq, esdsq, dsqStaking, esdsqStaking, router } = await loadFixture(deployFixtures);
  });

  describe("Deployment", function () {
    it("Should set owner, dsq, esdsq, router, and dsqStaking", async function () {
      expect(await esdsqStaking.owner()).to.eq(multisig.address);
      expect(await esdsqStaking.dsq()).to.eq(dsq.address);
      expect(await esdsqStaking.esdsq()).to.eq(esdsq.address);
      expect(await esdsqStaking.dsqStaking()).to.eq(dsqStaking.address);
    });

    it("Should NOT deploy with zero addresses", async function () {
      await expect(ESDSQStaking.deploy(ethers.constants.AddressZero, dsq.address, esdsq.address, dsqStaking.address)).to.be.revertedWith(
        "esDSQStaking: Zero address",
      );
      await expect(
        ESDSQStaking.deploy(multisig.address, ethers.constants.AddressZero, esdsq.address, dsqStaking.address),
      ).to.be.revertedWith("esDSQStaking: Zero address");
      await expect(ESDSQStaking.deploy(multisig.address, dsq.address, ethers.constants.AddressZero, dsqStaking.address)).to.be.revertedWith(
        "esDSQStaking: Zero address",
      );
      await expect(ESDSQStaking.deploy(multisig.address, dsq.address, esdsq.address, ethers.constants.AddressZero)).to.be.revertedWith(
        "esDSQStaking: Zero address",
      );
    });
  });

  describe("Staking", function () {
    beforeEach(async function () {
      await dsqStaking.connect(multisig).setRouter(router.address);
      await esdsqStaking.connect(multisig).setRouter(router.address);
      await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));
    });

    it("Should stake if router & DSQ staked", async function () {
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));

      await expect(() => router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
      timestamp = (await ethers.provider.getBlock()).timestamp;
      expect(await esdsqStaking.totalStaked()).to.eq(ethers.utils.parseEther("1"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("1"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.pausedTime).to.eq(0);
      expect(position.fullyVestedTime).to.eq(timestamp + 365 * 24 * 3600);

      adminPosition = await esdsqStaking.adminPositions(citizen1.address);
      expect(adminPosition.positionAmount).to.eq(0);
      expect(adminPosition.positionRate).to.eq(0);
      expect(adminPosition.pausedTime).to.eq(0);
      expect(adminPosition.fullyVestedTime).to.eq(0);
    });

    it("Should emit Staked event", async function () {
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));

      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(esdsqStaking, "Staked")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));
    });

    it("Should NOT stake if DSQ not staked", async function () {
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQStaking: Insufficient DSQ staked",
      );
    });

    it("Should NOT claim if nothing has been staked", async function () {
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");
    });

    it("Should NOT stake if prior staked position is vested", async function () {
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));

      timestamp = (await ethers.provider.getBlock()).timestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQStaking: Position claimable",
      );
    });

    it("Should NOT admin stake if prior admin position is vested", async function () {
      await esdsq.connect(devWallet).mint(multisig.address, ethers.utils.parseEther("2"));
      await esdsq.connect(multisig).approve(router.address, ethers.utils.parseEther("2"));
      await router.connect(multisig).adminStakeESDSQStaking(citizen1.address, ethers.utils.parseEther("1"));

      timestamp = (await ethers.provider.getBlock()).timestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(router.connect(multisig).adminStakeESDSQStaking(citizen1.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQStaking: Position claimable",
      );
    });

    it("Should stake/claim at position rewardRate", async function () {
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsqStaking.connect(multisig).setRewardRate(ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await expect(() => router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
      timestamp = (await ethers.provider.getBlock()).timestamp;

      await esdsqStaking.connect(multisig).setRewardRate(1);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("2"), ethers.utils.parseEther("-2")],
      );
    });

    it("Should stake/claim 1 wei", async function () {
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await expect(() => router.connect(citizen1).stakeESDSQStaking(1)).to.changeTokenBalances(esdsq, [citizen1, esdsqStaking], [-1, 1]);
      timestamp = (await ethers.provider.getBlock()).timestamp;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(dsq, [citizen1, esdsqStaking], [1, -1]);
    });

    it("Should admin stake and claim", async function () {
      await esdsq.connect(devWallet).mint(multisig.address, ethers.utils.parseEther("1"));
      await esdsq.connect(multisig).approve(router.address, ethers.utils.parseEther("1"));

      await expect(() =>
        router.connect(multisig).adminStakeESDSQStaking(citizen1.address, ethers.utils.parseEther("1")),
      ).to.changeTokenBalances(esdsq, [multisig, esdsqStaking], [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")]);

      expect(await esdsqStaking.totalStaked()).to.eq(ethers.utils.parseEther("1"));
      adminPosition = await esdsqStaking.adminPositions(citizen1.address);
      expect(adminPosition.positionAmount).to.eq(ethers.utils.parseEther("1"));
      expect(adminPosition.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(adminPosition.pausedTime).to.eq(0);
      expect(adminPosition.fullyVestedTime).to.eq((await ethers.provider.getBlock()).timestamp + 365 * 24 * 3600);

      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.pausedTime).to.eq(0);
      expect(position.positionRate).to.eq(0);

      await network.provider.send("evm_increaseTime", [365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      adminPosition = await esdsqStaking.adminPositions(citizen1.address);
      expect(adminPosition.positionAmount).to.eq(0);
      expect(adminPosition.positionRate).to.eq(0);
      expect(adminPosition.pausedTime).to.eq(0);
      expect(adminPosition.fullyVestedTime).to.eq(0);

      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.pausedTime).to.eq(0);
      expect(position.positionRate).to.eq(0);
    });

    it("Should claim both types of tranches together", async function () {
      await esdsq.connect(devWallet).mint(multisig.address, ethers.utils.parseEther("1"));
      await esdsq.connect(multisig).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(multisig).adminStakeESDSQStaking(citizen1.address, ethers.utils.parseEther("1"));

      adminPosition = await esdsqStaking.adminPositions(citizen1.address);
      expect(adminPosition.fullyVestedTime).to.eq((await ethers.provider.getBlock()).timestamp + 365 * 24 * 3600);
      expect(adminPosition.positionAmount).to.eq(ethers.utils.parseEther("1"));
      expect(adminPosition.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(adminPosition.pausedTime).to.eq(0);

      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));

      position = await esdsqStaking.positions(citizen1.address);
      expect(position.fullyVestedTime).to.eq((await ethers.provider.getBlock()).timestamp + 365 * 24 * 3600);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("1"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.pausedTime).to.eq(0);

      expect(await esdsqStaking.totalStaked()).to.eq(ethers.utils.parseEther("2"));

      await network.provider.send("evm_increaseTime", [365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("2"), ethers.utils.parseEther("-2")],
      );
      adminPosition = await esdsqStaking.adminPositions(citizen1.address);
      expect(adminPosition.fullyVestedTime).to.eq(0);
      expect(adminPosition.positionAmount).to.eq(0);
      expect(adminPosition.positionRate).to.eq(0);
      expect(adminPosition.pausedTime).to.eq(0);

      position = await esdsqStaking.positions(citizen1.address);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.positionAmount).to.eq(0);
      expect(position.positionRate).to.eq(0);
      expect(position.pausedTime).to.eq(0);
    });
  });

  describe("Emergency Withdraw", function () {
    beforeEach(async function () {
      await dsqStaking.connect(multisig).setRouter(router.address);
      await esdsqStaking.connect(multisig).setRouter(router.address);
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
    });

    it("Should withdraw funds & stop regular vesting position", async function () {
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      await expect(() => router.connect(citizen1).emergencyWithdrawESDSQStaking()).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.pausedTime).to.eq(0);
      expect(position.positionRate).to.eq(0);
    });

    it("Should withdraw funds & stop admin vesting position", async function () {
      await esdsq.connect(devWallet).mint(multisig.address, ethers.utils.parseEther("1"));
      await esdsq.connect(multisig).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(multisig).adminStakeESDSQStaking(citizen1.address, ethers.utils.parseEther("1"));

      await expect(() => router.connect(citizen1).emergencyWithdrawESDSQStaking()).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.positionAmount).to.eq(0);
      expect(position.positionRate).to.eq(0);
      expect(position.pausedTime).to.eq(0);
      adminPosition = await esdsqStaking.adminPositions(citizen1.address);
      expect(adminPosition.fullyVestedTime).to.eq(0);
      expect(adminPosition.positionAmount).to.eq(0);
      expect(adminPosition.positionRate).to.eq(0);
      expect(adminPosition.pausedTime).to.eq(0);
    });

    it("Should withdraw funds & stop both vesting position types", async function () {
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));

      await esdsq.connect(devWallet).mint(multisig.address, ethers.utils.parseEther("1"));
      await esdsq.connect(multisig).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(multisig).adminStakeESDSQStaking(citizen1.address, ethers.utils.parseEther("1"));

      await expect(() => router.connect(citizen1).emergencyWithdrawESDSQStaking()).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("2"), ethers.utils.parseEther("-2")],
      );
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.positionAmount).to.eq(0);
      expect(position.positionRate).to.eq(0);
      expect(position.pausedTime).to.eq(0);
      adminPosition = await esdsqStaking.adminPositions(citizen1.address);
      expect(adminPosition.fullyVestedTime).to.eq(0);
      expect(adminPosition.positionAmount).to.eq(0);
      expect(adminPosition.positionRate).to.eq(0);
      expect(adminPosition.pausedTime).to.eq(0);
    });

    it("Should emit Withdrawn event", async function () {
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      await expect(router.connect(citizen1).emergencyWithdrawESDSQStaking())
        .to.emit(esdsqStaking, "Withdrawn")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));
    });

    it("Should NOT withdraw 0 balance", async function () {
      await expect(router.connect(citizen1).emergencyWithdrawESDSQStaking()).to.be.revertedWith("esDSQStaking: Insufficient balance");
    });
  });

  describe("Claiming", function () {
    beforeEach(async function () {
      // Fund esDSQStaking Contract with DSQ
      await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));

      // Stake a position
      await dsqStaking.connect(multisig).setRouter(router.address);
      await esdsqStaking.connect(multisig).setRouter(router.address);
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should claim DSQ when esDSQ is vested", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.pausedTime).to.eq(0);
    });

    it("Should burn esDSQ when claimed", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalance(
        esdsq,
        esdsqStaking,
        ethers.utils.parseEther("-1"),
      );
    });

    it("Should emit RewardPaid event", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking())
        .to.emit(esdsqStaking, "RewardPaid")
        .withArgs(citizen1.address, citizen1.address, ethers.utils.parseEther("1"));
    });

    it("Should emit RewardPaid event with router as recipient", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStakingAndStakeDSQStaking())
        .to.emit(esdsqStaking, "RewardPaid")
        .withArgs(citizen1.address, router.address, ethers.utils.parseEther("1"));
    });

    it("Should claim DSQ when esDSQ is vested and stake rewards in DSQStaking", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStakingAndStakeDSQStaking()).to.changeTokenBalances(
        dsq,
        [dsqStaking, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("2"));
    });

    it("Should NOT claim DSQ when esDSQ is not vested", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 364 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");
    });

    it("Should claim, stake a new position with different reward rate, and claim", async function () {
      // Claim first position
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.pausedTime).to.eq(0);

      // Stake second position
      await esdsqStaking.connect(multisig).setRewardRate(ethers.utils.parseEther(".5"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("1"));
      expect(position.fullyVestedTime).to.eq(timestamp + 365 * 24 * 3600);
      expect(position.pausedTime).to.eq(0);

      // Claim second position
      timestamp = (await ethers.provider.getBlock()).timestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther(".5"), ethers.utils.parseEther("-.5")],
      );
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
      expect(position.fullyVestedTime).to.eq(0);
      expect(position.pausedTime).to.eq(0);
      expect(await dsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1.5"));
    });
  });

  describe("Pausing", function () {
    beforeEach(async function () {
      // Fund esDSQStaking Contract with DSQ
      await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));

      // Stake a position
      await dsqStaking.connect(multisig).setRouter(router.address);
      await esdsqStaking.connect(multisig).setRouter(router.address);
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should pause vesting when staking DSQ drops below esDSQ", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 364 * 24 * 3600]);
      await router.connect(citizen1).withdrawDSQStaking(1);
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.pausedTime).to.eq(timestamp + 364 * 24 * 3600);

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");
    });

    it("Should NOT stake when position is paused", async function () {
      await router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"));
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQStaking: Insufficient DSQ staked",
      );
    });

    it("Should NOT claim when position is paused", async function () {
      await router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"));
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");
    });

    it("Should NOT set pausedTime twice", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 364 * 24 * 3600]);
      await router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("0.5"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.pausedTime).to.eq(timestamp + 364 * 24 * 3600);

      await network.provider.send("evm_increaseTime", [100]);
      await router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("0.5"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.pausedTime).to.eq(timestamp + 364 * 24 * 3600);
    });

    it("Should NOT pause vesting when more DSQ is added", async function () {
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.pausedTime).to.eq(0);

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 100 * 24 * 3600]);
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("0.5"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.pausedTime).to.eq(0);
    });

    it("Should resume vesting when staking DSQ drops & then increases above esDSQ", async function () {
      // Unstake day 200
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 200 * 24 * 3600]);
      await router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.pausedTime).to.eq(timestamp + 200 * 24 * 3600);

      // Restake DSQ on day 300
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 300 * 24 * 3600]);
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");

      // Can't claim on day 365
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");

      // Can't claim on day 464
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 464 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");

      // Can claim on day 465 (1 year + 100 day pause)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 465 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
    });
  });

  describe("Blending Positions", function () {
    beforeEach(async function () {
      // Fund esDSQStaking Contract with DSQ
      await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));

      // For math sake, set vesting duration to 100 days
      await esdsqStaking.connect(multisig).setVestingDuration(100 * 24 * 3600);

      // Stake a position
      await dsqStaking.connect(multisig).setRouter(router.address);
      await esdsqStaking.connect(multisig).setRouter(router.address);
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("100"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("100"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("100"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("100"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("100"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should blend 2 equal amounts", async function () {
      // Stake more esDSQ with 50 days left
      timestamp = timestamp + 50 * 24 * 3600;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));

      // New position should have amount = 2 ether and end time of timestamp + 75. ((50 * 1) + (100 * 1)) / 2
      // Rate remains 1 ether
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("2"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.fullyVestedTime).to.eq(timestamp + 75 * 24 * 3600);

      // Claim 2 * 1 = 2 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 75 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("2"), ethers.utils.parseEther("-2")],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });

    it("Should blend two positions and round vesting time up", async function () {
      // Stake more esDSQ at 50 days - 1 second
      timestamp = timestamp + 50 * 24 * 3600 - 1;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));

      /*
            With amounts the same, the weighted average becomes (time remaining + vestingDuration) / 2
            {(50 * 24 * 3600) + 1 + (100 * 24 * 3600)} / 2 = 12,960,001 / 2 = 6,480,000.5
            Fully vested time should round up to equal timestamp + 6,480,001
            */
      // Rate remains 1 ether and position should have amount = 2 ether
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("2"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.fullyVestedTime).to.not.eq(timestamp + 6480000);
      expect(position.fullyVestedTime).to.eq(timestamp + 6480001);

      // Claim 2 * 1 = 2 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 6480001]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("2"), ethers.utils.parseEther("-2")],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });

    it("Should blend two positions and round reward rate down", async function () {
      // Stake more esDSQ with 50 days left
      timestamp = timestamp + 50 * 24 * 3600;
      await esdsqStaking.connect(multisig).setRewardRate(ethers.utils.parseEther("1").add(1));
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));

      /*
            With amounts the same, the weighted average becomes (oldRate + newRate) / 2
            (1 ether + 1 ether + 1 wei) / 2 = 1 ether + .5 wei
            Rate should round down to equal 1 ether
            */
      // New position should have amount = 2 ether and end time of timestamp + 75. ((50 * 1) + (100 * 1)) / 2
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("2"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.fullyVestedTime).to.eq(timestamp + 75 * 24 * 3600);

      // Claim 2 * 1 = 2 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 75 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("2"), ethers.utils.parseEther("-2")],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });

    it("Should repeatedly stake position & vesting duration remains 100 days", async function () {
      // Tests that newVestedTime rounds up
      // If rounding down it would be (timestamp + (100 * 24 * 3600) - 1)
      timestamp += 1;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(esdsqStaking, "Staked")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.fullyVestedTime).to.eq(timestamp + 100 * 24 * 3600);

      timestamp += 1;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(esdsqStaking, "Staked")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.fullyVestedTime).to.eq(timestamp + 100 * 24 * 3600);

      timestamp += 1;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(esdsqStaking, "Staked")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.fullyVestedTime).to.eq(timestamp + 100 * 24 * 3600);

      timestamp += 1;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(esdsqStaking, "Staked")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.fullyVestedTime).to.eq(timestamp + 100 * 24 * 3600);
    });

    it("Should blend 1 wei", async function () {
      // Stake 1 more wei with 50 days left
      timestamp = timestamp + 50 * 24 * 3600;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(1);

      // New position should have amount = 1 ether + 1 wei
      // New time should be timestamp + {(4.32E6 * 1E18) + 8.64E6} / (1E18 + 1) = timestamp + 4320000.0000004319
      // fullyVestedTime rounds up so timestamp + 4320001
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("1").add(1));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.fullyVestedTime).to.eq(timestamp + 4320001);

      // Claim 2 * 1 = 2 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 4320001]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1").add(1), ethers.utils.parseEther("-1").sub(1)],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });

    it("Should blend 2 different reward rates", async function () {
      // Stake more esDSQ with 50 days left
      await esdsqStaking.connect(multisig).setRewardRate(ethers.utils.parseEther(".5"));
      timestamp = timestamp + 50 * 24 * 3600;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));

      // New position should have amount = 2 ether and end time of timestamp + 75. ((50 * 1) + (100 * 1)) / 2
      // Rate should be (1 ether * 1 ether) + (1 ether * .5 ether) / 2 ether = .75 ether
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("2"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther(".75"));
      expect(position.fullyVestedTime).to.eq(timestamp + 75 * 24 * 3600);

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 74 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");

      // Claim 2 * .75 = 1.5 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 75 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1.5"), ethers.utils.parseEther("-1.5")],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });

    it("Should blend 2 different reward rates with different amounts", async function () {
      // Stake more esDSQ with 50 days left
      await esdsqStaking.connect(multisig).setRewardRate(ethers.utils.parseEther("2"));
      timestamp = timestamp + 50 * 24 * 3600;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("3"));

      // New position should have amount = 4 ether and end time of timestamp + 87.5. ((50 * 1) + (100 * 3)) / 4
      // New rate should be ((3 ether * 2 ether) + (1 ether * 1 ether)) / 4 ether
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("4"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1.75"));
      expect(position.fullyVestedTime).to.eq(timestamp + 87.5 * 24 * 3600);

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 87 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");

      // Claim 4 * 1.75 = 7 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 87.5 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("7"), ethers.utils.parseEther("-7")],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });

    it("Should blend two positions with new position double the amount", async function () {
      // Stake more esDSQ with 25 days left
      timestamp = timestamp + 75 * 24 * 3600;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("2"));

      // New position should have amount = 3 ether and end time of timestamp + 75. ((25 * 1) + (100 * 2)) / 3
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("3"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.fullyVestedTime).to.eq(timestamp + 75 * 24 * 3600);

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 74 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");

      // Claim 3 * 1 = 3 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 75 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("3"), ethers.utils.parseEther("-3")],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });

    it("Should blend two positions with new position half the amount", async function () {
      // Stake more esDSQ with 50 days left
      timestamp = timestamp + 50 * 24 * 3600;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther(".5"));

      // New position should have amount = 3 ether and end time of timestamp + 67. ((50 * 1) + (100 * .5)) / 1.5
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("1.5"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.fullyVestedTime).to.eq(timestamp + (200 / 3) * 24 * 3600);

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + (180 / 3) * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");

      // Claim 1 * 1.5 = 1.5 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + (200 / 3) * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1.5"), ethers.utils.parseEther("-1.5")],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });

    it("Should blend two positions with new position 4x the amount", async function () {
      // Stake more esDSQ with 50 days left
      timestamp = timestamp + 50 * 24 * 3600;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("4"));

      // New position should have amount = 5 ether and end time of timestamp + 90. ((50 * 1) + (100 * 4)) / 5
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("5"));
      expect(position.positionRate).to.eq(ethers.utils.parseEther("1"));
      expect(position.fullyVestedTime).to.eq(timestamp + 90 * 24 * 3600);

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 89 * 24 * 3600]);
      await expect(router.connect(citizen1).claimESDSQStaking()).to.be.revertedWith("esDSQStaking: No valid vested position");

      // Claim 5 * 1 = 5 ether
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 90 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("5"), ethers.utils.parseEther("-5")],
      );

      // Position amount should now be 0
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
    });
  });

  describe("OnlyRouter", function () {
    it("Should NOT stake if not router", async function () {
      await expect(esdsqStaking.connect(citizen1).stake(citizen1.address, 0, true)).to.be.revertedWith("esDSQStaking: !router");
    });

    it("Should NOT claim if not router", async function () {
      await expect(esdsqStaking.connect(citizen1).claim(citizen1.address, citizen1.address)).to.be.revertedWith("esDSQStaking: !router");
    });
    it("Should NOT emergencyWithdraw if not router", async function () {
      await expect(esdsqStaking.connect(citizen1).emergencyWithdraw(citizen1.address)).to.be.revertedWith("esDSQStaking: !router");
    });

    it("Should NOT notify if not router", async function () {
      await expect(esdsqStaking.connect(citizen1).notify(citizen1.address)).to.be.revertedWith("esDSQStaking: !router");
    });
  });

  describe("Admin", function () {
    it("Should setRewardRate", async function () {
      expect(await esdsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("1"));
      await expect(esdsqStaking.connect(multisig).setRewardRate(ethers.utils.parseEther("5")))
        .to.emit(esdsqStaking, "NewRewardRate")
        .withArgs(ethers.utils.parseEther("1"), ethers.utils.parseEther("5"));
      expect(await esdsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("5"));
    });

    it("Should NOT setRewardRate of 0", async function () {
      await expect(esdsqStaking.connect(multisig).setRewardRate(0)).to.be.revertedWith("esDSQStaking: Zero rate");
    });

    it("Should NOT setRewardRate if not owner", async function () {
      await expect(esdsqStaking.connect(citizen1).setRewardRate(1)).to.be.reverted;
    });

    it("Should setVestingDuration", async function () {
      expect(await esdsqStaking.vestingDuration()).to.eq(365 * 24 * 3600);
      await expect(esdsqStaking.connect(multisig).setVestingDuration(100 * 24 * 3600))
        .to.emit(esdsqStaking, "NewVestingDuration")
        .withArgs(365 * 24 * 3600, 100 * 24 * 3600);
      expect(await esdsqStaking.vestingDuration()).to.eq(100 * 24 * 3600);
    });

    it("Should NOT setVestingDuration if not owner", async function () {
      await expect(esdsqStaking.connect(citizen1).setVestingDuration(1)).to.be.reverted;
    });

    it("Should NOT setVestingDuration of more than 1 year", async function () {
      await expect(esdsqStaking.connect(multisig).setVestingDuration(366 * 24 * 3600)).to.be.revertedWith(
        "esDSQStaking: maxVestingDuration",
      );
    });

    it("Should setRouter", async function () {
      expect(await esdsqStaking.router()).to.eq(ethers.constants.AddressZero);
      await expect(esdsqStaking.connect(multisig).setRouter(router.address))
        .to.emit(esdsqStaking, "NewRouter")
        .withArgs(ethers.constants.AddressZero, router.address);
      expect(await esdsqStaking.router()).to.eq(router.address);
    });

    it("Should NOT setRouter if not owner", async function () {
      await expect(esdsqStaking.connect(citizen1).setRouter(citizen1.address)).to.be.reverted;
    });

    it("Should NOT setRouter twice", async function () {
      expect(await esdsqStaking.router()).to.eq(ethers.constants.AddressZero);
      await expect(esdsqStaking.connect(multisig).setRouter(router.address))
        .to.emit(esdsqStaking, "NewRouter")
        .withArgs(ethers.constants.AddressZero, router.address);
      expect(await esdsqStaking.router()).to.eq(router.address);
      await expect(esdsqStaking.connect(multisig).setRouter(citizen1.address)).to.be.revertedWith("esDSQStaking: Router is immutable");
    });
  });
});
