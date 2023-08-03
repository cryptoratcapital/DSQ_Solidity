// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../dsq/DSQ_Common_Roles.sol";

/**
 * @title   DSquared Lyra Common Storage
 * @notice  Protocol addresses, constants, and functions used by all Lyra modules
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Lyra_Common_Storage is DSQ_Common_Roles {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ----- State Variables -----

    struct LyraCommonStorage {
        /// @notice Allowed Lyra markets
        EnumerableSet.AddressSet allowedLyraMarkets;
        /// @notice Allowed Lyra pools
        EnumerableSet.AddressSet allowedLyraPools;
    }

    /// @dev    EIP-2535 Diamond Storage struct location
    bytes32 internal constant LYRA_POSITION = keccak256("Lyra_Common.storage");

    /**
     * @return  storageStruct   LyraCommonStorage storage pointer
     */
    function getLyraCommonStorage() internal pure returns (LyraCommonStorage storage storageStruct) {
        bytes32 position = LYRA_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            storageStruct.slot := position
        }
    }

    /**
     * @notice  Validates a Lyra market
     * @param   _market Lyra market address
     */
    function validateLyraMarket(address _market) internal view {
        require(getLyraCommonStorage().allowedLyraMarkets.contains(_market), "Invalid market");
    }

    /**
     * @notice  Validates a Lyra pool
     * @param   _pool   Lyra pool address
     */
    function validateLyraPool(address _pool) internal view {
        require(getLyraCommonStorage().allowedLyraPools.contains(_pool), "Invalid pool");
    }
}
