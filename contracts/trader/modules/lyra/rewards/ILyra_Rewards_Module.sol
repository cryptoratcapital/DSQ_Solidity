// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

/**
 * @title   DSquared Lyra Rewards Module Interface
 * @notice  Allows claiming rewards from Lyra MultiDistributor
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ILyra_Rewards_Module {
    function lyra_claimRewards() external;

    function lyra_dump(address _outputToken, uint256 _arbSwapMinOut, uint256 _lyraSwapMinOut) external;
}
