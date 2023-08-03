const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { keccak256 } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5] = provider.getWallets();

const whitelisted = [citizen1, citizen2, citizen3, citizen4, citizen5];

const leaves = whitelisted.map(account => keccak256(account.address));
const tree = new MerkleTree(leaves, keccak256, { sort: true });
const merkleRoot = tree.getHexRoot();

const merkleProof = tree.getHexProof(keccak256(whitelisted[0].address));
const merkleProof2 = tree.getHexProof(keccak256(whitelisted[1].address));
const merkleProof3 = tree.getHexProof(keccak256(whitelisted[2].address));

const PRIVATE_CONTRIBUTION_ADDRESS = "0xA28351C8F8Ae1Ac0748f47F5F3A791E809815207";

describe("Airdrop", function () {
  async function deployAirdropFixture() {
    timestamp = (await ethers.provider.getBlock()).timestamp;
    startTime = timestamp + 100;
    endTime = startTime + 5 * 24 * 3600;

    Contribution = await ethers.getContractFactory("PrivateContribution");
    contribution = await Contribution.deploy(devWallet.address, startTime, endTime);
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);

    Airdrop = await ethers.getContractFactory("Airdrop");
    airdrop = await Airdrop.deploy(contribution.address);

    return { airdrop };
  }

  async function deployTestAirdropFixture() {
    timestamp = (await ethers.provider.getBlock()).timestamp;
    startTime = timestamp + 100;
    endTime = startTime + 5 * 24 * 3600;

    Contribution = await ethers.getContractFactory("PrivateContribution");
    contribution = await Contribution.deploy(devWallet.address, startTime, endTime);
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);

    Airdrop = await ethers.getContractFactory("TestFixture_Airdrop");
    airdrop = await Airdrop.deploy(contribution.address);

    return { airdrop };
  }

  describe("Construction", function () {
    beforeEach(async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);
    });

    it("Should construct", async function () {
      expect(await airdrop.privateContribution()).to.eq(contribution.address);
    });
  });

  describe("Airdrop", function () {
    beforeEach(async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);
    });

    it("Should NOT airdrop if not owner", async function () {
      await expect(airdrop.connect(citizen1).airdrop(Math.floor(Math.random() * 10))).to.be.reverted;
    });

    it("Should NOT airdrop if sale is active", async function () {
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10))).to.be.revertedWith("!ready");
    });

    it("Should NOT airdrop with no contributions", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10))).to.be.revertedWith("!entries");
    });

    it("Should NOT airdrop with no contributions within last 24 hours", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime]);
      expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10))).to.be.revertedWith("!entries");
    });

    it("Should airdrop with one contribution", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10)))
        .to.emit(airdrop, "Winner")
        .withArgs(citizen1.address);
    });

    it("Should set winner", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10)))
        .to.emit(airdrop, "Winner")
        .withArgs(citizen1.address);
      expect(await airdrop.winner()).to.eq(citizen1.address);
    });

    it("Should emit Winner event", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10)))
        .to.emit(airdrop, "Winner")
        .withArgs(citizen1.address);
    });

    it("Should airdrop with two contributions", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 2]);
      expect(await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10))).to.emit(airdrop, "Winner");
    });

    it("Should airdrop with three contributions", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 3]);
      expect(await contribution.connect(citizen3).contribute(merkleProof3, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 2]);
      expect(await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
        contribution,
        "Contributed",
      );

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10))).to.emit(airdrop, "Winner");
    });

    it("Should NOT run raffle more than once", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10));
      await expect(airdrop.connect(devWallet).airdrop(Math.floor(Math.random() * 10))).to.be.revertedWith("raffle completed");
    });
  });

  describe("Winners", function () {
    beforeEach(async function () {
      const { airdrop } = await loadFixture(deployTestAirdropFixture);
    });

    it("Should pick winner with 1 contributor (low random number)", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(0)).to.emit(airdrop, "Winner").withArgs(citizen1.address);
    });

    it("Should pick winner with 1 contributor (high random number)", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(ethers.utils.parseEther("10").sub(1)))
        .to.emit(airdrop, "Winner")
        .withArgs(citizen1.address);
    });

    it("Should pick winner with 2 contributors", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 2]);
      await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(0)).to.emit(airdrop, "Winner").withArgs(citizen1.address);
    });

    it("Should pick winner with 2 contributors, parseEther(10).sub(1)", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 2]);
      await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(ethers.utils.parseEther("10").sub(1)))
        .to.emit(airdrop, "Winner")
        .withArgs(citizen1.address);
    });

    it("Should pick winner with 2 contributors, parseEther(10)", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 2]);
      await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(ethers.utils.parseEther("10")))
        .to.emit(airdrop, "Winner")
        .withArgs(citizen2.address);
    });

    it("Should pick winner with 2 contributors, parseEther(20).sub(1)", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 2]);
      await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(ethers.utils.parseEther("20").sub(1)))
        .to.emit(airdrop, "Winner")
        .withArgs(citizen2.address);
    });

    // Run this just to see winning address console logged
    it("Sanity Check", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 3]);
      await contribution.connect(citizen3).contribute(merkleProof3, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 2]);
      await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await expect(airdrop.connect(devWallet).airdrop(0)).to.emit(airdrop, "Winner");
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
    });
  });

  xdescribe("Fork Tests", function () {
    it("Should run Airdrop", async function () {
      Airdrop = await ethers.getContractFactory("Airdrop");
      airdrop = await Airdrop.deploy(PRIVATE_CONTRIBUTION_ADDRESS);

      await airdrop.connect(devWallet).airdrop(42069);
      console.log(await airdrop.winner());
    });

    xit("Should run TestFixture_Airdrop", async function () {
      Airdrop = await ethers.getContractFactory("TestFixture_Airdrop");
      airdrop = await Airdrop.deploy(PRIVATE_CONTRIBUTION_ADDRESS);

      await airdrop.connect(devWallet).airdrop(42069);
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
      await airdrop.connect(devWallet).test_runAgain();
    });
  });
});
