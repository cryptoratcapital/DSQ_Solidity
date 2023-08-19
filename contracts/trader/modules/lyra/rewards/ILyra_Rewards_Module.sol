// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title   DSquared Lyra Rewards Module Interface
 * @notice  Allows claiming rewards from Lyra MultiDistributor
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ILyra_Rewards_Module {
    function lyra_claimRewards(IERC20[] memory _tokens) external;

    struct SwapInput {
        address[] path;
        uint256 minOut;
    }

    function lyra_claimAndDump(IERC20[] memory _tokens, SwapInput[] memory _inputs) external;

    function lyra_dump(SwapInput[] memory _inputs) external;
}
