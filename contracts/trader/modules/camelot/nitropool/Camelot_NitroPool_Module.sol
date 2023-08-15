// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Camelot_NitroPool_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";
import "../../../external/camelot_interfaces/INitroPoolFactory.sol";

/**
 * @title   DSquared Camelot NitroPool Module
 * @notice  Allows integration with Camelot Nitro Pools
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Camelot_NitroPool_Module is Camelot_NitroPool_Base {
    // ---------- Input Guards ----------

    /// @inheritdoc Camelot_NitroPool_Base
    function inputGuard_camelot_nitropool_transfer(
        address _nitroPoolAddress,
        address _nftPoolAddress,
        uint256 // _tokenId
    ) internal view override {
        validateNFTPool(_nftPoolAddress);
        validateNitroPool(_nitroPoolAddress);
    }

    /// @inheritdoc Camelot_NitroPool_Base
    // (address _nitroPoolAddress, uint256 _tokenId)
    function inputGuard_camelot_nitropool_withdraw(address _nitroPoolAddress, uint256) internal view override {
        validateNitroPool(_nitroPoolAddress);
    }

    /// @inheritdoc Camelot_NitroPool_Base
    // (address _nitroPoolAddress, uint256 _tokenId)
    function inputGuard_camelot_nitropool_emergencyWithdraw(address _nitroPoolAddress, uint256) internal view override {
        validateNitroPool(_nitroPoolAddress);
    }

    /// @inheritdoc Camelot_NitroPool_Base
    function inputGuard_camelot_nitropool_harvest(address _nitroPoolAddress) internal view override {
        validateNitroPool(_nitroPoolAddress);
    }
}
