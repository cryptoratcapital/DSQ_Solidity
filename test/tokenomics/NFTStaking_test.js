const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, treasury] = provider.getWallets();

/* eslint-disable mocha/no-skipped-tests */
xdescribe("NFTStaking", function () {
  beforeEach(async function () {
    DSQ = await ethers.getContractFactory("DSQToken");
    dsq = await DSQ.deploy(treasury.address, ethers.utils.parseEther("500000"));

    Test721 = await ethers.getContractFactory("TestFixture_ERC721");
    genesis = await Test721.deploy("Dopex Genesis", "DPG", "testURI");
    normal = await Test721.deploy("Dopex normal", "DPN", "testURI");

    Staker = await ethers.getContractFactory("NFTStaking");
    staker = await Staker.deploy(devWallet.address, treasury.address, dsq.address, genesis.address, normal.address);

    await genesis.connect(devWallet).mintTo(citizen1.address);
    await normal.connect(devWallet).mintTo(citizen1.address);
  });

  it("Should construct correctly", async function () {
    expect(await staker.owner()).to.eq(devWallet.address);
    expect(await staker.rewardsToken()).to.eq(dsq.address);
    expect(await staker.stakingToken1()).to.eq(genesis.address);
    expect(await staker.stakingToken2()).to.eq(normal.address);
    expect(await staker.rewardsDistribution()).to.eq(treasury.address);
  });

  it("Should NOT deploy with zero addresses", async function () {
    await expect(
      Staker.deploy(ethers.constants.AddressZero, treasury.address, dsq.address, genesis.address, normal.address),
    ).to.be.revertedWith("Zero address");
    await expect(
      Staker.deploy(devWallet.address, treasury.address, ethers.constants.AddressZero, genesis.address, normal.address),
    ).to.be.revertedWith("Zero address");
    await expect(
      Staker.deploy(devWallet.address, treasury.address, dsq.address, ethers.constants.AddressZero, normal.address),
    ).to.be.revertedWith("Zero address");
    await expect(
      Staker.deploy(devWallet.address, treasury.address, dsq.address, genesis.address, ethers.constants.AddressZero),
    ).to.be.revertedWith("Zero address");
  });

  it("Should notifyRewardAmount correctly", async function () {
    await expect(staker.connect(citizen1).notifyRewardAmount(6900)).to.be.revertedWith("Caller is not RewardsDistribution contract");
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    expect(await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480")))
      .to.emit(staker, "RewardAdded")
      .withArgs(ethers.utils.parseEther("60480"));
    expect(await staker.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));
  });

  it("Should notifyRewardAmount correctly when before periodFinish", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("120960"));
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
    const periodFinish = await staker.periodFinish();

    const rewardRate = await staker.rewardRate();
    expect(rewardRate).to.eq(ethers.utils.parseEther("0.1"));

    await network.provider.send("evm_setNextBlockTimestamp", [periodFinish - 600]);
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));

    // Partial notifyRewardAmount math from else statement (line 195)
    leftover = rewardRate.mul(600);
    newRewardRate = ethers.utils
      .parseEther("60480")
      .add(leftover)
      .div(7 * 24 * 3600);

    expect(await staker.rewardRate()).to.eq(newRewardRate);
  });

  it("Genesis - Should stake, unstake, and accrue rewards", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
    expect(await staker.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

    await genesis.connect(citizen1).approve(staker.address, 1);
    expect(await staker.connect(citizen1).stake(1, true))
      .to.emit(staker, "Staked")
      .withArgs(citizen1.address, 1, genesis.address, ethers.utils.parseEther("6"));

    expect(await staker.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("6"));
    expect(await staker.totalSupply()).to.eq(ethers.utils.parseEther("6"));
    expect(await staker.userRewardPerTokenPaid(citizen1.address)).to.eq(0);

    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    expect(await staker.earned(citizen1.address)).to.be.closeTo(ethers.utils.parseEther("10"), 10);
    expect(await staker.connect(citizen1).exit([1], [true]))
      .to.emit(staker, "RewardPaid")
      .withArgs(citizen1.address, ethers.utils.parseEther("10.099999999999999998"));

    expect(await genesis.balanceOf(citizen1.address)).to.eq(1);
    expect(await dsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("10.099999999999999998"));
  });

  it("Normal - Should stake, unstake, and accrue rewards", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
    expect(await staker.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

    await normal.connect(citizen1).approve(staker.address, 1);
    expect(await staker.connect(citizen1).stake(1, false))
      .to.emit(staker, "Staked")
      .withArgs(citizen1.address, 1, normal.address, ethers.utils.parseEther("3"));

    expect(await staker.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("3"));
    expect(await staker.totalSupply()).to.eq(ethers.utils.parseEther("3"));

    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    expect(await staker.earned(citizen1.address)).to.be.closeTo(ethers.utils.parseEther("10"), 10);
    expect(await staker.connect(citizen1).exit([1], [false]))
      .to.emit(staker, "RewardPaid")
      .withArgs(citizen1.address, ethers.utils.parseEther("10.099999999999999998"));

    expect(await normal.balanceOf(citizen1.address)).to.eq(1);
    expect(await dsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("10.099999999999999998"));
  });

  it("Normal/Genesis - Should stake multiple with one of each token", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
    expect(await staker.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

    await normal.connect(citizen1).approve(staker.address, 1);
    await genesis.connect(citizen1).approve(staker.address, 1);

    expect(await staker.connect(citizen1).stakeMultiple([1, 1], [true, false]))
      .to.emit(staker, "Staked")
      .withArgs(citizen1.address, 1, normal.address, ethers.utils.parseEther("3"))
      .to.emit(staker, "Staked")
      .withArgs(citizen1.address, 1, genesis.address, ethers.utils.parseEther("6"));

    expect(await staker.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("9"));
    expect(await staker.totalSupply()).to.eq(ethers.utils.parseEther("9"));
  });

  it("Should NOT stake or unstake incorrectly", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
    expect(await staker.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

    // Mint to make token 2 existent for this test
    await normal.connect(devWallet).mintTo(devWallet.address);
    await normal.connect(citizen1).approve(staker.address, 1);
    await expect(staker.connect(citizen1).stake(2, false)).to.be.revertedWith("ERC721: caller is not token owner or approved");

    await staker.connect(citizen1).stake(1, false);

    await expect(staker.connect(citizen1).exit([1], [true])).to.be.revertedWith("Not depositor of that token");

    await expect(staker.connect(citizen1).exit([2], [false])).to.be.revertedWith("Not depositor of that token");

    await expect(staker.connect(citizen2).exit([1], [false])).to.be.revertedWith("Not depositor of that token");
  });

  it("Should stake, unstake, and accrue rewards for multiple users", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
    expect(await staker.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

    await genesis.connect(devWallet).mintTo(citizen2.address);
    await genesis.connect(devWallet).mintTo(citizen3.address);
    await genesis.connect(citizen1).approve(staker.address, 1);
    await genesis.connect(citizen2).approve(staker.address, 2);
    await genesis.connect(citizen3).approve(staker.address, 3);

    await normal.connect(devWallet).mintTo(citizen2.address);
    await normal.connect(devWallet).mintTo(citizen3.address);
    await normal.connect(citizen1).approve(staker.address, 1);
    await normal.connect(citizen2).approve(staker.address, 2);
    await normal.connect(citizen3).approve(staker.address, 3);

    // From t = 0 to t = 100 blocks, only Citizen 1
    expect(await staker.connect(citizen3).stake(3, false))
      .to.emit(staker, "Staked")
      .withArgs(citizen3.address, 3, normal.address, ethers.utils.parseEther("3"));

    expect(await staker.balanceOf(citizen3.address)).to.eq(ethers.utils.parseEther("3"));

    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    expect(await staker.earned(citizen3.address)).to.be.closeTo(ethers.utils.parseEther("10"), 10);

    // From t = 101 to t = 200 blocks, citizen 1 and citizen 2
    expect(await staker.connect(citizen2).stake(2, false))
      .to.emit(staker, "Staked")
      .withArgs(citizen2.address, 2, normal.address, ethers.utils.parseEther("3"));

    expect(await staker.balanceOf(citizen2.address)).to.eq(ethers.utils.parseEther("3"));

    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    expect(await staker.earned(citizen3.address)).to.be.closeTo(ethers.utils.parseEther("15.1"), 10);
    expect(await staker.earned(citizen2.address)).to.be.closeTo(ethers.utils.parseEther("5"), 10);

    // From t = 201 to t = 300 blocks, all 3 staking
    expect(await staker.connect(citizen1).stake(1, true))
      .to.emit(staker, "Staked")
      .withArgs(citizen1.address, 1, genesis.address, ethers.utils.parseEther("6"));

    expect(await staker.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("6"));

    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    expect(await staker.earned(citizen3.address)).to.be.closeTo(ethers.utils.parseEther("17.65"), 10);
    expect(await staker.earned(citizen2.address)).to.be.closeTo(ethers.utils.parseEther("7.55"), 10);
    expect(await staker.earned(citizen1.address)).to.be.closeTo(ethers.utils.parseEther("5"), 10);

    // Cash out all and check balances
    expect(await staker.connect(citizen3).exit([3], [false]))
      .to.emit(staker, "RewardPaid")
      .withArgs(citizen3.address, ethers.utils.parseEther("17.674999999999999995"));

    expect(await normal.balanceOf(citizen3.address)).to.eq(1);
    expect(await dsq.balanceOf(citizen3.address)).to.be.closeTo(ethers.utils.parseEther("17.675"), 10);

    expect(await staker.connect(citizen2).exit([2], [false]))
      .to.emit(staker, "RewardPaid")
      .withArgs(citizen2.address, ethers.utils.parseEther("7.608333333333333330"));

    expect(await normal.balanceOf(citizen2.address)).to.eq(1);
    expect(await dsq.balanceOf(citizen2.address)).to.be.closeTo(ethers.utils.parseEther("7.608333333333333333"), 10);

    expect(await staker.connect(citizen1).exit([1], [true]))
      .to.emit(staker, "RewardPaid")
      .withArgs(citizen1.address, ethers.utils.parseEther("5.216666666666666658"));

    expect(await genesis.balanceOf(citizen1.address)).to.eq(1);
    expect(await dsq.balanceOf(citizen1.address)).to.be.closeTo(ethers.utils.parseEther("5.216666666666666658"), 10);
  });

  it("Genesis - Should get correct weighted amounts", async function () {
    expect(await staker.getWeightedAmount(2, true)).to.eq(ethers.utils.parseEther("6"));
    expect(await staker.getWeightedAmount(12, true)).to.eq(ethers.utils.parseEther("5"));
    expect(await staker.getWeightedAmount(32, true)).to.eq(ethers.utils.parseEther("4"));
  });

  it("Normal - Should get correct weighted amounts", async function () {
    expect(await staker.getWeightedAmount(10, false)).to.eq(ethers.utils.parseEther("3"));
    expect(await staker.getWeightedAmount(190, false)).to.eq(ethers.utils.parseEther("2"));
    expect(await staker.getWeightedAmount(2190, false)).to.eq(ethers.utils.parseEther("1"));
  });

  it("Should not give rewards or withdraw tokens if user has no balance", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));
    expect(await staker.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

    await expect(staker.connect(citizen1).withdraw(1, false)).to.be.revertedWith("Not depositor of that token");

    await expect(staker.connect(citizen1).exit([1], [false])).to.be.revertedWith("Not depositor of that token");

    expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    await staker.connect(citizen1).getReward();
    expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
  });

  it("Should set token weights", async function () {
    expect(await staker.GENESIS_LEGENDARY_WEIGHT()).to.eq(ethers.utils.parseEther("6"));
    expect(await staker.GENESIS_RARE_WEIGHT()).to.eq(ethers.utils.parseEther("5"));
    expect(await staker.GENESIS_UNCOMMON_WEIGHT()).to.eq(ethers.utils.parseEther("4"));
    expect(await staker.NORMAL_RARE_WEIGHT()).to.eq(ethers.utils.parseEther("3"));
    expect(await staker.NORMAL_UNCOMMON_WEIGHT()).to.eq(ethers.utils.parseEther("2"));
    expect(await staker.NORMAL_COMMON_WEIGHT()).to.eq(ethers.utils.parseEther("1"));

    weights = [
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
    ];

    await staker.connect(devWallet).setTokenWeights(weights);

    expect(await staker.GENESIS_LEGENDARY_WEIGHT()).to.eq(ethers.utils.parseEther("6.9"));
    expect(await staker.GENESIS_RARE_WEIGHT()).to.eq(ethers.utils.parseEther("6.9"));
    expect(await staker.GENESIS_UNCOMMON_WEIGHT()).to.eq(ethers.utils.parseEther("6.9"));
    expect(await staker.NORMAL_RARE_WEIGHT()).to.eq(ethers.utils.parseEther("6.9"));
    expect(await staker.NORMAL_UNCOMMON_WEIGHT()).to.eq(ethers.utils.parseEther("6.9"));
    expect(await staker.NORMAL_COMMON_WEIGHT()).to.eq(ethers.utils.parseEther("6.9"));

    await expect(staker.connect(citizen1).setTokenWeights([weights])).to.be.reverted;
    await expect(staker.connect(devWallet).setTokenWeights([1, 1, 1, 1, 1])).to.be.reverted;
  });

  it("Should NOT set token weights out of order", async function () {
    weights = [
      ethers.utils.parseEther("1"),
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
      ethers.utils.parseEther("6.9"),
    ];

    await expect(staker.connect(devWallet).setTokenWeights(weights)).to.be.revertedWith("Invalid weight");
  });

  it("Should set rewards duration", async function () {
    expect(await staker.rewardsDuration()).to.eq(7 * 24 * 3600);

    await staker.connect(devWallet).setRewardsDuration(69);

    expect(await staker.rewardsDuration()).to.eq(69);

    await expect(staker.connect(devWallet).setRewardsDuration(0)).to.be.revertedWith("Zero duration");
    await expect(staker.connect(citizen1).setRewardsDuration(69)).to.be.revertedWith("Ownable:");
  });

  it("Should get reward for duration", async function () {
    expect(await staker.getRewardForDuration()).to.eq(0);

    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    expect(await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480")))
      .to.emit(staker, "RewardAdded")
      .withArgs(ethers.utils.parseEther("60480"));
    expect(await staker.rewardRate()).to.eq(ethers.utils.parseEther("0.1"));

    expect(await staker.getRewardForDuration()).to.eq(ethers.utils.parseEther("60480"));
  });

  it("Should set rewards distribution", async function () {
    expect(await staker.rewardsDistribution()).to.eq(treasury.address);

    await staker.connect(devWallet).setRewardsDistribution(citizen1.address);

    expect(await staker.rewardsDistribution()).to.eq(citizen1.address);

    await expect(staker.connect(devWallet).setRewardsDistribution(ethers.constants.AddressZero)).to.be.revertedWith("Zero address");
    await expect(staker.connect(citizen1).setRewardsDistribution(citizen2.address)).to.be.revertedWith("Ownable:");
  });

  it("Should recover ERC20", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("1000"));
    expect(await dsq.balanceOf(devWallet.address)).to.eq(0);

    await staker.connect(devWallet).recoverERC20(dsq.address, ethers.utils.parseEther("1000"));

    await expect(staker.connect(citizen1).recoverERC20(dsq.address, ethers.utils.parseEther("1000"))).to.be.reverted;
    expect(await dsq.balanceOf(devWallet.address)).to.eq(ethers.utils.parseEther("1000"));
  });

  it("Should recover ERC721", async function () {
    nonstakingToken = await Test721.deploy("TestName", "TestSymbol", "TestUri");

    await nonstakingToken.connect(devWallet).mintTo(staker.address);
    expect(await nonstakingToken.balanceOf(staker.address)).to.eq(1);

    await expect(staker.connect(devWallet).recoverERC721(dsq.address, 1)).to.be.reverted;
    await expect(staker.connect(devWallet).recoverERC721(genesis.address, 1)).to.be.reverted;
    await expect(staker.connect(devWallet).recoverERC721(normal.address, 1)).to.be.reverted;
    await expect(staker.connect(citizen1).recoverERC721(nonstakingToken.address, 1)).to.be.reverted;
    await staker.connect(devWallet).recoverERC721(nonstakingToken.address, 1);
    expect(await nonstakingToken.balanceOf(devWallet.address)).to.eq(1);
  });

  it("Should pause and unpause", async function () {
    expect(await staker.paused()).to.eq(false);
    await staker.setPaused(true);
    expect(await staker.paused()).to.eq(true);
    await staker.setPaused(false);
    expect(await staker.paused()).to.eq(false);
  });

  it("Should NOT stake when paused", async function () {
    await dsq.connect(treasury).transfer(staker.address, ethers.utils.parseEther("60480"));
    await staker.connect(treasury).notifyRewardAmount(ethers.utils.parseEther("60480"));

    await genesis.connect(citizen1).approve(staker.address, 1);
    await staker.setPaused(true);
    await expect(staker.connect(citizen1).stake(1, true)).to.be.revertedWith("Pausable:");
  });
});
