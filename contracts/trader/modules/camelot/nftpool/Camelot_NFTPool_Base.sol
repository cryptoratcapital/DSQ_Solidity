// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "../storage/Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/INFTPool.sol";
import "../../../external/camelot_interfaces/INFTPoolFactory.sol";

/**
 * @title   DSquared Camelot NFTPool Base
 * @notice  Allows integration with Camelot NFT Pools
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the pool address is valid
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_NFTPool_Base is AccessControl, ReentrancyGuard, Camelot_Common_Storage, IERC721Receiver {
    using SafeERC20 for IERC20;

    // ---------- Functions ----------

    /**
     * @notice  Creates a position in a Camelot NFT pool
     * @param   _poolAddress    NFT pool address
     * @param   _amount         Amount of asset to add to position
     * @param   _lockDuration   Lock duration for the position
     */
    function camelot_nftpool_createPosition(
        address _poolAddress,
        uint256 _amount,
        uint256 _lockDuration
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_createPosition(_poolAddress, _amount, _lockDuration);

        (address pair, , , , , , , ) = INFTPool(_poolAddress).getPoolInfo();
        IERC20(pair).approve(_poolAddress, _amount);

        INFTPool(_poolAddress).createPosition(_amount, _lockDuration);
    }

    /**
     * @notice  Adds to a position in a Camelot NFT pool
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     * @param   _amountToAdd    Amount to add to position
     */
    function camelot_nftpool_addToPosition(
        address _poolAddress,
        uint256 _tokenId,
        uint256 _amountToAdd
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_addToPosition(_poolAddress, _tokenId, _amountToAdd);

        (address pair, , , , , , , ) = INFTPool(_poolAddress).getPoolInfo();
        IERC20(pair).approve(_poolAddress, _amountToAdd);

        INFTPool(_poolAddress).addToPosition(_tokenId, _amountToAdd);
    }

    /**
     * @notice  Harvests rewards from an NFT pool position
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     */
    function camelot_nftpool_harvestPosition(address _poolAddress, uint256 _tokenId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_harvestPosition(_poolAddress, _tokenId);

        INFTPool(_poolAddress).harvestPosition(_tokenId);
    }

    /**
     * @notice  Withdraws from an NFT pool position
     * @param   _poolAddress        NFT pool address
     * @param   _tokenId            Token id of position
     * @param   _amountToWithdraw   Amount to withdraw
     */
    function camelot_nftpool_withdrawFromPosition(
        address _poolAddress,
        uint256 _tokenId,
        uint256 _amountToWithdraw
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_withdrawFromPosition(_poolAddress, _tokenId, _amountToWithdraw);

        INFTPool(_poolAddress).withdrawFromPosition(_tokenId, _amountToWithdraw);
    }

    /**
     * @notice  Renews a current lock on an NFT pool position
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     */
    function camelot_nftpool_renewLockPosition(address _poolAddress, uint256 _tokenId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_renewLockPosition(_poolAddress, _tokenId);

        INFTPool(_poolAddress).renewLockPosition(_tokenId);
    }

    /**
     * @notice  Locks an NFT pool position
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     * @param   _lockDuration   Duration to lock position
     */
    function camelot_nftpool_lockPosition(
        address _poolAddress,
        uint256 _tokenId,
        uint256 _lockDuration
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_lockPosition(_poolAddress, _tokenId, _lockDuration);

        INFTPool(_poolAddress).lockPosition(_tokenId, _lockDuration);
    }

    /**
     * @notice  Splits an NFT pool position into two positions
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     * @param   _splitAmount    Amount to split into a new position
     */
    function camelot_nftpool_splitPosition(
        address _poolAddress,
        uint256 _tokenId,
        uint256 _splitAmount
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_splitPosition(_poolAddress, _tokenId, _splitAmount);

        INFTPool(_poolAddress).splitPosition(_tokenId, _splitAmount);
    }

    /**
     * @notice  Merges two NFT pool positions
     * @param   _poolAddress    NFT pool address
     * @param   _tokenIds       NFT pool token ids
     * @param   _lockDuration   Lock duration
     */
    function camelot_nftpool_mergePositions(
        address _poolAddress,
        uint256[] calldata _tokenIds,
        uint256 _lockDuration
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_mergePositions(_poolAddress, _tokenIds, _lockDuration);

        INFTPool(_poolAddress).mergePositions(_tokenIds, _lockDuration);
    }

    /**
     * @notice  Emergency withdraws from NFT pool
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        NFT pool token id
     */
    function camelot_nftpool_emergencyWithdraw(address _poolAddress, uint256 _tokenId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nftpool_emergencyWithdraw(_poolAddress, _tokenId);

        INFTPool(_poolAddress).emergencyWithdraw(_tokenId);
    }

    // ---------- Callbacks ----------

    /**
     * @notice Returns 'IERC721.onERC721Received.selector'
     */
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @notice Returns true to represent a valid NFT harvester
     */
    function onNFTHarvest(
        address, // operator
        address, // to
        uint256, // tokenId
        uint256, // grailAmount
        uint256 // xGrailAmount
    ) external pure returns (bool) {
        return true;
    }

    /**
     * @notice Returns true to represent a valid NFT position handler
     */
    // (address operator, uint256 tokenId, uint256 lpAmount)
    function onNFTAddToPosition(address, uint256, uint256) external pure returns (bool) {
        return true;
    }

    /**
     * @notice Returns true to represent a valid NFT position handler
     */
    // (address operator, uint256 tokenId, uint256 lpAmount)
    function onNFTWithdraw(address, uint256, uint256) external pure returns (bool) {
        return true;
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for camelot_nftpool_createPosition
     * @param   _poolAddress    NFT pool address
     * @param   _amount         Amount of asset to add to position
     * @param   _lockDuration   Lock duration for the position
     */
    function inputGuard_camelot_nftpool_createPosition(address _poolAddress, uint256 _amount, uint256 _lockDuration) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nftpool_addToPosition
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     * @param   _amountToAdd    Amount to add to position
     */
    function inputGuard_camelot_nftpool_addToPosition(address _poolAddress, uint256 _tokenId, uint256 _amountToAdd) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nftpool_harvestPosition
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     */
    function inputGuard_camelot_nftpool_harvestPosition(address _poolAddress, uint256 _tokenId) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nftpool_withdrawFromPosition
     * @param   _poolAddress        NFT pool address
     * @param   _tokenId            Token id of position
     * @param   _amountToWithdraw   Amount to withdraw
     */
    function inputGuard_camelot_nftpool_withdrawFromPosition(
        address _poolAddress,
        uint256 _tokenId,
        uint256 _amountToWithdraw
    ) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nftpool_renewLockPosition
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     */
    function inputGuard_camelot_nftpool_renewLockPosition(address _poolAddress, uint256 _tokenId) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nftpool_lockPosition
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     * @param   _lockDuration   Duration to lock position
     */
    function inputGuard_camelot_nftpool_lockPosition(address _poolAddress, uint256 _tokenId, uint256 _lockDuration) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nftpool_splitPosition
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        Token id of position
     * @param   _splitAmount    Amount to split into a new position
     */
    function inputGuard_camelot_nftpool_splitPosition(address _poolAddress, uint256 _tokenId, uint256 _splitAmount) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nftpool_mergePositions
     * @param   _poolAddress    NFT pool address
     * @param   _tokenIds       NFT pool token ids
     * @param   _lockDuration   Lock duration
     */
    function inputGuard_camelot_nftpool_mergePositions(
        address _poolAddress,
        uint256[] calldata _tokenIds,
        uint256 _lockDuration
    ) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nftpool_emergencyWithdraw
     * @param   _poolAddress    NFT pool address
     * @param   _tokenId        NFT pool token id
     */
    function inputGuard_camelot_nftpool_emergencyWithdraw(address _poolAddress, uint256 _tokenId) internal virtual {}
    // solhint-enable no-empty-blocks
}
