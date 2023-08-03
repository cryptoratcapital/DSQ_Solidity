const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");

use(solidity);

const ESDSQNAME = "Escrowed DSquared Governance Token";
const ESDSQSYMBOL = "esDSQ";

const provider = waffle.provider;
const [devWallet, citizen1, citizen2] = provider.getWallets();

const esdsqInitialSupply = ethers.utils.parseEther("100000");

/*
Tokenomics Deployment Checklist (Must use arbitrum fork to test)

PreReqs

* Load DSQ
* Deploy esDSQ with name and symbol
* Transfer esDSQ roles to multisig and renounce all roles from deployer
* Deploy DSQStaking w/ Multisig, Treasury, esDSQ, and DSQ addresses
* Deploy esDSQStaking w/ DSQ, esDSQ, and DSQStaking addresses
* Deploy Router w/ DSQ, esDSQ, DSQStaking, and esDSQStaking addresses
* Set router for DSQStaking & esDSQStaking
* Add esDSQStaking, DSQStaking, & Router to esDSQ permanent whitelist
* Fund DSQStaking with esDSQ and start reward campaign

*/

// DSQ Address
const DSQ_ADDRESS = "0x760E31672fE489bE1d3cb3447FEB493d03BD55A0";

// DSQ Treasury Multisig
const DSQ_MULTISIG = "0xe7eb925300075E49fc5CAaD5d408A50Dd22f92D6";

xdescribe("Tokenomics", function () {
  beforeEach(async function () {
    // Impersonate DSQ_MULTISIG
    multisig = await ethers.getImpersonatedSigner(DSQ_MULTISIG);

    // Load DSQ
    dsq = await ethers.getContractAt("DSQToken", DSQ_ADDRESS);

    // Deploy esDSQ with name and symbol
    ESDSQ = await ethers.getContractFactory("esDSQToken");
    esdsq = await ESDSQ.deploy(ESDSQNAME, ESDSQSYMBOL);

    // Transfer esDSQ roles to multisig and renounce all roles from deployer
    adminRole = await esdsq.DEFAULT_ADMIN_ROLE();
    mintRole = await esdsq.MINTER_ROLE();
    await esdsq.connect(devWallet).grantRole(adminRole, multisig.address);
    await esdsq.connect(devWallet).grantRole(mintRole, multisig.address);
    await esdsq.connect(devWallet).renounceRole(adminRole, devWallet.address);
    await esdsq.connect(devWallet).renounceRole(mintRole, devWallet.address);

    // Deploy DSQStaking w/ OPS, Treasury, esDSQ, and DSQ addresses
    DSQStaking = await ethers.getContractFactory("DSQStaking");
    dsqStaking = await DSQStaking.deploy(multisig.address, multisig.address, esdsq.address, dsq.address);

    // Deploy esDSQStaking
    ESDSQStaking = await ethers.getContractFactory("esDSQStaking");
    esdsqStaking = await ESDSQStaking.deploy(multisig.address, dsq.address, esdsq.address, dsqStaking.address);

    // Deploy Router
    Router = await ethers.getContractFactory("Router");
    router = await Router.deploy(multisig.address, dsq.address, esdsq.address, dsqStaking.address, esdsqStaking.address);

    // Set routers
    await dsqStaking.connect(multisig).setRouter(router.address);
    await esdsqStaking.connect(multisig).setRouter(router.address);

    // Add staking contracts and router to permanent whitelist
    await esdsq.connect(multisig).addWhitelistAddress(dsqStaking.address, true);
    await esdsq.connect(multisig).addWhitelistAddress(esdsqStaking.address, true);
    await esdsq.connect(multisig).addWhitelistAddress(router.address, true);

    // Fund DSQStaking with esDSQ and start reward campaign
    await esdsq.connect(multisig).mint(dsqStaking.address, esdsqInitialSupply);
    await dsqStaking.connect(multisig).notifyRewardAmount(esdsqInitialSupply);
  });

  describe("Deployment", function () {
    // Load DSQ
    it("Should mint the desired supply of DSQ on construction", async function () {
      expect(dsq.address).to.eq(DSQ_ADDRESS);
    });

    // Deploy esDSQ with name and symbol
    it("Should construct esDSQ correctly", async function () {
      expect(await esdsq.name()).to.eq(ESDSQNAME);
      expect(await esdsq.symbol()).to.eq(ESDSQSYMBOL);
    });

    // Transfer esDSQ roles to multisig and renounce all roles from deployer
    it("Should NOT allow devWallet to mint esDSQ and do admin functions", async function () {
      await expect(esdsq.connect(devWallet).mint(citizen1.address, ethers.utils.parseEther("10"))).to.be.reverted;
      await expect(esdsq.connect(devWallet).setRestrictedTransfer(false)).to.be.reverted;
      await expect(esdsq.connect(devWallet).addWhitelistAddress(citizen1.address)).to.be.reverted;
    });

    it("Should allow multisig to mint esDSQ and do admin functions", async function () {
      await esdsq.connect(multisig).mint(citizen1.address, ethers.utils.parseEther("10"));
      expect(await esdsq.balanceOf(citizen1.address)).to.eq(ethers.utils.parseEther("10"));

      await expect(esdsq.connect(multisig).setRestrictedTransfer(false)).to.emit(esdsq, "NewRestrictedTransfer");
      await esdsq.connect(multisig).addWhitelistAddress(citizen1.address, false);
      expect(await esdsq.getWhitelistStatus(citizen1.address)).to.deep.equal([true, false]);
    });

    // Deploy DSQStaking w/ OPS, Treasury, esDSQ, and DSQ addresses
    it("Should construct dsqStaking correctly", async function () {
      expect(await dsqStaking.owner()).to.eq(multisig.address);
      expect(await dsqStaking.rewardsToken()).to.eq(esdsq.address);
      expect(await dsqStaking.stakingToken()).to.eq(dsq.address);
      expect(await dsqStaking.rewardsDistribution()).to.eq(multisig.address);
    });

    // Deploy esDSQStaking w/ DSQ, esDSQ, and DSQStaking addresses
    it("Should construct esDSQStaking correctly", async function () {
      expect(await esdsqStaking.owner()).to.eq(multisig.address);
      expect(await esdsqStaking.dsq()).to.eq(dsq.address);
      expect(await esdsqStaking.esdsq()).to.eq(esdsq.address);
      expect(await esdsqStaking.dsqStaking()).to.eq(dsqStaking.address);
    });

    // Deploy Router w / DSQ, esDSQ, DSQStaking, and esDSQStaking addresses
    it("Should construct Router correctly", async function () {
      expect(await router.owner()).to.eq(multisig.address);
      expect(await router.dsq()).to.eq(dsq.address);
      expect(await router.esdsq()).to.eq(esdsq.address);
      expect(await router.dsqStaking()).to.eq(dsqStaking.address);
      expect(await router.esdsqStaking()).to.eq(esdsqStaking.address);
    });

    // Set router for DSQStaking & esDSQStaking
    it("Should setRouter", async function () {
      expect(await dsqStaking.router()).to.eq(router.address);
      expect(await esdsqStaking.router()).to.eq(router.address);
    });

    // Add esDSQStaking, DSQStaking, & Router to esDSQ permanent whitelist
    it("Should add StakingRewards to esDSQ whitelist", async function () {
      expect(await esdsq.getWhitelistStatus(dsqStaking.address)).to.deep.equal([true, true]);
      expect(await esdsq.getWhitelistStatus(esdsqStaking.address)).to.deep.equal([true, true]);
      expect(await esdsq.getWhitelistStatus(router.address)).to.deep.equal([true, true]);
    });

    // Fund DSQStaking with esDSQ and start reward campaign
    it("Should fund StakingRewards with esDSQ and start reward campaign", async function () {
      expect(await esdsq.balanceOf(dsqStaking.address)).to.eq(esdsqInitialSupply);
      expect(await dsqStaking.periodFinish()).to.not.eq(0);
    });
  });

  describe("esDSQ Permissions", function () {
    beforeEach(async function () {
      await esdsq.connect(multisig).mint(citizen1.address, ethers.utils.parseEther("1"));
    });

    it("Should NOT allow citizen1 to transfer if restricted", async function () {
      await expect(esdsq.connect(citizen1).transfer(citizen2.address, ethers.utils.parseEther("1"))).to.be.revertedWith("!whitelisted");
    });

    it("Should allow multisig to unrestrict and transfer to take place", async function () {
      await esdsq.connect(multisig).setRestrictedTransfer(false);
      await expect(() => esdsq.connect(citizen1).transfer(citizen2.address, ethers.utils.parseEther("1"))).to.changeTokenBalances(
        esdsq,
        [citizen1, citizen2],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
    });
  });
});
