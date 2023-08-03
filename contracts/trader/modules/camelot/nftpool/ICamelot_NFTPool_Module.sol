// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

/**
 * @title   DSquared Camelot NFTPool Module Interface
 * @notice  Allows integration with Camelot NFT Pools
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ICamelot_NFTPool_Module {
    // ---------- Functions ----------

    function camelot_nftpool_createPosition(address _poolAddress, uint256 _amount, uint256 _lockDuration) external;

    function camelot_nftpool_addToPosition(address _poolAddress, uint256 _tokenId, uint256 _amountToAdd) external;

    function camelot_nftpool_harvestPosition(address _poolAddress, uint256 _tokenId) external;

    function camelot_nftpool_withdrawFromPosition(address _poolAddress, uint256 _tokenId, uint256 _amountToWithdraw) external;

    function camelot_nftpool_renewLockPosition(address _poolAddress, uint256 _tokenId) external;

    function camelot_nftpool_lockPosition(address _poolAddress, uint256 _tokenId, uint256 _lockDuration) external;

    function camelot_nftpool_splitPosition(address _poolAddress, uint256 _tokenId, uint256 _splitAmount) external;

    function camelot_nftpool_mergePositions(address _poolAddress, uint256[] calldata _tokenIds, uint256 _lockDuration) external;

    function camelot_nftpool_emergencyWithdraw(address _poolAddress, uint256 _tokenId) external;

    // ---------- Callbacks ----------

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4);

    function onNFTHarvest(
        address operator,
        address to,
        uint256 tokenId,
        uint256 grailAmount,
        uint256 xGrailAmount
    ) external pure returns (bool);

    function onNFTAddToPosition(address operator, uint256 tokenId, uint256 lpAmount) external pure returns (bool);

    function onNFTWithdraw(address operator, uint256 tokenId, uint256 lpAmount) external pure returns (bool);
}
