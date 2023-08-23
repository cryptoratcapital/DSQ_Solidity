const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, multisig] = provider.getWallets();

/* eslint-disable mocha/no-skipped-tests */
xdescribe("ContributorVesting", function () {
  beforeEach(async function () {
    timestamp = (await ethers.provider.getBlock()).timestamp;
    startTime = timestamp + 100;
    duration = 20 * 24 * 3600;
    unlockTime = startTime + 10 * 24 * 3600;

    Vesting = await ethers.getContractFactory("ContributorVesting");
    vesting = await Vesting.deploy(citizen1.address, startTime, duration, multisig.address);

    Test20 = await ethers.getContractFactory("TestFixture_ERC20");
    test20 = await Test20.deploy("Test20", "Test20");
  });

  it("Should set multisig", async function () {
    expect(await vesting.multisig()).to.eq(multisig.address);
  });

  it("Should calculate correctly", async function () {
    await test20.mintTo(vesting.address, ethers.utils.parseEther("172800")); // 0.1 full token per second
    expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime + 1)).to.eq(0);
    expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime + duration - 1)).to.eq(0);
    expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime + duration)).to.eq(ethers.utils.parseEther("172800"));
    expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime + duration + 1)).to.eq(
      ethers.utils.parseEther("172800"),
    );
  });

  it("Should operate vesting period correctly", async function () {
    await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));
    await provider.send("evm_setNextBlockTimestamp", [startTime + 300]);
    await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalance(test20, citizen1, 0);
    await provider.send("evm_setNextBlockTimestamp", [startTime + duration]);
    await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalance(
      test20,
      citizen1,
      ethers.utils.parseEther("172800"),
    );
    expect(await test20.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("172800"));
  });

  it("Should calculate unlockTime correctly (always set to round down)", async function () {
    expect(await vesting.otcUnlockTime()).to.eq(unlockTime);
  });

  it("Should OTC", async function () {
    // 172800 / 5 = 34560
    await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));

    await provider.send("evm_setNextBlockTimestamp", [unlockTime + 1]);
    await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(
      test20,
      [multisig, vesting],
      [ethers.utils.parseEther("34560"), ethers.utils.parseEther("-34560")],
    );
  });

  it("Should emit OTC event", async function () {
    // 172800 / 5 = 34560
    await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));

    await provider.send("evm_setNextBlockTimestamp", [unlockTime + 1]);
    await expect(vesting.connect(citizen1).OTC(test20.address)).to.emit(vesting, "OTCSent").withArgs(ethers.utils.parseEther("34560"));
  });

  it("Should OTC then release", async function () {
    // 172800 / 5 = 34560
    await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));

    await provider.send("evm_setNextBlockTimestamp", [unlockTime + 1]);
    await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(
      test20,
      [multisig, vesting],
      [ethers.utils.parseEther("34560"), ethers.utils.parseEther("-34560")],
    );

    await provider.send("evm_setNextBlockTimestamp", [startTime + duration]);
    // 172800 - 34560 = 138240
    await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalance(
      test20,
      citizen1,
      ethers.utils.parseEther("138240"),
    );
    expect(await test20.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("138240"));
    expect(await test20.balanceOf(vesting.address)).to.eq(0);
  });

  it("Should round OTC down", async function () {
    // 6 / 5 = 1.2
    await test20.mintTo(vesting.address, 6);

    await provider.send("evm_setNextBlockTimestamp", [unlockTime + 1]);
    await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(test20, [multisig, vesting], [1, -1]);
  });

  it("Should NOT OTC before release point", async function () {
    await provider.send("evm_setNextBlockTimestamp", [unlockTime]);
    await expect(vesting.connect(citizen1).OTC(test20.address)).to.be.revertedWith("!ready");
  });

  it("Should NOT OTC when called by non beneficiary", async function () {
    await provider.send("evm_setNextBlockTimestamp", [unlockTime + 1]);
    await expect(vesting.connect(citizen2).OTC(test20.address)).to.be.revertedWith("!beneficiary");
  });

  it("Should NOT OTC twice", async function () {
    // 172800 / 5 = 34560
    await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));

    await provider.send("evm_setNextBlockTimestamp", [unlockTime + 1]);
    await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(
      test20,
      [multisig, vesting],
      [ethers.utils.parseEther("34560"), ethers.utils.parseEther("-34560")],
    );
    await expect(vesting.connect(citizen1).OTC(test20.address)).to.be.revertedWith("executed");
  });
});
