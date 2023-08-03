const { reset } = require("@nomicfoundation/hardhat-network-helpers");
const { network } = require("hardhat");

require("dotenv").config();

async function resetToDefaultNetwork() {
  await reset(network.config.forking.url, network.config.forking.blockNumber);
}

function getNetworkConfig(configs) {
  if (process.env.FORCE_NO_FORK) return undefined;

  return process.env.FORK_NETWORK ? configs[process.env.FORK_NETWORK] : undefined;
}

async function forkOrSkip(forkConfig) {
  if (forkConfig !== undefined) {
    console.log(`Forking ${forkConfig.name} at block ${forkConfig.blockNumber}`);
    await reset(forkConfig.url, forkConfig.blockNumber);
  } else {
    console.log("Skipping");
    return true;
  }
}

module.exports = { resetToDefaultNetwork, getNetworkConfig, forkOrSkip };
