// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../../dsq/DSQ_Common_Roles.sol";

/**
 * @title   DSquared Camelot Common Storage
 * @notice  Protocol addresses and constants used by all Camelot modules
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_Common_Storage is DSQ_Common_Roles {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct CamelotCommonStorage {
        /// @notice Set of allowed Camelot NFT pools
        EnumerableSet.AddressSet allowedNFTPools;
        /// @notice Set of allowed Camelot nitro pools
        EnumerableSet.AddressSet allowedNitroPools;
        /// @notice Set of allowed Odos executors
        EnumerableSet.AddressSet allowedExecutors;
        /// @notice Set of allowed Camelot V3 pools to be input receivers
        EnumerableSet.AddressSet allowedReceivers;
    }

    /// @dev    EIP-2535 Diamond Storage struct location
    bytes32 internal constant CAMELOT_POSITION = bytes32(uint256(keccak256("Camelot_Common.storage")) - 1);

    function getCamelotCommonStorage() internal pure returns (CamelotCommonStorage storage storageStruct) {
        bytes32 position = CAMELOT_POSITION;
        // solhint-disable no-inline-assembly
        assembly {
            storageStruct.slot := position
        }
    }

    // --------- Internal Functions ---------

    /**
     * @notice  Validates a Camelot NFT pool
     * @param   _pool   Pool address
     */
    function validateNFTPool(address _pool) internal view {
        require(getCamelotCommonStorage().allowedNFTPools.contains(_pool), "Invalid NFT Pool");
    }

    /**
     * @notice  Validates a Camelot nitro pool
     * @param   _pool   Pool address
     */
    function validateNitroPool(address _pool) internal view {
        require(getCamelotCommonStorage().allowedNitroPools.contains(_pool), "Invalid Nitro Pool");
    }

    /**
     * @notice  Validates an Odos executor
     * @param   _executor   Executor address
     */
    function validateExecutor(address _executor) internal view {
        require(getCamelotCommonStorage().allowedExecutors.contains(_executor), "Invalid Executor");
    }

    /**
     * @notice  Validates an Odos input receiver
     * @param   _receiver   Input receiver address
     */
    function validateReceiver(address _receiver) internal view {
        require(getCamelotCommonStorage().allowedReceivers.contains(_receiver), "Invalid Receiver");
    }
}
