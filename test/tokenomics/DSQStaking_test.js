const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");
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
  await dsq.connect(treasury).transfer(citizen1.address, ethers.utils.parseEther("1"));

  return { dsq, esdsq, dsqStaking, esdsqStaking, router };
}

// Many of these tests are duplicates from StakingRewards except with router
/* eslint-disable mocha/no-skipped-tests */
xdescribe("DSQStaking", function () {
  beforeEach(async function () {
    const { dsq, esdsq, dsqStaking, esdsqStaking, router } = await loadFixture(deployFixtures);
  });

  describe("Deployment", function () {
    it("Should construct", async function () {
      expect(await dsqStaking.router()).to.eq(ethers.constants.AddressZero);
      expect(await dsqStaking.owner()).to.eq(multisig.address);
      expect(await dsqStaking.rewardsToken()).to.eq(esdsq.address);
      expect(await dsqStaking.stakingToken()).to.eq(dsq.address);
      expect(await dsqStaking.rewardsDistribution()).to.eq(treasury.address);
    });

    it("Should NOT deploy with owner zero address", async function () {
      await expect(DSQStaking.deploy(ethers.constants.AddressZero, treasury.address, esdsq.address, dsq.address)).to.be.revertedWith(
        "DSQStaking: Zero address",
      );
    });

    it("Should NOT deploy with rewardsToken zero address", async function () {
      await expect(DSQStaking.deploy(multisig.address, treasury.address, ethers.constants.AddressZero, dsq.address)).to.be.revertedWith(
        "DSQStaking: Zero address",
      );
    });

    it("Should NOT deploy with stakingToken zero address", async function () {
      await expect(DSQStaking.deploy(multisig.address, treasury.address, esdsq.address, ethers.constants.AddressZero)).to.be.revertedWith(
        "DSQStaking: Zero address",
      );
    });

    it("Should NOT deploy with stakingToken == rewardToken", async function () {
      await expect(DSQStaking.deploy(multisig.address, treasury.address, dsq.address, dsq.address)).to.be.revertedWith(
        "DSQStaking: Same token",
      );
    });
  });

  describe("Staking", function () {
    beforeEach(async function () {
      await dsqStaking.connect(multisig).setRouter(router.address);
      await esdsqStaking.connect(multisig).setRouter(router.address);
    });

    it("Should NOT stake if not approved", async function () {
      await expect(router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"))).to.be.reverted;
    });

    it("Should NOT stake 0", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(router.connect(citizen1).stakeDSQStaking(0)).to.be.revertedWith("DSQStaking: Cannot stake 0");
    });

    it("Should stake if router & approved", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(() => router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );

      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
      expect(await dsqStaking.totalSupply()).to.eq(ethers.utils.parseEther("1"));
    });

    it("Should NOT withdraw if no balance", async function () {
      await expect(router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"))).to.be.reverted;
    });

    it("Should NOT withdraw if amount > balance", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      await expect(router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("2"))).to.be.reverted;
    });

    it("Should NOT withdraw 0", async function () {
      await expect(router.connect(citizen1).withdrawDSQStaking(0)).to.be.revertedWith("DSQStaking: Cannot withdraw 0");
    });

    it("Should withdraw if router", async function () {
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
      expect(await dsqStaking.totalSupply()).to.eq(ethers.utils.parseEther("1"));

      await expect(() => router.connect(citizen1).withdrawDSQStaking(ethers.utils.parseEther("1"))).to.changeTokenBalances(
        dsq,
        [citizen1, dsqStaking],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("-1")],
      );
      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(0);
      expect(await dsqStaking.totalSupply()).to.eq(0);
    });

    it("Should stake, withdraw, and accrue rewards", async function () {
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      expect(await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(dsqStaking, "Staked")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));

      timestamp = (await ethers.provider.getBlock()).timestamp;

      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 100]);
      await network.provider.send("evm_mine");

      expect(await dsqStaking.earned(citizen1.address)).to.eq(ethers.utils.parseEther("10"));
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 101]);
      expect(await router.connect(citizen1).exitDSQStaking())
        .to.emit(dsqStaking, "RewardPaid")
        .withArgs(citizen1.address, citizen1.address, ethers.utils.parseEther("10.1"));

      expect(await dsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
      expect(await esdsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("10.1"));
    });

    it("Should NOT getReward if no reward", async function () {
      const balanceBefore = await esdsq.balanceOf(citizen1.address);
      await router.connect(citizen1).harvestDSQStaking();
      const balanceAfter = await esdsq.balanceOf(citizen1.address);
      expect(balanceAfter).eq(balanceBefore);
    });

    it("Should getReward", async function () {
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      expect(await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(dsqStaking, "Staked")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));

      timestamp = (await ethers.provider.getBlock()).timestamp;

      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 100]);
      await network.provider.send("evm_mine");

      expect(await dsqStaking.earned(citizen1.address)).to.eq(ethers.utils.parseEther("10"));
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 101]);
      expect(await router.connect(citizen1).harvestDSQStaking())
        .to.emit(dsqStaking, "RewardPaid")
        .withArgs(citizen1.address, citizen1.address, ethers.utils.parseEther("10.1"));

      expect(await esdsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("10.1"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    // Multiple staking test
    it("Should stake, withdraw, and accrue rewards for multiple users", async function () {
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

      await dsq.connect(treasury).transfer(citizen2.address, ethers.utils.parseEther("1"));
      await dsq.connect(treasury).transfer(citizen3.address, ethers.utils.parseEther("2"));
      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await dsq.connect(citizen2).approve(router.address, ethers.utils.parseEther("1"));
      await dsq.connect(citizen3).approve(router.address, ethers.utils.parseEther("2"));

      // From t = 0 to t = 100 blocks, only Citizen 1
      expect(await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(dsqStaking, "Staked")
        .withArgs(citizen1.address, ethers.utils.parseEther("1"));

      timestamp = (await ethers.provider.getBlock()).timestamp;

      expect(await dsqStaking.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 100]);
      await network.provider.send("evm_mine");

      expect(await dsqStaking.earned(citizen1.address)).to.eq(ethers.utils.parseEther("10"));

      // From t = 101 to t = 200 blocks, citizen 1 and citizen 2
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 101]);
      expect(await router.connect(citizen2).stakeDSQStaking(ethers.utils.parseEther("1")))
        .to.emit(dsqStaking, "Staked")
        .withArgs(citizen2.address, ethers.utils.parseEther("1"));

      expect(await dsqStaking.balanceOf(citizen2.address)).to.eq(ethers.utils.parseEther("1"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 201]);
      await network.provider.send("evm_mine");

      expect(await dsqStaking.earned(citizen1.address)).to.eq(ethers.utils.parseEther("15.1"));
      expect(await dsqStaking.earned(citizen2.address)).to.eq(ethers.utils.parseEther("5"));

      // From t = 201 to t = 300 blocks, all 3 staking
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 202]);
      expect(await router.connect(citizen3).stakeDSQStaking(ethers.utils.parseEther("2")))
        .to.emit(dsqStaking, "Staked")
        .withArgs(citizen3.address, ethers.utils.parseEther("2"));

      expect(await dsqStaking.balanceOf(citizen3.address)).to.eq(ethers.utils.parseEther("2"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 302]);
      await network.provider.send("evm_mine");

      expect(await dsqStaking.earned(citizen1.address)).to.eq(ethers.utils.parseEther("17.65"));
      expect(await dsqStaking.earned(citizen2.address)).to.eq(ethers.utils.parseEther("7.55"));
      expect(await dsqStaking.earned(citizen3.address)).to.eq(ethers.utils.parseEther("5"));

      // Cash out all and check balances
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 303]);
      expect(await router.connect(citizen1).exitDSQStaking())
        .to.emit(dsqStaking, "RewardPaid")
        .withArgs(citizen1.address, citizen1.address, ethers.utils.parseEther("17.675"));

      expect(await dsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1"));
      expect(await esdsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("17.675"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 304]);
      expect(await router.connect(citizen2).exitDSQStaking())
        .to.emit(dsqStaking, "RewardPaid")
        .withArgs(citizen2.address, citizen2.address, ethers.utils.parseEther("7.608333333333333333"));

      expect(await dsq.balanceOf(citizen2.address)).to.eq(ethers.utils.parseEther("1"));
      expect(await esdsq.balanceOf(citizen2.address)).to.eq(ethers.utils.parseEther("7.608333333333333333"));

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp + 305]);
      expect(await router.connect(citizen3).exitDSQStaking())
        .to.emit(dsqStaking, "RewardPaid")
        .withArgs(citizen3.address, citizen3.address, ethers.utils.parseEther("5.216666666666666666"));

      expect(await dsq.balanceOf(citizen3.address)).to.eq(ethers.utils.parseEther("2"));
      expect(await esdsq.balanceOf(citizen3.address)).to.eq(ethers.utils.parseEther("5.216666666666666666"));
    });
  });

  describe("Views", function () {
    beforeEach(async function () {
      await dsqStaking.connect(multisig).setRouter(router.address);
      await esdsqStaking.connect(multisig).setRouter(router.address);
    });

    it("Should return total supply", async function () {
      expect(await dsqStaking.totalSupply()).to.eq(0);

      await dsq.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(citizen1).stakeDSQStaking(ethers.utils.parseEther("1"));

      expect(await dsqStaking.totalSupply()).to.eq(ethers.utils.parseEther("1"));
    });

    it("Should get reward for duration", async function () {
      expect(await dsqStaking.getRewardForDuration()).to.eq(0);

      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      expect(await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480")))
        .to.emit(dsqStaking, "RewardAdded")
        .withArgs(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

      expect(await dsqStaking.getRewardForDuration()).to.eq(ethers.utils.parseEther("60480"));
    });
  });

  describe("OnlyRouter", function () {
    it("Should NOT stake if not router", async function () {
      await expect(dsqStaking.connect(citizen1).stake(citizen1.address, 0)).to.be.revertedWith("DSQStaking: !router");
    });

    it("Should NOT withdraw if not router", async function () {
      await expect(dsqStaking.connect(citizen1).withdraw(citizen1.address, 0)).to.be.revertedWith("DSQStaking: !router");
    });

    it("Should NOT getReward if not router", async function () {
      await expect(dsqStaking.connect(citizen1).getReward(citizen1.address, citizen1.address)).to.be.revertedWith("DSQStaking: !router");
    });

    it("Should NOT exit if not router", async function () {
      await expect(dsqStaking.connect(citizen1).exit(citizen1.address)).to.be.revertedWith("DSQStaking: !router");
    });
  });

  describe("Admin", function () {
    it("Should notifyRewardAmount correctly", async function () {
      await expect(dsqStaking.connect(citizen1).notifyRewardAmount(6900)).to.be.revertedWith(
        "DSQStaking: Caller is not RewardsDistribution contract",
      );
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("60480"));
      expect(await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480")))
        .to.emit(dsqStaking, "RewardAdded")
        .withArgs(ethers.utils.parseEther("60480"));
      expect(await dsqStaking.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));
    });

    it("Should notifyRewardAmount correctly when before periodFinish", async function () {
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("120960"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      const periodFinish = await dsqStaking.periodFinish();

      const rewardRate = await dsqStaking.rewardRate();
      expect(rewardRate).to.eq(ethers.utils.parseEther("0.1"));

      await network.provider.send("evm_setNextBlockTimestamp", [periodFinish - 600]);
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));

      // Partial notifyRewardAmount math from else statement (line 121)
      leftover = rewardRate.mul(600);
      newRewardRate = ethers.utils
        .parseEther("60480")
        .add(leftover)
        .div(7 * 24 * 3600);

      expect(await dsqStaking.rewardRate()).to.eq(newRewardRate);
    });

    it("Should NOT set rewardRate higher than balance / rewardsDuration", async function () {
      await expect(dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"))).to.be.revertedWith(
        "DSQStaking: Provided reward too high",
      );
    });

    it("Should set rewards duration", async function () {
      expect(await dsqStaking.rewardsDuration()).to.eq(7 * 24 * 3600);

      await dsqStaking.connect(multisig).setRewardsDuration(69);

      expect(await dsqStaking.rewardsDuration()).to.eq(69);

      await expect(dsqStaking.connect(citizen1).setRewardsDuration(69)).to.be.revertedWith("Ownable:");
    });

    it("Should NOT set rewards duration during period", async function () {
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("120960"));
      await dsqStaking.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
      await expect(dsqStaking.connect(multisig).setRewardsDuration(0)).to.be.revertedWith(
        "DSQStaking: Previous rewards period must be complete before changing the duration for the new period",
      );
    });

    it("Should NOT set rewards duration to zero", async function () {
      expect(await dsqStaking.rewardsDuration()).to.eq(7 * 24 * 3600);

      await dsqStaking.connect(multisig).setRewardsDuration(69);

      await expect(dsqStaking.connect(multisig).setRewardsDuration(0)).to.be.revertedWith("DSQStaking: Zero duration");
    });

    it("Should set rewards distribution", async function () {
      expect(await dsqStaking.rewardsDistribution()).to.eq(treasury.address);

      await dsqStaking.connect(multisig).setRewardsDistribution(citizen1.address);

      expect(await dsqStaking.rewardsDistribution()).to.eq(citizen1.address);

      await expect(dsqStaking.connect(citizen1).setRewardsDistribution(citizen2.address)).to.be.revertedWith("Ownable:");
    });

    it("Should NOT set rewards distribution to zero address", async function () {
      await expect(dsqStaking.connect(multisig).setRewardsDistribution(ethers.constants.AddressZero)).to.be.revertedWith(
        "DSQStaking: Zero address",
      );
    });

    it("Should recover ERC20", async function () {
      await esdsq.connect(devWallet).mint(dsqStaking.address, ethers.utils.parseEther("1000"));
      expect(await esdsq.balanceOf(devWallet.address)).to.eq(0);

      await expect(dsqStaking.connect(multisig).recoverERC20(dsq.address, ethers.utils.parseEther("1000"))).to.be.reverted;
      await dsqStaking.connect(multisig).recoverERC20(esdsq.address, ethers.utils.parseEther("1000"));

      await expect(dsqStaking.connect(citizen1).recoverERC20(esdsq.address, ethers.utils.parseEther("1000"))).to.be.reverted;
      expect(await esdsq.balanceOf(multisig.address)).to.eq(ethers.utils.parseEther("1000"));
    });

    it("Should NOT setRouter if not owner", async function () {
      await expect(dsqStaking.connect(citizen1).setRouter(citizen1.address)).to.be.reverted;
    });

    it("Should setRouter", async function () {
      await expect(dsqStaking.connect(multisig).setRouter(router.address)).to.emit(dsqStaking, "NewRouter").withArgs(router.address);
    });

    it("Should NOT setRouter twice", async function () {
      await expect(dsqStaking.connect(multisig).setRouter(router.address)).to.emit(dsqStaking, "NewRouter").withArgs(router.address);
      await expect(dsqStaking.connect(multisig).setRouter(citizen1.address)).to.be.revertedWith("DSQStaking: Router is immutable");
    });
  });
});
