const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { keccak256 } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5] = provider.getWallets();

const whitelisted = [citizen1, citizen2];
const notWhitelisted = [citizen3, citizen4, citizen5];

const leaves = whitelisted.map(account => keccak256(account.address));
const tree = new MerkleTree(leaves, keccak256, { sort: true });
const merkleRoot = tree.getHexRoot();

const merkleProof = tree.getHexProof(keccak256(whitelisted[0].address));
const merkleProof2 = tree.getHexProof(keccak256(whitelisted[1].address));
const invalidMerkleProof = tree.getHexProof(keccak256(notWhitelisted[0].address));

describe("PrivateContribution", function () {
  beforeEach(async function () {
    timestamp = (await ethers.provider.getBlock()).timestamp;
    startTime = timestamp + 100;
    endTime = startTime + 5 * 24 * 3600;

    Contribution = await ethers.getContractFactory("PrivateContribution");
    contribution = await Contribution.deploy(devWallet.address, startTime, endTime);
  });

  it("Should construct correctly", async function () {
    expect(await contribution.owner()).to.eq(devWallet.address);
    expect(await contribution.startTime()).to.eq(startTime);
    expect(await contribution.endTime()).to.eq(endTime);
  });

  it("Should set merkle root", async function () {
    prevRoot = await contribution.merkleRoot();

    await expect(contribution.connect(citizen1).setMerkleRoot(merkleRoot)).to.be.reverted;
    expect(await contribution.connect(devWallet).setMerkleRoot(merkleRoot))
      .to.emit(contribution, "NewMerkleRoot")
      .withArgs(prevRoot, merkleRoot);

    expect(await contribution.merkleRoot()).to.eq(merkleRoot);
  });

  it("Should set minContribution", async function () {
    expect(await contribution.minContribution()).to.eq(ethers.utils.parseEther("10"));

    await expect(contribution.connect(citizen1).setMinContribution(ethers.utils.parseEther("8"))).to.be.reverted;
    expect(await contribution.connect(devWallet).setMinContribution(ethers.utils.parseEther("8")))
      .to.emit(contribution, "NewMinContribution")
      .withArgs(ethers.utils.parseEther("10"), ethers.utils.parseEther("8"));

    expect(await contribution.minContribution()).to.eq(ethers.utils.parseEther("8"));
  });

  it("Should set maxContributions", async function () {
    expect(await contribution.maxContributions()).to.eq(ethers.utils.parseEther("250"));

    await expect(contribution.connect(citizen1).setMaxContributions(ethers.utils.parseEther("8"))).to.be.reverted;
    expect(await contribution.connect(devWallet).setMaxContributions(ethers.utils.parseEther("50")))
      .to.emit(contribution, "NewMaxContributions")
      .withArgs(ethers.utils.parseEther("250"), ethers.utils.parseEther("50"));

    expect(await contribution.maxContributions()).to.eq(ethers.utils.parseEther("50"));
  });

  it("Should set startTime", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime - 5]);

    // Start time in the past
    await expect(contribution.connect(devWallet).setStartTime(startTime - 10)).to.be.revertedWith("Timing");

    expect(await contribution.connect(devWallet).setStartTime(startTime + 10))
      .to.emit(contribution, "NewStartTime")
      .withArgs(startTime, startTime + 10);

    // Already started
    await network.provider.send("evm_setNextBlockTimestamp", [startTime + 10]);
    await expect(contribution.connect(devWallet).setStartTime(startTime + 10)).to.be.revertedWith("Timing");
  });

  it("Should set endTime", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);

    // End time before start time
    await expect(contribution.connect(devWallet).setEndTime(startTime - 10)).to.be.revertedWith("Timing");

    expect(await contribution.connect(devWallet).setEndTime(endTime - 10))
      .to.emit(contribution, "NewEndTime")
      .withArgs(endTime, endTime - 10);

    // Already ended
    await network.provider.send("evm_setNextBlockTimestamp", [endTime - 10]);
    await expect(contribution.connect(devWallet).setEndTime(endTime)).to.be.revertedWith("Timing");
  });

  it("Should only accept whitelisted contributers", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
      contribution,
      "Contributed",
    );

    await expect(
      contribution.connect(citizen2).contribute(invalidMerkleProof, { value: ethers.utils.parseEther("10") }),
    ).to.be.revertedWith("Proof");
  });

  it("Should revert if contribution is before startTime", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await expect(contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.be.revertedWith(
      "Not currently accepting contributions",
    );
  });

  it("Should accept contributions after startTime and before endTime", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);

    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);
    expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
      contribution,
      "Contributed",
    );

    await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
    expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
      contribution,
      "Contributed",
    );
  });

  it("Should revert if contribution after endTime", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [endTime]);

    await expect(contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.be.revertedWith(
      "Not currently accepting contributions",
    );
  });

  it("Should revert if merkle root not initiated", async function () {
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);
    await expect(contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.be.revertedWith(
      "Merkle root not initiated",
    );

    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") })).to.emit(
      contribution,
      "Contributed",
    );
  });

  it("Should revert if less than min contribution", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    await expect(contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("8") })).to.be.revertedWith(
      "Amount",
    );
  });

  it("Should revert if greater than max contributions", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    await expect(contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("1001") })).to.be.revertedWith(
      "Exceeds max contributions",
    );

    expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("249") })).to.emit(
      contribution,
      "Contributed",
    );
    await expect(contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("13") })).to.be.revertedWith(
      "Exceeds max contributions",
    );
  });

  it("Should count user contributions", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });
    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });
    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });
    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

    expect(await contribution.userToNumberOfContributions(citizen1.address)).to.eq(4);
  });

  it("Should sum contributions", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    expect(await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") }))
      .to.emit(contribution, "Contributed")
      .withArgs(citizen1.address, ethers.utils.parseEther("10"))
      .to.changeEtherBalance(citizen1, ethers.utils.parseEther("-10"))
      .to.changeEtherBalance(contribution, ethers.utils.parseEther("10"));

    expect(await contribution.totalContributions()).to.eq(ethers.utils.parseEther("10"));
    expect(await contribution.userToContributionTotal(citizen1.address)).to.eq(ethers.utils.parseEther("10"));

    expect(await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("20") }))
      .to.emit(contribution, "Contributed")
      .withArgs(citizen2.address, ethers.utils.parseEther("20"))
      .to.changeEtherBalance(citizen2, ethers.utils.parseEther("-20"))
      .to.changeEtherBalance(contribution, ethers.utils.parseEther("20"));

    expect(await contribution.totalContributions()).to.eq(ethers.utils.parseEther("30"));
    expect(await contribution.userToContributionTotal(citizen2.address)).to.eq(ethers.utils.parseEther("20"));
  });

  it("Should store contribution details", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

    timestamp = (await ethers.provider.getBlock()).timestamp;
    myContribution = await contribution.contributions(0);
    expect(myContribution.amount).to.eq(ethers.utils.parseEther("10"));
    expect(myContribution.contributer).to.eq(citizen1.address);
    expect(myContribution.timestamp).to.eq(timestamp);

    await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("20") });

    timestamp = (await ethers.provider.getBlock()).timestamp;
    myContribution = await contribution.contributions(1);
    expect(myContribution.amount).to.eq(ethers.utils.parseEther("20"));
    expect(myContribution.contributer).to.eq(citizen2.address);
    expect(myContribution.timestamp).to.eq(timestamp);
  });

  it("Should get contribution details by user", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });
    timestamp1 = (await ethers.provider.getBlock()).timestamp;

    await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("10") });
    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("20") });
    timestamp2 = (await ethers.provider.getBlock()).timestamp;

    contributions = await contribution.getContributionsByUser(citizen1.address);
    expect(contributions.length).to.eq(2);
    expect(contributions[0].contributer).to.eq(citizen1.address);
    expect(contributions[0].amount).to.eq(ethers.utils.parseEther("10"));
    expect(contributions[0].timestamp).to.eq(timestamp1);
    expect(contributions[1].contributer).to.eq(citizen1.address);
    expect(contributions[1].amount).to.eq(ethers.utils.parseEther("20"));
    expect(contributions[1].timestamp).to.eq(timestamp2);
  });

  it("Should get all contributions", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });
    timestamp1 = (await ethers.provider.getBlock()).timestamp;
    await contribution.connect(citizen2).contribute(merkleProof2, { value: ethers.utils.parseEther("20") });
    timestamp2 = (await ethers.provider.getBlock()).timestamp;
    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("30") });
    timestamp3 = (await ethers.provider.getBlock()).timestamp;

    contributions = await contribution.getAllContributions();
    expect(contributions.length).to.eq(3);
    expect(contributions[0].contributer).to.eq(citizen1.address);
    expect(contributions[0].amount).to.eq(ethers.utils.parseEther("10"));
    expect(contributions[0].timestamp).to.eq(timestamp1);
    expect(contributions[1].contributer).to.eq(citizen2.address);
    expect(contributions[1].amount).to.eq(ethers.utils.parseEther("20"));
    expect(contributions[1].timestamp).to.eq(timestamp2);
    expect(contributions[2].contributer).to.eq(citizen1.address);
    expect(contributions[2].amount).to.eq(ethers.utils.parseEther("30"));
    expect(contributions[2].timestamp).to.eq(timestamp3);
  });

  it("Should withdraw", async function () {
    await contribution.connect(devWallet).setMerkleRoot(merkleRoot);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);
    await contribution.connect(citizen1).contribute(merkleProof, { value: ethers.utils.parseEther("10") });

    await expect(contribution.connect(citizen1).withdraw()).to.be.reverted;
    expect(await contribution.connect(devWallet).withdraw())
      .to.emit(contribution, "Withdrawn")
      .withArgs(devWallet.address, ethers.utils.parseEther("10"))
      .to.changeEtherBalance(contribution, ethers.utils.parseEther("-10"))
      .to.changeEtherBalance(devWallet, ethers.utils.parseEther("10"));
  });
});
