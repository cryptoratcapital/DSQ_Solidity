// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Camelot_NFTPool_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";
import "../../../external/camelot_interfaces/INFTPool.sol";

/**
 * @title   DSquared Camelot NFTPool Module
 * @notice  Allows integration with Camelot NFT Pools
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Camelot_NFTPool_Module is Camelot_NFTPool_Base, DSQ_Trader_Storage {
    // ---------- Input Guards ----------

    /// @inheritdoc Camelot_NFTPool_Base
    function inputGuard_camelot_nftpool_createPosition(
        address _poolAddress,
        uint256, //_amount
        uint256 _lockDuration
    ) internal view override {
        validateNFTPool(_poolAddress);
        Epoch memory currentInfo = getTraderV0Storage().vault.getCurrentEpochInfo();
        // solhint-disable-next-line reason-string
        require(block.timestamp + _lockDuration < currentInfo.epochEnd, "InputGuard: Invalid lock duration");
    }

    /// @inheritdoc Camelot_NFTPool_Base
    // (address _poolAddress, uint256 _tokenId, uint256 _amountToAdd)
    function inputGuard_camelot_nftpool_addToPosition(address _poolAddress, uint256, uint256) internal view override {
        validateNFTPool(_poolAddress);
    }

    /// @inheritdoc Camelot_NFTPool_Base
    // (address _poolAddress, uint256 _tokenId)
    function inputGuard_camelot_nftpool_harvestPosition(address _poolAddress, uint256) internal view override {
        validateNFTPool(_poolAddress);
    }

    /// @inheritdoc Camelot_NFTPool_Base
    function inputGuard_camelot_nftpool_withdrawFromPosition(
        address _poolAddress,
        uint256, // _tokenId
        uint256 // _amountToWithdraw
    ) internal view override {
        validateNFTPool(_poolAddress);
    }

    /// @inheritdoc Camelot_NFTPool_Base
    function inputGuard_camelot_nftpool_renewLockPosition(address _poolAddress, uint256 _tokenId) internal view override {
        validateNFTPool(_poolAddress);
        Epoch memory currentInfo = getTraderV0Storage().vault.getCurrentEpochInfo();
        (, , , uint256 _lockDuration, , , , ) = INFTPool(_poolAddress).getStakingPosition(_tokenId);
        // solhint-disable-next-line reason-string
        require(block.timestamp + _lockDuration < currentInfo.epochEnd, "InputGuard: Invalid lock duration");
    }

    /// @inheritdoc Camelot_NFTPool_Base
    // (address _poolAddress, uint256 _tokenId, uint256 _lockDuration)
    function inputGuard_camelot_nftpool_lockPosition(address _poolAddress, uint256, uint256 _lockDuration) internal view override {
        validateNFTPool(_poolAddress);
        Epoch memory currentInfo = getTraderV0Storage().vault.getCurrentEpochInfo();
        // solhint-disable-next-line reason-string
        require(block.timestamp + _lockDuration < currentInfo.epochEnd, "InputGuard: Invalid lock duration");
    }

    /// @inheritdoc Camelot_NFTPool_Base
    // (address _poolAddress, uint256 _tokenId, uint256 _splitAmount)
    function inputGuard_camelot_nftpool_splitPosition(address _poolAddress, uint256, uint256) internal view override {
        validateNFTPool(_poolAddress);
    }

    /// @inheritdoc Camelot_NFTPool_Base
    function inputGuard_camelot_nftpool_mergePositions(
        address _poolAddress,
        uint256[] calldata, //_tokenIds
        uint256 _lockDuration
    ) internal view override {
        validateNFTPool(_poolAddress);
        Epoch memory currentInfo = getTraderV0Storage().vault.getCurrentEpochInfo();
        // solhint-disable-next-line reason-string
        require(block.timestamp + _lockDuration < currentInfo.epochEnd, "InputGuard: Invalid lock duration");
    }

    /// @inheritdoc Camelot_NFTPool_Base
    // (address _poolAddress, uint256 _tokenId)
    function inputGuard_camelot_nftpool_emergencyWithdraw(address _poolAddress, uint256) internal view override {
        validateNFTPool(_poolAddress);
    }
}
