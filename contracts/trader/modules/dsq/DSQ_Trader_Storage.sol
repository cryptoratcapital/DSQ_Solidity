// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../../../interfaces/IVault.sol";

/**
 * @title   DSquared DSQ Trader Storage
 * @notice  Contains storage variables and functions common to all traders
 * @dev     Storage follows diamond pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract DSQ_Trader_Storage {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct TraderV0Storage {
        /// @notice Strategy name
        string name;
        /// @notice Address receiving fees
        address feeReceiver;
        /// @notice Vault address
        IVault vault;
        /// @notice Underlying asset of the strategy's vault
        IERC20 baseAsset;
        /// @notice Performance fee as percentage of profits, in units of 1e18 = 100%
        uint256 performanceFeeRate;
        /// @notice Management fee as percentage of base assets, in units of 1e18 = 100%
        uint256 managementFeeRate;
        /// @notice Timestamp when funds were taken into custody, in Unix epoch seconds
        uint256 custodyTime;
        /// @notice Amount of base asset taken into custody
        uint256 custodiedAmount;
        /// @notice Accumulated management and performance fees
        uint256 totalFees;
        /// @notice Tokens which can be held or handled by this contract
        EnumerableSet.AddressSet allowedTokens;
        /// @notice Addresses which can be approved by this contract
        EnumerableSet.AddressSet allowedSpenders;
        /// @notice Whether the contract has been initialized
        bool initialized;
    }

    /// @dev    EIP-2535 Diamond Storage struct location
    bytes32 internal constant TRADERV0_POSITION = keccak256("TraderV0.storage");

    /**
     * @return  storageStruct   TraderV0Storage storage pointer
     */
    function getTraderV0Storage() internal pure returns (TraderV0Storage storage storageStruct) {
        bytes32 position = TRADERV0_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            storageStruct.slot := position
        }
    }

    // --------- Internal Functions ---------

    /**
     * @notice  Validates a swap path
     * @param   _path   Array of token addresses to validate
     */
    function validateSwapPath(address[] memory _path) internal view {
        TraderV0Storage storage s = getTraderV0Storage();
        uint256 len = _path.length;
        for (uint256 i; i < len; ) {
            require(s.allowedTokens.contains(_path[i]), "Invalid swap path");
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice  Validates a single token address
     * @param   _token  Address of token to validate
     */
    function validateToken(address _token) internal view {
        require(getTraderV0Storage().allowedTokens.contains(_token), "Invalid token");
    }
}
