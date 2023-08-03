const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, multisig] = provider.getWallets();

// 1/20/2023 0:00:00 GMT
accumulationStart = 1674172800;

// 7/20/2023 0:00:00 GMT
otcUnlockTime = 1689811200;

// 1/20/2024 0:00:00 GMT
startTime = 1705708800;

// 7/20/2024 0:00:00 GMT
endTime = 1721433600;
duration = endTime - startTime;

wrongAccumulationStart = otcUnlockTime + 10;
wrongOtcUnlockTime = startTime + 10;

xdescribe("TeamVestingRevocable", function () {
  async function deployVestingRevocableFixture() {
    Vesting = await ethers.getContractFactory("TeamVestingRevocable");
    vesting = await Vesting.deploy(citizen1.address, accumulationStart, otcUnlockTime, startTime, duration, multisig.address);

    Test20 = await ethers.getContractFactory("TestFixture_ERC20");
    test20 = await Test20.deploy("Test20", "Test20");

    return { vesting, test20 };
  }

  describe("Base", function () {
    it("Should NOT construct if incorrect times", async function () {
      Vesting = await ethers.getContractFactory("TeamVestingRevocable");
      await expect(
        Vesting.deploy(citizen1.address, wrongAccumulationStart, otcUnlockTime, startTime, duration, multisig.address),
      ).to.be.revertedWith("params");
      await expect(
        Vesting.deploy(citizen1.address, accumulationStart, wrongOtcUnlockTime, startTime, duration, multisig.address),
      ).to.be.revertedWith("params");
    });

    it("Should set multisig, accumulationStart, otcUnlockTime", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      expect(await vesting.multisig()).to.eq(multisig.address);
      expect(await vesting.accumulationStart()).to.eq(accumulationStart);
      expect(await vesting.otcUnlockTime()).to.eq(otcUnlockTime);
    });

    it("Should calculate correctly", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("1572480")); // 0.1 full token per second
      expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime)).to.eq(0);
      expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime + 1)).to.eq(ethers.utils.parseEther(".1"));
      expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime + duration - 1)).to.eq(
        ethers.utils.parseEther("1572479.9"),
      );
      expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime + duration)).to.eq(ethers.utils.parseEther("1572480"));
      expect(await vesting["vestedAmount(address,uint64)"](test20.address, startTime + duration + 1)).to.eq(
        ethers.utils.parseEther("1572480"),
      );
    });

    it("Should operate vesting period correctly", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("1572480"));
      await provider.send("evm_setNextBlockTimestamp", [startTime + 300]);
      await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalance(
        test20,
        citizen1,
        ethers.utils.parseEther("30"),
      );
      await provider.send("evm_setNextBlockTimestamp", [startTime + duration - 1]);
      await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalance(
        test20,
        citizen1,
        ethers.utils.parseEther("1572449.9"),
      );
      await provider.send("evm_setNextBlockTimestamp", [startTime + duration]);
      await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalance(
        test20,
        citizen1,
        ethers.utils.parseEther(".1"),
      );
      expect(await test20.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("1572480"));
    });
  });

  describe("OTC", function () {
    it("Should OTC", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("1572480"));

      // 1572480 / 5 = 314496
      await provider.send("evm_setNextBlockTimestamp", [otcUnlockTime + 1]);
      await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(
        test20,
        [multisig, vesting],
        [ethers.utils.parseEther("314496"), ethers.utils.parseEther("-314496")],
      );

      // 1572480 - 314496 = 1257984
      await provider.send("evm_setNextBlockTimestamp", [startTime + duration]);
      await expect(() => vesting.connect(citizen1)["release(address)"](test20.address)).to.changeTokenBalances(
        test20,
        [citizen1, vesting],
        [ethers.utils.parseEther("1257984"), ethers.utils.parseEther("-1257984")],
      );
    });

    it("Should round OTC down", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      // 6 / 5 = 1.2
      await test20.mintTo(vesting.address, 6);

      await provider.send("evm_setNextBlockTimestamp", [otcUnlockTime + 1]);
      await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(test20, [multisig, vesting], [1, -1]);
    });

    it("Should NOT OTC before release point", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await provider.send("evm_setNextBlockTimestamp", [otcUnlockTime]);
      await expect(vesting.connect(citizen1).OTC(test20.address)).to.be.revertedWith("!ready");
    });

    it("Should NOT OTC when called by non beneficiary", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await provider.send("evm_setNextBlockTimestamp", [otcUnlockTime + 1]);
      await expect(vesting.connect(citizen2).OTC(test20.address)).to.be.revertedWith("!beneficiary");
    });

    it("Should NOT OTC twice", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      // 172800 / 5 = 34560
      await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));

      await provider.send("evm_setNextBlockTimestamp", [otcUnlockTime + 1]);
      await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(
        test20,
        [multisig, vesting],
        [ethers.utils.parseEther("34560"), ethers.utils.parseEther("-34560")],
      );
      await expect(vesting.connect(citizen1).OTC(test20.address)).to.be.revertedWith("executed");
    });
  });

  describe("Revoke", function () {
    it("Should NOT revoke if not multisig", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await expect(vesting.connect(citizen2).revoke(test20.address)).to.be.revertedWith("!multisig");
    });

    it("Should emit Revoked event", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("3153600")); // 0.1 full token accumulated per second
      // Set next block timestamp to 3/1/2023
      await provider.send("evm_setNextBlockTimestamp", [1677628800]);

      // 3153600 * (1677628800 - 1674172800) / (1705708800 - 1674172800) = 345600
      // 3153600 - 345600 = 2808000
      await expect(vesting.connect(multisig).revoke(test20.address))
        .to.emit(vesting, "Revoked")
        .withArgs(ethers.utils.parseEther("2808000"));
    });

    it("Should NOT revoke twice", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("3153600")); // 0.1 full token accumulated per second
      // Set next block timestamp to 3/1/2023
      await provider.send("evm_setNextBlockTimestamp", [1677628800]);

      // 3153600 * (1677628800 - 1674172800) / (1705708800 - 1674172800) = 345600
      // 3153600 - 345600 = 2808000
      await expect(vesting.connect(multisig).revoke(test20.address))
        .to.emit(vesting, "Revoked")
        .withArgs(ethers.utils.parseEther("2808000"));

      await expect(vesting.connect(multisig).revoke(test20.address)).to.be.revertedWith("revoked");
    });

    // Not possible because accumulation started 1/20/2023
    xit("Should revoke all tokens if before accumulationStart", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));

      await provider.send("evm_setNextBlockTimestamp", [accumulationStart - 1]);
      await expect(() => vesting.connect(multisig).revoke(test20.address)).to.changeTokenBalances(
        test20,
        [multisig, vesting],
        [ethers.utils.parseEther("172800"), ethers.utils.parseEther("-172800")],
      );

      await provider.send("evm_setNextBlockTimestamp", [startTime + duration]);
      await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalance(test20, citizen1, 0);
    });

    it("Should revoke half then release half", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));

      await provider.send("evm_setNextBlockTimestamp", [(accumulationStart + startTime) / 2]);
      await expect(() => vesting.connect(multisig).revoke(test20.address)).to.changeTokenBalances(
        test20,
        [multisig, vesting],
        [ethers.utils.parseEther("86400"), ethers.utils.parseEther("-86400")],
      );

      await provider.send("evm_setNextBlockTimestamp", [startTime + duration]);
      await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalances(
        test20,
        [citizen1, vesting],
        [ethers.utils.parseEther("86400"), ethers.utils.parseEther("-86400")],
      );
    });

    it("Should revoke zero tokens if after accumulation", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("172800"));

      await provider.send("evm_setNextBlockTimestamp", [startTime]);
      await expect(() => vesting.connect(multisig).revoke(test20.address)).to.changeTokenBalances(test20, [multisig, vesting], [0, 0]);

      await provider.send("evm_setNextBlockTimestamp", [startTime + duration + 1]);
      await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalances(
        test20,
        [citizen1, vesting],
        [ethers.utils.parseEther("172800"), ethers.utils.parseEther("-172800")],
      );
    });
  });

  describe("OTC + Revoke", function () {
    it("Should Revoke at 3/1/2023, OTC with 1/5 accumulated tokens, release 4/5 accumulated tokens at duration", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("3153600")); // 0.1 full token accumulated per second

      // Set next block timestamp to 3/1/2023
      await provider.send("evm_setNextBlockTimestamp", [1677628800]);
      // 3153600 * (1677628800 - 1674172800) / (1705708800 - 1674172800) = 345600
      // 3153600 - 345600 = 2808000
      await expect(vesting.connect(multisig).revoke(test20.address))
        .to.emit(vesting, "Revoked")
        .withArgs(ethers.utils.parseEther("2808000"));

      // OTC
      await provider.send("evm_setNextBlockTimestamp", [otcUnlockTime + 1]);
      // 345600 / 5 = 69120
      await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(
        test20,
        [multisig, vesting],
        [ethers.utils.parseEther("69120"), ethers.utils.parseEther("-69120")],
      );

      // Release
      await provider.send("evm_setNextBlockTimestamp", [startTime + duration]);
      // 345600 / 5 * 4 = 276480
      await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalances(
        test20,
        [citizen1, vesting],
        [ethers.utils.parseEther("276480"), ethers.utils.parseEther("-276480")],
      );
    });

    it("Should OTC at 7/1/2023, revoke at 8/1/2023, release accumulated value - otc at duration", async function () {
      const { vesting, test20 } = await loadFixture(deployVestingRevocableFixture);
      await test20.mintTo(vesting.address, ethers.utils.parseEther("3153600"));

      // OTC
      await provider.send("evm_setNextBlockTimestamp", [otcUnlockTime + 1]);
      // 3153600 / 5
      await expect(() => vesting.connect(citizen1).OTC(test20.address)).to.changeTokenBalances(
        test20,
        [multisig, vesting],
        [ethers.utils.parseEther("630720"), ethers.utils.parseEther("-630720")],
      );

      // revoke
      // Set next block timestamp to 8/1/2023
      await provider.send("evm_setNextBlockTimestamp", [1690848000]);
      // 3153600 * (1690848000 - 1674172800) / (1705708800 - 1674172800) = 1667520
      // 3153600 - 1667520 = 1486080
      await expect(() => vesting.connect(multisig).revoke(test20.address)).to.changeTokenBalances(
        test20,
        [multisig, vesting],
        [ethers.utils.parseEther("1486080"), ethers.utils.parseEther("-1486080")],
      );

      // Release 1667520 - 630720 = 1036800
      await provider.send("evm_setNextBlockTimestamp", [startTime + duration]);
      await expect(() => vesting["release(address)"](test20.address)).to.changeTokenBalances(
        test20,
        [citizen1, vesting],
        [ethers.utils.parseEther("1036800"), ethers.utils.parseEther("-1036800")],
      );
    });
  });
});
