const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { keccak256, parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");

use(solidity);

const provider = waffle.provider;
const [devWallet, admin, citizen1, citizen2, citizen3] = provider.getWallets();

/* eslint-disable mocha/no-skipped-tests */
xdescribe("Transfer Helper", function () {
  async function deployFixture() {
    Helper = await ethers.getContractFactory("TransferHelper");
    helper = await Helper.deploy(admin.address);

    Token = await ethers.getContractFactory("TestFixture_ERC20");
    token1 = await Token.deploy("T1", "Test1");
    token2 = await Token.deploy("T2", "Test2");

    await token1.connect(devWallet).mintTo(admin.address, parseEther("10"));
    await token2.connect(devWallet).mintTo(admin.address, parseEther("10"));

    await token1.connect(admin).approve(helper.address, parseEther("10"));
    await token2.connect(admin).approve(helper.address, parseEther("10"));

    return { helper, token1, token2 };
  }

  describe("Construction", function () {
    beforeEach(async function () {
      const { helper, token1, token2 } = await loadFixture(deployFixture);
    });

    it("Should construct", async function () {
      expect(await helper.owner()).to.eq(admin.address);
    });
  });

  describe("Airdrop", function () {
    beforeEach(async function () {
      const { helper, token1, token2 } = await loadFixture(deployFixture);
    });

    it("Should batchTransfer if owner", async function () {
      await expect(() =>
        helper
          .connect(admin)
          .batchTransfer([token1.address, token1.address], [citizen1.address, citizen2.address], [parseEther("1"), parseEther("1")]),
      ).to.changeTokenBalances(token1, [admin, citizen1, citizen2], [parseEther("-2"), parseEther("1"), parseEther("1")]);
    });

    it("Should NOT batchTransfer if not owner", async function () {
      await expect(
        helper
          .connect(citizen1)
          .batchTransfer([token1.address, token1.address], [citizen1.address, citizen2.address], [parseEther("1"), parseEther("1")]),
      ).to.be.revertedWith("Ownable:");
    });

    it("Should NOT batchTransfer with malformed inputs", async function () {
      await expect(
        helper.connect(admin).batchTransfer([token1.address], [citizen1.address, citizen2.address], [parseEther("1"), parseEther("1")]),
      ).to.be.revertedWith("Length");
      await expect(
        helper.connect(admin).batchTransfer([token1.address, token1.address], [citizen2.address], [parseEther("1"), parseEther("1")]),
      ).to.be.revertedWith("Length");
      await expect(
        helper.connect(admin).batchTransfer([token1.address, token1.address], [citizen1.address, citizen2.address], [parseEther("1")]),
      ).to.be.revertedWith("Length");
    });
  });
});
