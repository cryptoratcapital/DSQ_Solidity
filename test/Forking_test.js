const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const { setBalance, loadFixture, reset } = require("@nomicfoundation/hardhat-network-helpers");
const addressesAndParams = require("./helpers/addressesAndParams.json");
const { getNetworkConfig } = require("./helpers/forkHelpers.js");

use(solidity);

require("dotenv").config();

const provider = waffle.provider;
const [devWallet, citizen1, citizen2, citizen3, citizen4, citizen5, feeReceiver] = provider.getWallets();

let forkConfigs = {
  arbitrum: {
    url: process.env.ARBITRUM_URL || "https://rpc.ankr.com/arbitrum",
    blockNumber: 78658479,
    addresses: addressesAndParams["arb_mainnet"].addresses,
    parameters: addressesAndParams["arb_mainnet"].parameters,
  },
  avax: {
    url: process.env.AVAX_URL || "https://rpc.ankr.com/avalanche",
    blockNumber: 27951255,
    addresses: addressesAndParams["avax_mainnet"].addresses,
    parameters: addressesAndParams["avax_mainnet"].parameters,
  },
};

let forkConfig = getNetworkConfig(forkConfigs);

async function deployTokens(addresses) {
  USDC = await ethers.getContractAt("TestFixture_ERC20", addresses.USDC);
  WNATIVE = await ethers.getContractAt("IWETH", addresses.WNATIVE);

  return { USDC, WNATIVE };
}

describe("Fork testing", function () {
  describe("Only if a matching fork config is found", function () {
    before(async function () {
      if (forkConfig !== undefined) {
        console.log("Forking");
      } else {
        console.log("Skipping");
        this.skip();
      }
    });

    beforeEach(async function () {
      await reset(forkConfig.url, forkConfig.blockNumber);
    });

    it(`WNATIVE: forking should work`, async function () {
      console.log(await network.provider.send("eth_blockNumber"));
      await deployTokens(forkConfig.addresses);

      await expect(() => WNATIVE.connect(citizen1).deposit({ value: ethers.utils.parseEther("1") })).to.changeEtherBalances(
        [citizen1, WNATIVE],
        [ethers.utils.parseEther("-1"), ethers.utils.parseEther("1")],
      );
    });

    it(`USDC: forking should work `, async function () {
      console.log(await network.provider.send("eth_blockNumber"));
      await deployTokens(forkConfig.addresses);

      expect(await USDC.balanceOf(citizen1.address)).to.eq(0);
    });
  });

  describe("Even if not forking", function () {
    it(`This should always run`, async function () {
      console.log(await network.provider.send("eth_blockNumber"));
    });

    it(`This should not run during coverage [@skip-on-coverage]`, async function () {
      console.log(await network.provider.send("eth_blockNumber"));
    });
  });
});
