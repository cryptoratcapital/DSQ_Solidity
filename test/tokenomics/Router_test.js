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

  await dsqStaking.connect(multisig).setRouter(router.address);
  await esdsqStaking.connect(multisig).setRouter(router.address);
  await esdsq.connect(devWallet).addWhitelistAddress(esdsqStaking.address, true);
  await esdsq.connect(devWallet).addWhitelistAddress(dsqStaking.address, true);
  await esdsq.connect(devWallet).addWhitelistAddress(router.address, true);

  return { dsq, esdsq, dsqStaking, esdsqStaking, router };
}

describe("Router", function () {
  beforeEach(async function () {
    const { dsq, esdsq, dsqStaking, esdsqStaking, router } = await loadFixture(deployFixtures);
  });

  describe("Deployment", function () {
    it("Should set owner, DSQ, esDSQ, DSQStaking, esDSQStaking", async function () {
      expect(await router.owner()).to.eq(multisig.address);
      expect(await router.dsq()).to.eq(dsq.address);
      expect(await router.esdsq()).to.eq(esdsq.address);
      expect(await router.dsqStaking()).to.eq(dsqStaking.address);
      expect(await router.esdsqStaking()).to.eq(esdsqStaking.address);
    });
  });

  describe("DSQ Staking", function () {
    beforeEach(async function () {
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));
    });

    it("Should NOT stake DSQ without approval", async function () {
      await expect(router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"))).to.be.reverted;
    });

    it("Should NOT stake 0 DSQ", async function () {
      await expect(router.connect(citizen1).stakeDSQStaking(0)).to.be.revertedWith("DSQStaking: Cannot stake 0");
    });

    it("Should stake DSQ", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(() => router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
      expect(await dsqStaking.totalSupply()).to.eq(ethers.utils.parseEther("1"));
    });

    it("Should withdraw DSQStaking", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
      expect(await dsqStaking.totalSupply()).to.eq(ethers.utils.parseEther("1"));

      await expect(() => router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("0"));
      expect(await dsqStaking.totalSupply()).to.eq(ethers.utils.parseEther("0"));
    });

    it("Should NOT withdraw 0 DSQ", async function () {
      await expect(router.connect(citizen1).withdrawDSQStaking(0)).to.be.revertedWith("DSQStaking: Cannot withdraw 0");
    });

    it("Should emergencyWithdrawDSQStaking", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
      expect(await dsqStaking.totalSupply()).to.eq(ethers.utils.parseEther("1"));

      await expect(() => router.connect(citizen1).emergencyWithdrawDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("0"));
      expect(await dsqStaking.totalSupply()).to.eq(ethers.utils.parseEther("0"));
    });

    it("Should NOT change token balance if emergencyWithdrawDSQStaking with zero balance", async function () {
      await expect(() => router.connect(citizen1).emergencyWithdrawDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [0, 0],
      );
    });
  });

  describe("esDSQ Staking", function () {
    beforeEach(async function () {
      await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
      await esdsq.connect(devWallet).mint(multisig.address, ethers.utils.parseEther("1"));
    });

    it("Should NOT stake esDSQ without approval", async function () {
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith(
        "ERC20: insufficient allowance",
      );
    });

    it("Should NOT stake 0 esDSQ", async function () {
      await expect(router.connect(citizen1).stakeESDSQStaking(0)).to.be.revertedWith("esDSQStaking: Cannot stake 0");
    });

    it("Should NOT stake esDSQ if less than required DSQ amount", async function () {
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQStaking: Insufficient DSQ staked",
      );
    });

    it("Should stake esDSQ with approval & DSQ balance", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));

      await expect(() => router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
      expect(await esdsqStaking.totalStaked()).to.eq(ethers.utils.parseEther("1"));
    });

    it("Should claim vested esDSQ position and receive DSQ", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      timestamp = (await ethers.provider.getBlock()).timestamp + 100;
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      await network.provider.send("evm_increaseTime", [365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
    });

    it("Should NOT stakeESDSQStakingForUser if NOT owner", async function () {
      await expect(router.connect(citizen1).adminStakeESDSQStaking(citizen1.address, ethers.utils.parseEther("1"))).to.be.reverted;
    });

    it("Should stakeESDSQStakingForUser if owner", async function () {
      await esdsq.connect(multisig).approve(router.address, ethers.utils.parseEther("1"));

      await expect(() =>
        router.connect(multisig).adminStakeESDSQStaking(citizen1.address, ethers.utils.parseEther("1")),
      ).to.changeTokenBalances(esdsq, [multisig, esdsqStaking], [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")]);
      expect(await esdsqStaking.totalStaked()).to.eq(ethers.utils.parseEther("1"));
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(ethers.utils.parseEther("1"));
      expect(position.pausedTime).to.eq(0);

      await network.provider.send("evm_increaseTime", [365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      position = await esdsqStaking.positions(citizen1.address);
      expect(position.positionAmount).to.eq(0);
      expect(position.fullyVestedTime).to.eq(0);
    });

    it("Should emergencyWithdrawESDSQStaking", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await expect(() => router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
      expect(await esdsqStaking.totalStaked()).to.eq(ethers.utils.parseEther("1"));

      await expect(() => router.connect(citizen1).emergencyWithdrawESDSQStaking()).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
    });
  });

  describe("Combos", function () {
    beforeEach(async function () {
      // Fund esDSQStaking Contract with DSQ
      await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));

      // Stake a position
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("11"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("11"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should claimESDSQStakingAndStake", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStakingAndStakeDSQStaking()).to.changeTokenBalances(
        dsq,
        [dsqStaking, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("2"));
    });

    it("Should harvestDSQStakingAndStakeESDSQStaking", async function () {
      await router.connect(citizen1).emergencyWithdrawESDSQStaking();
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("9"));
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

      timestamp = (await ethers.provider.getBlock()).timestamp;

      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("10"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 100]);

      await expect(() => router.connect(citizen1).harvestDSQStakingAndStakeESDSQStaking()).to.changeTokenBalances(
        esdsq,
        [esdsqStaking, dsqStaking],
        [ethers.utils.parseEther("10"), ethers.utils.parseEther("-10")],
      );
      expect(await esdsqStaking.totalStaked()).to.eq(ethers.utils.parseEther("10"));
    });

    it("Should NOT harvestDSQStakingAndStakeESDSQStaking if DSQ balance insufficient", async function () {
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

      timestamp = (await ethers.provider.getBlock()).timestamp;

      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 100]);
      await network.provider.send("evm_mine");
      expect(await dsqStaking.earned(citizen1.address)).to.eq(ethers.utils.parseEther("10"));

      // Citizen 1 has 1 ether of DSQ staked and receives 10.1 esDSQ as reward. Should revert
      await expect(router.connect(citizen1).harvestDSQStakingAndStakeESDSQStaking()).to.be.revertedWith(
        "esDSQStaking: Insufficient DSQ staked",
      );
    });

    it("Should emergencyWithdrawAll", async function () {
      await expect(() => router.connect(citizen1).emergencyWithdrawAll()).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(0);
      let data = await esdsqStaking.positions(citizen1.address);
      expect(data[1]).to.eq(0);
      expect(await dsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("11"));
      expect(await esdsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("2"));
    });

    it("Should emergencyWithdrawAll if DSQStaking balance is 0", async function () {
      await expect(() => router.connect(citizen1).emergencyWithdrawDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );

      await expect(() => router.connect(citizen1).emergencyWithdrawAll()).to.changeTokenBalances(
        esdsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
    });
  });

  describe("Pausing", function () {
    beforeEach(async function () {
      // Fund esDSQStaking Contract with DSQ
      await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));

      // Stake a position
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("11"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("11"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    it("Should pause if owner", async function () {
      expect(await router.paused()).to.eq(false);
      await router.connect(multisig).pause();
      expect(await router.paused()).to.eq(true);
    });

    it("Should NOT pause if not owner", async function () {
      expect(await router.paused()).to.eq(false);
      await expect(router.connect(citizen1).pause()).to.be.reverted;
    });

    it("Should unpause if owner", async function () {
      expect(await router.paused()).to.eq(false);
      await router.connect(multisig).pause();
      expect(await router.paused()).to.eq(true);
      await router.connect(multisig).unpause();
      expect(await router.paused()).to.eq(false);
    });

    it("Should NOT unpause if not owner", async function () {
      expect(await router.paused()).to.eq(false);
      await router.connect(multisig).pause();
      expect(await router.paused()).to.eq(true);
      await expect(router.connect(citizen1).unpause()).to.be.reverted;
    });

    it("Should NOT stake DSQ when paused", async function () {
      await router.connect(multisig).pause();
      await expect(router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith("Pausable: paused");
    });

    it("Should harvest & unstake DSQ when paused", async function () {
      await router.connect(multisig).pause();
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 100]);
      await expect(() => router.connect(citizen1).harvestDSQStaking()).to.changeTokenBalances(
        esdsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("10"), ethers.utils.parseEther("-10")],
      );
      await expect(() => router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
    });

    it("Should exitDSQ when paused", async function () {
      await router.connect(multisig).pause();
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 100]);
      await expect(() => router.connect(citizen1).exitDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
    });

    it("Should NOT stake esDSQ when paused", async function () {
      await router.connect(multisig).pause();
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith("Pausable: paused");
    });

    it("Should claim vested position when paused", async function () {
      await router.connect(multisig).pause();
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
    });

    it("Should NOT do combo call when paused", async function () {
      await router.connect(multisig).pause();
      await expect(router.connect(citizen1).claimESDSQStakingAndStakeDSQStaking()).to.be.revertedWith("Pausable: paused");
      await expect(router.connect(citizen1).harvestDSQStakingAndStakeESDSQStaking()).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Upgradeability", function () {
    beforeEach(async function () {
      // Fund esDSQStaking Contract with DSQ
      await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));

      // Stake a position
      await esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("2"));
      await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("11"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("11"));
      await esdsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("2"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"));
      timestamp = (await ethers.provider.getBlock()).timestamp;
    });

    // ***** Leaving in for now until we confirm decision
    xit("Should upgrade to new router & be able to unstake", async function () {
      // Deploy new router & update staking contracts
      newRouter = await Router.deploy(dsq.address, esdsq.address, dsqStaking.address, esdsqStaking.address);
      await dsqStaking.connect(multisig).setRouter(newRouter.address);
      await esdsqStaking.connect(devWallet).setRouter(newRouter.address);
      await esdsq.connect(devWallet).addWhitelistAddress(newRouter.address);

      // Should unstake DSQ with new router
      await expect(router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith("!router");
      await expect(() => newRouter.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        dsq,
        [dsqStaking, citizen1],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
    });

    it("Should deploy new staking contracts & router, and pause staking on old router", async function () {
      // Deploy new router & staking contracts
      newDSQStaking = await DSQStaking.deploy(multisig.address, treasury.address, esdsq.address, dsq.address);
      newESDSQStaking = await ESDSQStaking.deploy(multisig.address, dsq.address, esdsq.address, newDSQStaking.address);
      newRouter = await Router.deploy(multisig.address, dsq.address, esdsq.address, newDSQStaking.address, newESDSQStaking.address);

      // Set router for new staking contracts, add new contracts to esdsqWhitelist
      await newDSQStaking.connect(multisig).setRouter(newRouter.address);
      await newESDSQStaking.connect(multisig).setRouter(newRouter.address);

      await esdsq.connect(devWallet).addWhitelistAddress(newESDSQStaking.address, true);
      await esdsq.connect(devWallet).addWhitelistAddress(newDSQStaking.address, true);
      await esdsq.connect(devWallet).addWhitelistAddress(newRouter.address, true);
      await router.connect(multisig).pause();

      // Should claimESDSQStaking with old router
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 365 * 24 * 3600]);
      await expect(() => router.connect(citizen1).claimESDSQStaking()).to.changeTokenBalances(
        dsq,
        [citizen1, esdsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );

      // Should unstake DSQ with old router
      await expect(() => router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        dsq,
        [dsqStaking, citizen1],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );

      // Should NOT stake DSQ with old router
      await expect(router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith("Pausable: paused");

      // Should stake DSQ with new router
      await dsq.connect(citizen1).approve(newRouter.address, ethers.utils.parseEther("1"));
      await expect(() => newRouter.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        dsq,
        [newDSQStaking, citizen1],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );

      // Should NOT stake esDSQ with old router
      await expect(router.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.be.revertedWith("Pausable: paused");

      // Should stake esDSQ with new router
      await esdsq.connect(citizen1).approve(newRouter.address, ethers.utils.parseEther("1"));
      await expect(() => newRouter.connect(citizen1).stakeESDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        esdsq,
        [newESDSQStaking, citizen1],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
    });
  });
});
