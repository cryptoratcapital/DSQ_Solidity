// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../storage/Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/INitroPool.sol";

/**
 * @title   DSquared Camelot NitroPool Base
 * @notice  Allows integration with Camelot Nitro Pools
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the pool address is acceptable
 *              2. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_NitroPool_Base is AccessControl, ReentrancyGuard, Camelot_Common_Storage {
    // ---------- Functions ----------

    /**
     * @notice  Transfers an NFT pool token id to a Camelot nitro pool
     * @param   _nitroPoolAddress   Address of Camelot nitro pool
     * @param   _nftPoolAddress     Address of Camelot NFT pool
     * @param   _tokenId            Token id to transfer
     */
    function camelot_nitropool_transfer(
        address _nitroPoolAddress,
        address _nftPoolAddress,
        uint256 _tokenId
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nitropool_transfer(_nitroPoolAddress, _nftPoolAddress, _tokenId);

        IERC721(_nftPoolAddress).safeTransferFrom(address(this), _nitroPoolAddress, _tokenId);
    }

    /**
     * @notice  Withdraws an NFT pool token id from a Camelot nitro pool
     * @param   _poolAddress    Address of Camelot nitro pool
     * @param   _tokenId        Token id to withdraw
     */
    function camelot_nitropool_withdraw(address _poolAddress, uint256 _tokenId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nitropool_withdraw(_poolAddress, _tokenId);

        INitroPool(_poolAddress).withdraw(_tokenId);
    }

    /**
     * @notice  Emergency withdraws an NFT pool token id from a Camelot nitro pool
     * @param   _poolAddress    Address of Camelot nitro pool
     * @param   _tokenId        Token id to withdraw
     */
    function camelot_nitropool_emergencyWithdraw(address _poolAddress, uint256 _tokenId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nitropool_emergencyWithdraw(_poolAddress, _tokenId);

        INitroPool(_poolAddress).emergencyWithdraw(_tokenId);
    }

    /**
     * @notice  Harvests rewards from a Camelot nitro pool
     * @param   _poolAddress    Address of Camelot nitro pool
     */
    function camelot_nitropool_harvest(address _poolAddress) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_nitropool_harvest(_poolAddress);

        INitroPool(_poolAddress).harvest();
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for camelot_nitropool_transfer
     * @param   _nitroPoolAddress   Address of Camelot nitro pool
     * @param   _nftPoolAddress     Address of Camelot NFT pool
     * @param   _tokenId            Token id to transfer
     */
    function inputGuard_camelot_nitropool_transfer(address _nitroPoolAddress, address _nftPoolAddress, uint256 _tokenId) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nitropool_withdraw
     * @param   _poolAddress    Address of Camelot nitro pool
     * @param   _tokenId        Token id to withdraw
     */
    function inputGuard_camelot_nitropool_withdraw(address _poolAddress, uint256 _tokenId) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nitropool_emergencyWithdraw
     * @param   _poolAddress    Address of Camelot nitro pool
     * @param   _tokenId        Token id to withdraw
     */
    function inputGuard_camelot_nitropool_emergencyWithdraw(address _poolAddress, uint256 _tokenId) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_nitropool_harvest
     * @param   _poolAddress    Address of Camelot nitro pool
     */
    function inputGuard_camelot_nitropool_harvest(address _poolAddress) internal virtual {}
    // solhint-enable no-empty-blocks
}
