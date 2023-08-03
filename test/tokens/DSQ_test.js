const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, treasury] = provider.getWallets();

describe("DSQ Token", function () {
  beforeEach(async function () {
    DSQ = await ethers.getContractFactory("DSQToken");
    dsq = await DSQ.deploy(treasury.address, ethers.utils.parseEther("100000"));
  });

  it("Should NOT deploy with 0 address", async function () {
    await expect(DSQ.deploy(ethers.constants.AddressZero, ethers.utils.parseEther("500000"))).to.be.revertedWith("Param");
  });

  it("Should NOT deploy over max supply", async function () {
    await expect(DSQ.deploy(treasury.address, ethers.utils.parseEther("600000"))).to.be.revertedWith("Param");
  });

  it("Should mint the desired supply on construction", async function () {
    expect(await dsq.balanceOf(treasury.address)).to.eq(ethers.utils.parseEther("100000"));
    expect(await dsq.totalSupply()).to.eq(ethers.utils.parseEther("100000"));
  });

  it("Should mint", async function () {
    await expect(() => dsq.connect(treasury).mint(ethers.utils.parseEther("10"))).to.changeTokenBalance(
      dsq,
      treasury,
      ethers.utils.parseEther("10"),
    );
    expect(await dsq.totalSupply()).to.eq(ethers.utils.parseEther("100010"));
  });

  it("Should NOT mint if not owner", async function () {
    await expect(dsq.connect(citizen1).mint(ethers.utils.parseEther("1"))).to.be.reverted;
  });

  it("Should mint to max supply", async function () {
    await expect(() => dsq.connect(treasury).mint(ethers.utils.parseEther("400000"))).to.changeTokenBalance(
      dsq,
      treasury,
      ethers.utils.parseEther("400000"),
    );
    expect(await dsq.totalSupply()).to.eq(ethers.utils.parseEther("500000"));
    await expect(dsq.connect(treasury).mint(ethers.utils.parseEther("1"))).to.be.revertedWith("Max supply reached");
  });

  it("Should NOT mint over max supply", async function () {
    await expect(dsq.connect(treasury).mint(ethers.utils.parseEther("400001"))).to.be.revertedWith("Max supply reached");
  });

  it("Should NOT mint over max supply even if tokens have been burned", async function () {
    await expect(() => dsq.connect(treasury).mint(ethers.utils.parseEther("400000"))).to.changeTokenBalance(
      dsq,
      treasury,
      ethers.utils.parseEther("400000"),
    );
    expect(await dsq.totalSupply()).to.eq(ethers.utils.parseEther("500000"));
    await expect(() => dsq.connect(treasury).burn(ethers.utils.parseEther("100000"))).to.changeTokenBalance(
      dsq,
      treasury,
      ethers.utils.parseEther("-100000"),
    );
    expect(await dsq.totalSupply()).to.eq(ethers.utils.parseEther("400000"));
    await expect(dsq.connect(treasury).mint(ethers.utils.parseEther("1"))).to.be.revertedWith("Max supply reached");
  });
});
