// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/lyra_interfaces/ILyraRegistry.sol";

/**
 * @title   DSquared Lyra Storage Module Interface
 * @notice  Protocol addresses, constants, and functions used by all Lyra modules
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ILyra_Storage_Module {
    // ----- Events -----

    event NewLyraMarket(address market, address pool);

    // --------- External Functions ---------

    function addLyraMarket(address _optionMarket) external;

    // --------- Views ---------

    function getAllowedLyraMarkets() external view returns (address[] memory);

    function getAllowedLyraPools() external view returns (address[] memory);

    function lyra_registry() external view returns (ILyraRegistry);
}
