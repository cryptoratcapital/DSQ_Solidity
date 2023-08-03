// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

/**
 * @title   DSquared Camelot NitroPool Module Interface
 * @notice  Allows integration with Camelot Nitro Pools
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ICamelot_NitroPool_Module {
    // ---------- Functions ----------

    function camelot_nitropool_transfer(address _nitroPoolAddress, address _nftPoolAddress, uint256 _tokenId) external;

    function camelot_nitropool_withdraw(address _poolAddress, uint256 _tokenId) external;

    function camelot_nitropool_emergencyWithdraw(address _poolAddress, uint256 _tokenId) external;

    function camelot_nitropool_harvest(address _poolAddress) external;
}
