const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers, network } = require("hardhat");

use(solidity);

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, router] = provider.getWallets();

describe("esDSQ", function () {
  beforeEach(async function () {
    ESDSQ = await ethers.getContractFactory("esDSQToken");
    esDSQ = await ESDSQ.deploy("Escrowed DSquared Governance Token", "esDSQ");
  });

  describe("Deployment", function () {
    it("Should construct", async function () {
      expect(await esDSQ.name()).to.eq("Escrowed DSquared Governance Token");
      expect(await esDSQ.symbol()).to.eq("esDSQ");
    });
  });

  describe("Minting", function () {
    it("Should mint if MINTER_ROLE", async function () {
      await esDSQ.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("10"));
      expect(await esDSQ.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("10"));
    });

    it("Should NOT mint if not MINTER_ROLE", async function () {
      await expect(esDSQ.connect(citizen1).mint(citizen1.address, ethers.utils.parseEther("10"))).to.be.reverted;
    });

    it("Should mint to max supply", async function () {
      await expect(() => esDSQ.connect(devWallet).mint(devWallet.address, ethers.utils.parseEther("250000"))).to.changeTokenBalance(
        esDSQ,
        devWallet,
        ethers.utils.parseEther("250000"),
      );
      expect(await esDSQ.totalSupply()).to.eq(ethers.utils.parseEther("250000"));
      await expect(esDSQ.connect(devWallet).mint(devWallet.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQToken: Max supply reached",
      );
    });

    it("Should NOT mint over max supply", async function () {
      await expect(esDSQ.connect(devWallet).mint(devWallet.address, ethers.utils.parseEther("250001"))).to.be.revertedWith(
        "esDSQToken: Max supply reached",
      );
    });

    it("Should NOT mint over max supply even if tokens have been burned", async function () {
      // Unrestrict transfers so we can burn
      await esDSQ.connect(devWallet).setRestrictedTransfer(false);

      await expect(() => esDSQ.connect(devWallet).mint(devWallet.address, ethers.utils.parseEther("250000"))).to.changeTokenBalance(
        esDSQ,
        devWallet,
        ethers.utils.parseEther("250000"),
      );
      expect(await esDSQ.totalSupply()).to.eq(ethers.utils.parseEther("250000"));
      await expect(() => esDSQ.connect(devWallet).burn(ethers.utils.parseEther("100000"))).to.changeTokenBalance(
        esDSQ,
        devWallet,
        ethers.utils.parseEther("-100000"),
      );
      expect(await esDSQ.totalSupply()).to.eq(ethers.utils.parseEther("150000"));
      await expect(esDSQ.connect(devWallet).mint(devWallet.address, 1)).to.be.revertedWith("esDSQToken: Max supply reached");
    });
  });

  describe("Restricted", function () {
    beforeEach(async function () {
      await esDSQ.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
    });

    it("Should NOT transfer if user not whitelisted", async function () {
      await expect(esDSQ.connect(citizen1).transfer(citizen2.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQToken: !whitelisted",
      );
    });

    it("Should transfer if user is whitelisted", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      await expect(() => esDSQ.connect(citizen1).transfer(citizen2.address, ethers.utils.parseEther("1"))).to.changeTokenBalances(
        esDSQ,
        [citizen1, citizen2],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
    });

    it("Should NOT transferFrom is user not whitelisted", async function () {
      await expect(esDSQ.connect(router).transferFrom(citizen1.address, citizen2.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQToken: !whitelisted",
      );
    });

    it("Should NOT transferFrom if not approved", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(router.address, false);
      await expect(esDSQ.connect(router).transferFrom(citizen1.address, citizen2.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "ERC20: insufficient allowance",
      );
    });

    it("Should transferFrom if whitelisted & approved", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(router.address, false);
      await esDSQ.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(() =>
        esDSQ.connect(router).transferFrom(citizen1.address, citizen2.address, ethers.utils.parseEther("1")),
      ).to.changeTokenBalances(esDSQ, [citizen1, citizen2], [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")]);
    });

    it("Should NOT burn if user is not whitelisted", async function () {
      await expect(esDSQ.connect(citizen1).burn(ethers.utils.parseEther("1"))).to.be.revertedWith("esDSQToken: !whitelisted");
    });

    it("Should burn if user is whitelisted", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      await expect(() => esDSQ.connect(citizen1).burn(ethers.utils.parseEther("1"))).to.changeTokenBalance(
        esDSQ,
        citizen1,
        ethers.utils.parseEther("-1"),
      );
    });

    it("Should NOT burnFrom is user not whitelisted", async function () {
      await expect(esDSQ.connect(router).burnFrom(citizen1.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "esDSQToken: !whitelisted",
      );
    });

    it("Should NOT burnFrom if not approved", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(router.address, false);
      await expect(esDSQ.connect(router).burnFrom(citizen1.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "ERC20: insufficient allowance",
      );
    });

    it("Should burnFrom if whitelisted & approved", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(router.address, false);
      await esDSQ.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(() => esDSQ.connect(router).burnFrom(citizen1.address, ethers.utils.parseEther("1"))).to.changeTokenBalance(
        esDSQ,
        citizen1,
        ethers.utils.parseEther("-1"),
      );
    });
  });

  describe("Not Restricted", function () {
    beforeEach(async function () {
      await esDSQ.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("1"));
      await esDSQ.connect(devWallet).setRestrictedTransfer(false);
    });

    it("Should transfer", async function () {
      await expect(() => esDSQ.connect(citizen1).transfer(citizen2.address, ethers.utils.parseEther("1"))).to.changeTokenBalances(
        esDSQ,
        [citizen1, citizen2],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
    });

    it("Should NOT transferFrom without approvals", async function () {
      await expect(esDSQ.connect(router).transferFrom(citizen1.address, citizen2.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "ERC20: insufficient allowance",
      );
    });

    it("Should transferFrom with approval", async function () {
      await esDSQ.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(() =>
        esDSQ.connect(router).transferFrom(citizen1.address, citizen2.address, ethers.utils.parseEther("1")),
      ).to.changeTokenBalances(esDSQ, [citizen1, citizen2], [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")]);
    });

    it("Should burn", async function () {
      await expect(() => esDSQ.connect(citizen1).burn(ethers.utils.parseEther("1"))).to.changeTokenBalance(
        esDSQ,
        citizen1,
        ethers.utils.parseEther("-1"),
      );
    });

    it("Should NOT burnFrom without approval", async function () {
      await expect(esDSQ.connect(router).burnFrom(citizen1.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
        "ERC20: insufficient allowance",
      );
    });

    it("Should burnFrom with approval", async function () {
      await esDSQ.connect(citizen1).approve(router.address, ethers.utils.parseEther("1"));
      await expect(() => esDSQ.connect(router).burnFrom(citizen1.address, ethers.utils.parseEther("1"))).to.changeTokenBalance(
        esDSQ,
        citizen1,
        ethers.utils.parseEther("-1"),
      );
    });
  });

  describe("Views", function () {
    it("Should getWhitelistStatus", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, false]);
      expect(await esDSQ.getWhitelistStatus(citizen2.address)).to.deep.equal([false, false]);

      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, true);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, true]);
    });

    it("Should getWhitelistedAddresses", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      expect(await esDSQ.getWhitelistedAddresses()).to.contain(citizen1.address);

      await esDSQ.connect(devWallet).addWhitelistAddress(citizen2.address, false);
      expect(await esDSQ.getWhitelistedAddresses())
        .to.contain(citizen1.address)
        .and.to.contain(citizen2.address);
    });
  });

  describe("Admin", function () {
    it("Should setRestrictedTransfer", async function () {
      expect(await esDSQ.restrictedTransfer()).to.eq(true);
      await expect(esDSQ.connect(devWallet).setRestrictedTransfer(false)).to.emit(esDSQ, "NewRestrictedTransfer").withArgs(false);
      expect(await esDSQ.restrictedTransfer()).to.eq(false);
    });

    it("Should NOT setRestrictedTransfer if not ADMIN", async function () {
      expect(await esDSQ.restrictedTransfer()).to.eq(true);
      await expect(esDSQ.connect(citizen1).setRestrictedTransfer(false)).to.be.reverted;
    });

    it("Should addWhitelistAddress", async function () {
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([false, false]);
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, false]);
    });

    it("Should addWhitelistAddresses", async function () {
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([false, false]);
      expect(await esDSQ.getWhitelistStatus(citizen2.address)).to.deep.equal([false, false]);
      await esDSQ.connect(devWallet).addWhitelistAddresses([citizen1.address, citizen2.address], [false, true]);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, false]);
      expect(await esDSQ.getWhitelistStatus(citizen2.address)).to.deep.equal([true, true]);
    });

    it("Should emit NewWhitelistAddress", async function () {
      await expect(esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false))
        .to.emit(esDSQ, "NewWhitelistAddress")
        .withArgs(citizen1.address, false);

      await expect(esDSQ.connect(devWallet).addWhitelistAddress(citizen2.address, true))
        .to.emit(esDSQ, "NewWhitelistAddress")
        .withArgs(citizen2.address, true);
    });

    it("Should switch whitelist address to permanent if already listed", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, false]);
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, true);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, true]);

      await expect(esDSQ.connect(devWallet).removeWhitelistAddress(citizen1.address)).to.be.revertedWith(
        "esDSQToken: Address is permanent",
      );
    });

    it("Should NOT addWhitelistAddress if not ADMIN", async function () {
      await expect(esDSQ.connect(citizen1).addWhitelistAddress(citizen1.address)).to.be.reverted;
    });

    it("Should removeWhitelistAddress if not permanent", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, false]);
      await esDSQ.connect(devWallet).removeWhitelistAddress(citizen1.address);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([false, false]);
    });

    it("Should removeWhitelistAddresses if not permanent", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddresses([citizen1.address, citizen2.address], [false, false]);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, false]);
      expect(await esDSQ.getWhitelistStatus(citizen2.address)).to.deep.equal([true, false]);
      await esDSQ.connect(devWallet).removeWhitelistAddresses([citizen1.address, citizen2.address]);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([false, false]);
      expect(await esDSQ.getWhitelistStatus(citizen2.address)).to.deep.equal([false, false]);
    });

    it("Should emit RemovedWhitelistAddress", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      await expect(esDSQ.connect(devWallet).removeWhitelistAddress(citizen1.address))
        .to.emit(esDSQ, "RemovedWhitelistAddress")
        .withArgs(citizen1.address);
    });

    it("Should NOT removeWhitelistAddress if permanent", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, true);
      await expect(esDSQ.connect(devWallet).removeWhitelistAddress(citizen1.address)).to.be.revertedWith(
        "esDSQToken: Address is permanent",
      );
    });

    it("Should NOT switch permanent address to not permanent", async function () {
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, true);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, true]);
      await esDSQ.connect(devWallet).addWhitelistAddress(citizen1.address, false);
      expect(await esDSQ.getWhitelistStatus(citizen1.address)).to.deep.equal([true, true]);
    });

    it("Should NOT removeWhitelistAddress if not ADMIN", async function () {
      await expect(esDSQ.connect(citizen1).removeWhitelistAddress(citizen1.address)).to.be.reverted;
    });
  });
});
