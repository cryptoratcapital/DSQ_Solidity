// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./Lyra_Common_Storage.sol";
import "../../../external/lyra_interfaces/ILyraRegistry.sol";

/**
 * @title   DSquared Lyra Storage Module
 * @notice  Manage supported Lyra markets
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Lyra_Storage_Module is AccessControl, Lyra_Common_Storage {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ----- Events -----

    event NewLyraMarket(address market, address pool);

    // ----- State Variables -----

    // solhint-disable var-name-mixedcase

    /// @notice Lyra registry address
    ILyraRegistry public immutable lyra_registry;

    /**
     * @notice  Sets the address of the Lyra registry
     * @param   _lyra_registry  Lyra registry address
     */
    constructor(address _lyra_registry) {
        // solhint-disable-next-line reason-string
        require(_lyra_registry != address(0), "Lyra_Storage_Module: Zero address");
        lyra_registry = ILyraRegistry(_lyra_registry);
    }

    // solhint-enable var-name-mixedcase

    // --------- External Functions ---------

    /**
     * @notice  Adds a Lyra market to allowedLyraMarkets
     * @param   _optionMarket   Lyra option market address
     */
    function addLyraMarket(address _optionMarket) external onlyRole(EXECUTOR_ROLE) {
        ILyraRegistry.OptionMarketAddresses memory addresses = lyra_registry.getMarketAddresses(_optionMarket);
        LyraCommonStorage storage s = getLyraCommonStorage();
        s.allowedLyraMarkets.add(addresses.optionMarket);
        s.allowedLyraPools.add(addresses.liquidityPool);
        emit NewLyraMarket(addresses.optionMarket, addresses.liquidityPool);
    }

    // --------- Views ---------

    /**
     * @notice  Returns all allowed Lyra markets
     */
    function getAllowedLyraMarkets() external view returns (address[] memory) {
        return getLyraCommonStorage().allowedLyraMarkets.values();
    }

    /**
     * @notice  Returns all allowed Lyra pools
     */
    function getAllowedLyraPools() external view returns (address[] memory) {
        return getLyraCommonStorage().allowedLyraPools.values();
    }
}
