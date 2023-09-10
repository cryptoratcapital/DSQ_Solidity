// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../../external/chainlink_interfaces/IAggregatorV3Interface.sol";
import "../../dsq/DSQ_Common_Roles.sol";

/**
 * @title   DSquared Inch LimitOrder Storage
 * @notice  Stores "signed" hashes and oracles for Inch Limit Order Module
 * @dev     Storage follows diamond pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Inch_LimitOrder_Storage is DSQ_Common_Roles {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    struct InchLimitOrderStorage {
        /// @notice  Enumerable set of valid order hashes
        EnumerableSet.Bytes32Set signedHashes;
        /// @notice  Asset to oracle mapping
        mapping(address => IAggregatorV3Interface) assetToOracle;
    }

    /// @dev    EIP-2535 Diamond Storage struct location
    bytes32 internal constant INCH_POSITION = bytes32(uint256(keccak256("Inch_LimitOrder.storage")) - 1);

    /**
     * @return  storageStruct   InchLimitOrderStorage storage pointer
     */
    function getInchLimitOrderStorage() internal pure returns (InchLimitOrderStorage storage storageStruct) {
        bytes32 position = INCH_POSITION;
        // solhint-disable no-inline-assembly
        assembly {
            storageStruct.slot := position
        }
    }

    // --------- Views ---------

    /**
     * @notice  Returns all valid order hashes
     * @return  Array of valid order hashes
     */
    function inch_getHashes() external view returns (bytes32[] memory) {
        return getInchLimitOrderStorage().signedHashes.values();
    }

    /**
     * @notice  Returns the oracle address for an asset
     * @param   asset   Token address
     * @return  Oracle address
     */
    function inch_getOracleForAsset(address asset) external view returns (address) {
        return address(getInchLimitOrderStorage().assetToOracle[asset]);
    }

    // --------- Internal Functions ---------

    /**
     * @notice  Returns true if given a valid order hash
     * @param   _hash   Limit order hash
     * @return  True if valid hash, false if invalid hash
     */
    function validateHash(bytes32 _hash) internal view returns (bool) {
        return getInchLimitOrderStorage().signedHashes.contains(_hash);
    }

    /**
     * @notice  Adds a hash to the signedHashes set
     * @param   _hash   Limit order hash
     */
    function addHash(bytes32 _hash) internal {
        getInchLimitOrderStorage().signedHashes.add(_hash);
    }

    /**
     * @notice  Removes a hash from the signedHashes set
     * @param   _hash   Limit order hash
     */
    function removeHash(bytes32 _hash) internal {
        getInchLimitOrderStorage().signedHashes.remove(_hash);
    }
}
