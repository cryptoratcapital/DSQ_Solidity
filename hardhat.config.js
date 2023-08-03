require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("solidity-coverage");
require("hardhat-tracer");
require("hardhat-diamond-abi");

require("dotenv").config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const diamondAbi_filter = () => {
  const processedAbiElements = new Set();
  return abiElement => {
    abiElement = `${abiElement.name}(${abiElement.inputs
      .map(input => {
        return input.type;
      })
      .join(",")})`;
    if (processedAbiElements.has(abiElement)) {
      return false;
    } else {
      processedAbiElements.add(abiElement);
      return true;
    }
  };
};

const forkDefaults = {
  arbitrum: { url: "https://rpc.ankr.com/arbitrum", blockNumber: 78658479 },
  avax: { url: "https://rpc.ankr.com/avalanche", blockNumber: 27951255 },
};

const getHardhatNetworkConfig = () => {
  if (process.env.FORCE_NO_FORK) return {};

  switch (process.env.FORK_NETWORK) {
    case "arbitrum":
      return {
        forking: {
          url: process.env.ARBITRUM_URL || forkDefaults["arbitrum"].url,
          blockNumber: process.env.FORK_BLOCKNUMBER || forkDefaults["arbitrum"].blockNumber,
        },
      };
    case "avax":
      return {
        forking: {
          url: process.env.AVAX_URL || forkDefaults["avax"].url,
          blockNumber: process.env.FORK_BLOCKNUMBER || forkDefaults["avax"].blockNumber,
        },
      };
    default:
      return {};
  }
};

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
          viaIR: true,
        },
      },
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
    ],
  },
  diamondAbi: [
    {
      name: "StrategyDiamond_ARB",
      include: [
        "TraderV0",
        "GMX_Swap_Module",
        "GMX_PositionRouter_Module",
        "GMX_OrderBook_Module",
        "GMX_GLP_Module",
        "Camelot_LP_Module",
        "Camelot_NFTPool_Module",
        "Camelot_NitroPool_Module",
        "Camelot_Swap_Module",
        "Camelot_Storage_Module",
        "Lyra_Storage_Module",
        "Lyra_LP_Module",
        "Lyra_Options_Module",
        "Rysk_Options_Module",
        "Aave_Lending_Module",
        "TraderJoe_Legacy_LP_Module",
        "TraderJoe_LP_Module",
        "TraderJoe_Swap_Module",
        "Inch_Swap_Module",
        "Inch_LimitOrder_Module",
      ],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_ETH",
      include: [
        "TraderV0",
        "GMX_Swap_Module",
        "GMX_PositionRouter_Module",
        "GMX_OrderBook_Module",
        "GMX_GLP_Module",
        "Camelot_LP_Module",
        "Camelot_NFTPool_Module",
        "Camelot_NitroPool_Module",
        "Camelot_Swap_Module",
        "Camelot_Storage_Module",
        "Lyra_Storage_Module",
        "Lyra_LP_Module",
        "Lyra_Options_Module",
        "Rysk_LP_Module",
        "Rysk_Options_Module",
        "Aave_Lending_Module",
        "TraderJoe_Legacy_LP_Module",
        "TraderJoe_LP_Module",
        "TraderJoe_Swap_Module",
        "Inch_Swap_Module",
        "Inch_LimitOrder_Module",
      ],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_GLP",
      include: [
        "TraderV0",
        "GMX_Swap_Module",
        "GMX_PositionRouter_Module",
        "GMX_OrderBook_Module",
        "GMX_GLP_Module",
        "Camelot_Swap_Module",
        "Lyra_Storage_Module",
        "Lyra_LP_Module",
        "Lyra_Options_Module",
        "Rysk_Options_Module",
        "Aave_Lending_Module",
        "TraderJoe_Legacy_LP_Module",
        "TraderJoe_LP_Module",
        "TraderJoe_Swap_Module",
        "Inch_Swap_Module",
        "Inch_LimitOrder_Module",
      ],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_GM",
      include: ["TraderV0", "GMX_Swap_Module", "GMX_PositionRouter_Module", "GMX_OrderBook_Module"],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_TrivialStrategy",
      include: ["TraderV0"],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_DSQRescue",
      include: ["TraderV0", "DSQ_Rescue_Module"],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_GLPModule",
      include: ["TraderV0", "GMX_GLP_Module"],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_Camelot",
      include: [
        "TraderV0",
        "Camelot_LP_Module",
        "Camelot_NFTPool_Module",
        "Camelot_NitroPool_Module",
        "Camelot_Swap_Module",
        "Camelot_Storage_Module",
        "Camelot_V3_Module",
      ],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_Aave",
      include: ["TraderV0", "Aave_Lending_Module"],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_Lyra",
      include: ["TraderV0", "Lyra_Storage_Module", "Lyra_LP_Module", "Lyra_Options_Module", "Lyra_Rewards_Module"],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_Rysk",
      include: ["TraderV0", "Rysk_LP_Module", "Rysk_Options_Module"],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_Inch",
      include: ["TraderV0", "Inch_Swap_Module"],
      strict: true,
      filter: diamondAbi_filter(),
    },
    {
      name: "StrategyDiamond_TestFixture_TraderJoe",
      include: ["TraderV0", "TraderJoe_Legacy_LP_Module", "TraderJoe_LP_Module", "TraderJoe_Swap_Module"],
      strict: true,
      filter: diamondAbi_filter(),
    },
  ],
  networks: {
    hardhat: getHardhatNetworkConfig(),
    goerli: {
      url: process.env.GOERLI_URL || "",
      accounts: process.env.PRIVATE_KEY
        ? [`${process.env.PRIVATE_KEY}`]
        : ["0000000000000000000000000000000000000000000000000000000000000000"],
      network_id: 5,
    },

    avax: {
      url: process.env.AVAX_URL || "",
      accounts: process.env.PRIVATE_KEY_PROD
        ? [`${process.env.PRIVATE_KEY_PROD}`]
        : ["0000000000000000000000000000000000000000000000000000000000000000"],
      network_id: 43114,
    },

    arbitrum: {
      url: process.env.ARBITRUM_URL || "",
      accounts: process.env.PRIVATE_KEY_PROD
        ? [`${process.env.PRIVATE_KEY_PROD}`]
        : ["0000000000000000000000000000000000000000000000000000000000000000"],
      network_id: 42161,
    },
  },

  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      avalanche: process.env.AVAX_API_KEY,
      arbitrumOne: process.env.ARBITRUM_API_KEY,
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP,
  },
};
