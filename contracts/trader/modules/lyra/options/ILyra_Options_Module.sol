// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/lyra_interfaces/IOptionMarket.sol";

/**
 * @title   DSquared Lyra Options Module Interface
 * @notice  Allows opening and closing options positions via the Lyra OptionMarket Contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ILyra_Options_Module {
    function lyra_openPosition(address market, IOptionMarket.TradeInputParameters memory params) external;

    function lyra_addCollateral(address market, uint256 positionId, uint256 amountCollateral) external;

    function lyra_closePosition(address market, IOptionMarket.TradeInputParameters memory params) external;

    function lyra_forceClosePosition(address market, IOptionMarket.TradeInputParameters memory params) external;
}
