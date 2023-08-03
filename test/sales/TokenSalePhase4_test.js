const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers, network } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const { keccak256, parseEther } = ethers.utils;

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, multisig] = provider.getWallets();

const whitelisted = [citizen1, citizen2, citizen3];
const notWhitelisted = [citizen4, citizen5];

const leaves = whitelisted.map(account => keccak256(account.address));
const tree = new MerkleTree(leaves, keccak256, { sort: true });
const merkleRoot = tree.getHexRoot();

const leaf = [citizen4].map(account => keccak256(account.address));
const newTree = new MerkleTree(leaf, keccak256, { sort: true });
const newRoot = newTree.getHexRoot();

const merkleProof = tree.getHexProof(keccak256(whitelisted[0].address));
const invalidMerkleProof = tree.getHexProof(keccak256(notWhitelisted[0].address));

const tokensPerWei = 1000; // 1000 dsq per Ether
const initialSupply = parseEther("483000");

const now = new Date();

describe("TokenSalePhase4", function () {
  beforeEach(async function () {
    dsq = await ethers.getContractFactory("TestFixture_ERC20");
    dsq = await dsq.deploy("Testdsq", "dsq");

    Seller = await ethers.getContractFactory("TokenSalePhase4");
    seller = await Seller.deploy(dsq.address, multisig.address);

    await dsq.connect(devWallet).mintTo(seller.address, initialSupply);

    timestamp = (await ethers.provider.getBlock()).timestamp;
    whitelistTime = timestamp + 10;
    publicTime = whitelistTime + 7 * 24 * 3600;
    endTime = publicTime + 7 * 24 * 3600;
  });

  describe("Construction", function () {
    it("Should construct", async function () {
      expect(await seller.DSQ()).to.eq(dsq.address);
      expect(await seller.owner()).to.eq(multisig.address);
    });

    it("Should NOT construct with 0 address", async function () {
      await expect(Seller.deploy(ethers.constants.AddressZero, multisig.address)).to.be.revertedWith("zeroAddr");
      await expect(Seller.deploy(dsq.address, ethers.constants.AddressZero)).to.be.revertedWith("zeroAddr");
    });
  });

  describe("Sale", function () {
    it("Should start a sale", async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot))
        .to.emit(seller, "SaleStarted")
        .withArgs(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot);
    });

    it("Should NOT start a sale with incorrect parameters", async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, timestamp, endTime, publicTime, merkleRoot)).to.be.revertedWith(
        "Dates",
      );
      await expect(seller.connect(multisig).startSale(tokensPerWei, publicTime, whitelistTime, endTime, merkleRoot)).to.be.revertedWith(
        "Dates",
      );
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, endTime, publicTime, merkleRoot)).to.be.revertedWith(
        "Dates",
      );
    });

    it("Should NOT double start a sale", async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot)).to.emit(
        seller,
        "SaleStarted",
      );
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot)).to.be.revertedWith(
        "Started",
      );
    });

    it("Should NOT whitelist purchase before whitelist started", async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot)).to.emit(
        seller,
        "SaleStarted",
      );
      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime - 1]);
      await expect(seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") })).to.be.revertedWith("Not Started");
    });

    it("Should NOT public purchase before public sale started", async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot)).to.emit(
        seller,
        "SaleStarted",
      );
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime - 1]);
      await expect(seller.connect(citizen1).purchasePublic({ value: parseEther("1") })).to.be.revertedWith("Not Started");
    });
  });

  describe("Whitelist Purchase", function () {
    beforeEach(async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot)).to.emit(
        seller,
        "SaleStarted",
      );
      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime + 1]);
    });

    it("Should purchaseWhitelist", async function () {
      await expect(seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") }))
        .to.emit(seller, "PurchaseWhitelist")
        .withArgs(citizen1.address, parseEther("1000"), parseEther("1"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("1"));
      expect(await seller.contributionPerUser(citizen1.address)).to.eq(parseEther("1"));
      expect(await seller.pending(citizen1.address)).to.eq(parseEther("1000"));
      expect(await seller.totalContribution()).to.eq(parseEther("1"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should NOT purchaseWhitelist with invalid proof", async function () {
      await expect(seller.connect(citizen4).purchaseWhitelist(invalidMerkleProof, { value: parseEther("1") })).to.be.revertedWith(
        "!Whitelisted",
      );
    });

    it("Should NOT whitelist purchase through a smart contract", async function () {
      MinterBot = await ethers.getContractFactory("TestFixture_MinterBotPhase4");
      minterBot = await MinterBot.deploy();

      seller = await Seller.deploy(dsq.address, multisig.address);
      botWhitelist = [minterBot];
      botLeaves = botWhitelist.map(account => keccak256(account.address));
      botTree = new MerkleTree(botLeaves, keccak256, { sort: true });
      botRoot = botTree.getHexRoot();
      botProof = botTree.getHexProof(keccak256(minterBot.address));
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime + 10, publicTime, endTime, botRoot)).to.emit(
        seller,
        "SaleStarted",
      );

      await expect(minterBot.connect(citizen1).purchaseWhitelist(botProof, seller.address, { value: parseEther("1") })).to.be.revertedWith(
        "!EOA",
      );
    });

    it("Should NOT whitelist purchase zero amount", async function () {
      await expect(seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: 0 })).to.be.revertedWith("Amount");
    });

    it("Should NOT whitelist purchase once public sale starts", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime]);
      await expect(seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: 1 })).to.be.revertedWith("Whitelist Sale Over");
    });

    it("Should respect MAX_CONTRIBUTION_PER_USER", async function () {
      await expect(seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1.5") })).to.be.revertedWith(
        "User Cap Exceeded",
      );
    });

    it("Should respect MAX_RAISE", async function () {
      Test_Seller = await ethers.getContractFactory("TestFixture_TokenSalePhase4");
      test_seller = await Test_Seller.deploy(dsq.address, multisig.address);
      await test_seller.connect(multisig).startSale(tokensPerWei, whitelistTime + 10, publicTime, endTime, merkleRoot);
      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime + 11]);

      await expect(test_seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") }))
        .to.emit(test_seller, "PurchaseWhitelist")
        .withArgs(citizen1.address, parseEther("500"), parseEther(".5"));

      await expect(test_seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") })).to.be.revertedWith("Sale Max");
    });

    it("Should emit whitelist refund", async function () {
      Test_Seller = await ethers.getContractFactory("TestFixture_TokenSalePhase4");
      test_seller = await Test_Seller.deploy(dsq.address, multisig.address);
      await test_seller.connect(multisig).startSale(tokensPerWei, whitelistTime + 10, publicTime, endTime, merkleRoot);
      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime + 11]);

      await expect(test_seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") }))
        .to.emit(test_seller, "Refund")
        .withArgs(citizen1.address, parseEther(".5"));

      expect(await network.provider.send("eth_getBalance", [test_seller.address])).to.eq(parseEther(".5"));
      expect(await test_seller.contributionPerUser(citizen1.address)).to.eq(parseEther(".5"));
      expect(await test_seller.pending(citizen1.address)).to.eq(parseEther("500"));
      expect(await test_seller.totalContribution()).to.eq(parseEther(".5"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should whitelist refund", async function () {
      Test_Seller = await ethers.getContractFactory("TestFixture_TokenSalePhase4");
      test_seller = await Test_Seller.deploy(dsq.address, multisig.address);
      await test_seller.connect(multisig).startSale(tokensPerWei, whitelistTime + 10, publicTime, endTime, merkleRoot);
      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime + 11]);
      await expect(() => test_seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") })).to.changeEtherBalance(
        citizen1,
        parseEther("-.5"),
      );
    });
  });

  describe("Public Purchase", function () {
    beforeEach(async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot)).to.emit(
        seller,
        "SaleStarted",
      );
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 1]);
    });

    it("Should purchasePublic", async function () {
      await expect(seller.connect(citizen1).purchasePublic({ value: parseEther("1") }))
        .to.emit(seller, "PurchasePublic")
        .withArgs(citizen1.address, parseEther("1000"), parseEther("1"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("1"));
      expect(await seller.contributionPerUser(citizen1.address)).to.eq(parseEther("1"));
      expect(await seller.pending(citizen1.address)).to.eq(parseEther("1000"));
      expect(await seller.totalContribution()).to.eq(parseEther("1"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should NOT public purchase through a smart contract", async function () {
      MinterBot = await ethers.getContractFactory("TestFixture_MinterBotPhase4");
      minterBot = await MinterBot.deploy();

      await expect(minterBot.connect(citizen1).purchasePublic(seller.address, { value: parseEther("1") })).to.be.revertedWith("!EOA");
    });

    it("Should NOT public purchase zero amount", async function () {
      await expect(seller.connect(citizen1).purchasePublic({ value: 0 })).to.be.revertedWith("Amount");
    });

    it("Should NOT public purchase after sale end", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime]);
      await expect(seller.connect(citizen1).purchasePublic({ value: 1 })).to.be.revertedWith("Sale Over");
    });

    it("Should NOT public purchase before public started", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime - 1]);
      await expect(seller.connect(citizen1).purchasePublic({ value: 1 })).to.be.revertedWith("Not Started");

      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime + 1]);
      await expect(seller.connect(citizen1).purchasePublic({ value: 1 })).to.be.revertedWith("Not Started");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime - 1]);
      await expect(seller.connect(citizen1).purchasePublic({ value: 1 })).to.be.revertedWith("Not Started");
    });

    it("Should respect MAX_RAISE", async function () {
      await expect(seller.connect(citizen1).purchasePublic({ value: parseEther("485") }))
        .to.emit(seller, "PurchasePublic")
        .withArgs(citizen1.address, parseEther("483000"), parseEther("483"));

      await expect(seller.connect(citizen1).purchasePublic({ value: parseEther("1") })).to.be.revertedWith("Sale Max");
    });

    it("Should emit refund", async function () {
      await expect(seller.connect(citizen1).purchasePublic({ value: parseEther("485") }))
        .to.emit(seller, "Refund")
        .withArgs(citizen1.address, parseEther("2"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("483"));
      expect(await seller.contributionPerUser(citizen1.address)).to.eq(parseEther("483"));
      expect(await seller.pending(citizen1.address)).to.eq(parseEther("483000"));
      expect(await seller.totalContribution()).to.eq(parseEther("483"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should public refund", async function () {
      await expect(() => seller.connect(citizen1).purchasePublic({ value: parseEther("485") })).to.changeEtherBalance(
        citizen1,
        parseEther("-483"),
      );
    });
  });

  describe("Claiming", function () {
    beforeEach(async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot)).to.emit(
        seller,
        "SaleStarted",
      );
      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime + 1]);
      await seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") });
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 1]);
      await seller.connect(citizen1).purchasePublic({ value: parseEther("100") });
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 90 * 24 * 60 * 60 - 1]);
    });

    it("Should NOT claim before public sale ends", async function () {
      await expect(seller.connect(citizen1).claim()).to.be.revertedWith("Claim Not Active");
    });

    it("Should claim", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 90 * 24 * 60 * 60 - 1]);
      await expect(seller.connect(citizen1).claim()).to.be.revertedWith("Claim Not Active");
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-101000"), parseEther("101000")],
      );
      expect(await seller.pending(citizen1.address)).to.eq(0);
    });

    it("Should NOT claim if no tokens purchased", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 90 * 24 * 60 * 60]);
      await expect(seller.connect(citizen2).claim()).to.be.revertedWith("NoPending");
    });

    it("Should NOT double claim", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 90 * 24 * 60 * 60]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-101000"), parseEther("101000")],
      );
      await expect(seller.connect(citizen1).claim()).to.be.revertedWith("NoPending");
      expect(await seller.pending(citizen1.address)).to.eq(0);
    });
  });

  describe("Admin", function () {
    it("Should NOT set merkle root if NOT admin", async function () {
      await expect(seller.connect(citizen1).setMerkleRoot(merkleRoot)).to.be.reverted;
    });

    it("Should set merkle root", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot);
      await expect(seller.connect(multisig).setMerkleRoot(newRoot)).to.emit(seller, "NewMerkleRoot").withArgs(merkleRoot, newRoot);
    });

    it("Should withdraw profits", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot);

      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime + 1]);

      await seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") });

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("1"));

      await expect(seller.connect(citizen1).withdraw()).to.be.revertedWith("Ownable: caller is not the owner");
      expect(await seller.connect(multisig).withdraw()).to.changeEtherBalance(multisig, parseEther("1"));
    });

    it("Should NOT retrieve tokens during sale", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot);
      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");
    });

    it("Should retrieve tokens", async function () {
      await expect(() => seller.connect(multisig).retrieve()).to.changeTokenBalance(dsq, multisig, parseEther("483000"));
    });

    it("Should not retrieve tokens during inappropriate times", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");
      await expect(seller.connect(citizen1).retrieve()).to.be.revertedWith("Ownable: caller is not the owner");

      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime]);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime]);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [endTime]);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 90 * 24 * 3600]);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 120 * 24 * 3600]);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await expect(() => seller.connect(multisig).retrieve()).to.changeTokenBalance(dsq, multisig, parseEther("483000"));
    });

    it("Should claimFor with correct permission", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, whitelistTime, publicTime, endTime, merkleRoot);

      await network.provider.send("evm_setNextBlockTimestamp", [whitelistTime + 1]);

      await seller.connect(citizen1).purchaseWhitelist(merkleProof, { value: parseEther("1") });

      await expect(seller.connect(multisig).claimFor([citizen1.address])).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime]);

      await expect(seller.connect(multisig).claimFor([citizen1.address])).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [endTime]);

      await expect(seller.connect(multisig).claimFor([citizen1.address])).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 120 * 24 * 3600]);

      await expect(seller.connect(multisig).claimFor([citizen1.address])).to.be.revertedWith("Ongoing");
      await expect(seller.connect(citizen1).claimFor([citizen1.address])).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(() => seller.connect(multisig).claimFor([citizen1.address, citizen2.address])).to.changeTokenBalances(
        dsq,
        [citizen1, citizen2],
        [parseEther("1000"), 0],
      );

      expect(await seller.pending(citizen1.address)).to.eq(0);
    });
  });
});
