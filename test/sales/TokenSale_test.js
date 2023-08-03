const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers, network } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const { keccak256, parseEther } = ethers.utils;

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, multisig] = provider.getWallets();

const tokensPerWei = 1000; // 1000 dsq per Ether
const initialSupply = parseEther("483000");

const now = new Date();

describe("TokenSale", function () {
  beforeEach(async function () {
    Seller = await ethers.getContractFactory("TokenSale");
    dsq = await ethers.getContractFactory("TestFixture_ERC20");
    dsq = await dsq.deploy("Testdsq", "dsq");

    seller = await Seller.deploy(dsq.address, multisig.address);

    await dsq.connect(devWallet).mintTo(seller.address, initialSupply);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;
    startTime = timestampBefore + 10;
    publicTime = startTime + 7 * 24 * 3600;

    await network.provider.send("evm_setNextBlockTimestamp", [startTime - 1]);
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
      await expect(seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime)).to.emit(seller, "SaleStarted");
    });

    it("Should NOT start a sale with incorrect parameters", async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, publicTime, startTime)).to.be.revertedWith("Dates");
    });

    it("Should NOT double start a sale", async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime)).to.emit(seller, "SaleStarted");
      await expect(seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime)).to.be.revertedWith("Started");
    });

    it("Should NOT public purchase before sale started", async function () {
      await expect(seller.connect(citizen1).purchase({ value: parseEther("1") })).to.be.revertedWith("Not Started");
    });
  });

  describe("Public Purchase", function () {
    beforeEach(async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime)).to.emit(seller, "SaleStarted");
      await network.provider.send("evm_increaseTime", [10]);
    });

    it("Should tier1 public purchase with correct parameters", async function () {
      await expect(seller.connect(citizen1).purchase({ value: parseEther("1") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("1000"), parseEther("1"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("1"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("1"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("1000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
      expect(await seller.totalContribution()).to.eq(parseEther("1"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should NOT purchase through a smart contract", async function () {
      MinterBot = await ethers.getContractFactory("TestFixture_MinterBot");
      minterBot = await MinterBot.deploy();

      await expect(minterBot.connect(citizen1).purchase(seller.address, { value: parseEther("1") })).to.be.revertedWith("!EOA");
    });

    it("Should NOT public purchase zero amount", async function () {
      await expect(seller.connect(citizen1).purchase({ value: 0 })).to.be.revertedWith("Amount");
    });

    it("Should NOT public purchase after sale", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime]);
      await expect(seller.connect(citizen1).purchase({ value: 1 })).to.be.revertedWith("Sale Over");
    });

    it("Should respect MAX_RAISE", async function () {
      await expect(seller.connect(citizen1).purchase({ value: parseEther("485") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("483000"), parseEther("483"));

      await expect(seller.connect(citizen1).purchase({ value: parseEther("485") })).to.be.revertedWith("Sale Max");
    });

    it("Should emit refund", async function () {
      await expect(seller.connect(citizen1).purchase({ value: parseEther("485") }))
        .to.emit(seller, "Refund")
        .withArgs(citizen1.address, parseEther("2"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("483"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("483"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));
      expect(await seller.totalContribution()).to.eq(parseEther("483"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should refund", async function () {
      await expect(() => seller.connect(citizen1).purchase({ value: parseEther("485") })).to.changeEtherBalance(
        citizen1,
        parseEther("-483"),
      );
    });
  });

  describe("Public Purchase Math", function () {
    beforeEach(async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime)).to.emit(seller, "SaleStarted");
      await network.provider.send("evm_increaseTime", [10]);
    });

    it("Should purchase from 0 to < tier1 max", async function () {
      await expect(seller.connect(citizen1).purchase({ value: parseEther("25") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("25000"), parseEther("25"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("25"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("25"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("25000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from 0 to > tier1 max & < tier2 max", async function () {
      await expect(seller.connect(citizen1).purchase({ value: parseEther("75") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("75000"), parseEther("75"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("75"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("75"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("6000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from 0 to > tier2 max", async function () {
      await expect(seller.connect(citizen1).purchase({ value: parseEther("210") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("210000"), parseEther("210"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("210"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("210"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("3000"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from 0 to tier3 max", async function () {
      await expect(seller.connect(citizen1).purchase({ value: parseEther("485") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("483000"), parseEther("483"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("483"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("483"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from <tier1 max to <tier1 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("20") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("25") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("25000"), parseEther("25"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("45"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("45"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("45000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from <tier1 max to <tier2 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("20") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("75") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("75000"), parseEther("75"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("95"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("95"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("26000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from <tier1 max to >tier2 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("20") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("200") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("200000"), parseEther("200"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("220"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("220"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("13000"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from <tier1 max to >tier3 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("20") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("485") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("463000"), parseEther("463"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("483"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("483"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from >tier1 max to <tier2 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("70") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("75") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("75000"), parseEther("75"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("145"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("145"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("76000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from >tier1 max to >tier2 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("70") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("200") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("200000"), parseEther("200"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("270"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("270"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("63000"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from >tier1 max to >tier3 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("70") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("485") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("413000"), parseEther("413"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("483"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("483"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from >tier2 max to <tier3 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("210") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("20") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("20000"), parseEther("20"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("230"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("230"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("23000"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });

    it("Should purchase from >tier2 max to >tier3 max", async function () {
      await seller.connect(citizen1).purchase({ value: parseEther("210") });

      await expect(seller.connect(citizen1).purchase({ value: parseEther("485") }))
        .to.emit(seller, "Purchase")
        .withArgs(citizen1.address, parseEther("273000"), parseEther("273"));

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("483"));
      expect(await seller.contributed(citizen1.address)).to.eq(parseEther("483"));
      expect(await seller.tier1Pending(citizen1.address)).to.eq(parseEther("69000"));
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));
      expect(await dsq.balanceOf(citizen1.address)).to.eq(0);
    });
  });

  describe("Claiming", function () {
    beforeEach(async function () {
      await expect(seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime)).to.emit(seller, "SaleStarted");
      await network.provider.send("evm_increaseTime", [10]);
      await setBalance(citizen1.address, parseEther("500"));
      await seller.connect(citizen1).purchase({ value: parseEther("485") });
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime]);
    });

    it("Should NOT claim before public sale ends", async function () {
      await expect(seller.connect(citizen1).claim()).to.be.revertedWith("Phase");
    });

    it("Should claim in each tier", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-69000"), parseEther("69000")],
      );
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 30 * 24 * 3600 + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-138000"), parseEther("138000")],
      );
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 60 * 24 * 3600 + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-276000"), parseEther("276000")],
      );
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
    });

    it("Should claim tier1 & tier2 if wait until tier2Claim", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 30 * 24 * 3600 + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-207000"), parseEther("207000")],
      );
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 60 * 24 * 3600 + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-276000"), parseEther("276000")],
      );
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
    });

    it("Should claim all tokens if wait until tier3Claim", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 60 * 24 * 3600 + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-483000"), parseEther("483000")],
      );
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
    });

    it("Should claim tier1 then claim the rest if wait until tier3Claim", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-69000"), parseEther("69000")],
      );
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 60 * 24 * 3600 + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-414000"), parseEther("414000")],
      );
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
    });

    it("Should NOT claim if no tokens purchased", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 1]);
      await expect(seller.connect(citizen2).claim()).to.be.revertedWith("NoPending");
    });

    it("Should NOT double claim in any tier", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-69000"), parseEther("69000")],
      );
      await expect(seller.connect(citizen1).claim()).to.be.revertedWith("NoPending");
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(parseEther("138000"));
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 30 * 24 * 3600 + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-138000"), parseEther("138000")],
      );
      await expect(seller.connect(citizen1).claim()).to.be.revertedWith("NoPending");
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(parseEther("276000"));

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 60 * 24 * 3600 + 1]);
      await expect(() => seller.connect(citizen1).claim()).to.changeTokenBalances(
        dsq,
        [seller, citizen1],
        [parseEther("-276000"), parseEther("276000")],
      );
      await expect(seller.connect(citizen1).claim()).to.be.revertedWith("NoPending");
      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
    });
  });

  describe("Admin", function () {
    it("Should withdraw profits", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime);

      await network.provider.send("evm_increaseTime", [10]);

      await seller.connect(citizen1).purchase({ value: parseEther("1") });

      expect(await network.provider.send("eth_getBalance", [seller.address])).to.eq(parseEther("1"));

      expect(await seller.connect(multisig).withdraw()).to.changeEtherBalance(multisig, parseEther("1"));
    });

    it("Should NOT retrieve tokens during sale", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime);
      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");
    });

    it("Should retrieve tokens", async function () {
      await expect(() => seller.connect(multisig).retrieve()).to.changeTokenBalance(dsq, multisig, parseEther("483000"));
    });

    it("Should not retrieve tokens during inappropriate times", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime]);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 30 * 24 * 3600]);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 90 * 24 * 3600]);

      await expect(seller.connect(multisig).retrieve()).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 90 * 24 * 3600 + 1]);

      await expect(() => seller.connect(multisig).retrieve()).to.changeTokenBalance(dsq, multisig, parseEther("483000"));
    });

    it("Should claimFor with correct permission", async function () {
      await seller.connect(multisig).startSale(tokensPerWei, startTime, publicTime);

      await network.provider.send("evm_increaseTime", [10]);

      await setBalance(citizen1.address, parseEther("500"));
      await seller.connect(citizen1).purchase({ value: parseEther("483") });

      await expect(seller.connect(multisig).claimFor([citizen1.address])).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime]);

      await expect(seller.connect(multisig).claimFor([citizen1.address])).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 30 * 24 * 3600]);

      await expect(seller.connect(multisig).claimFor([citizen1.address])).to.be.revertedWith("Ongoing");

      await network.provider.send("evm_setNextBlockTimestamp", [publicTime + 90 * 24 * 3600]);

      await expect(seller.connect(citizen1).claimFor([citizen1.address])).to.be.reverted;

      await expect(() => seller.connect(multisig).claimFor([citizen1.address])).to.changeTokenBalance(dsq, citizen1, parseEther("483000"));

      expect(await seller.tier1Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier2Pending(citizen1.address)).to.eq(0);
      expect(await seller.tier3Pending(citizen1.address)).to.eq(0);
    });
  });
});
