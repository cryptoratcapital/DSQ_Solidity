// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Lyra_Options_Base.sol";
import "../../../external/lyra_interfaces/IOptionMarket.sol";

/**
 * @title   DSquared Lyra Options Module
 * @notice  Allows opening and closing option positions via the Lyra OptionMarket Contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Lyra_Options_Module is Lyra_Options_Base {
    /// @inheritdoc Lyra_Options_Base
    function inputGuard_lyra_openPosition(
        address market,
        IOptionMarket.TradeInputParameters memory // params
    ) internal view override {
        validateLyraMarket(market);
    }

    // (address market, uint256 positionId, uint256 amountCollateral)
    /// @inheritdoc Lyra_Options_Base
    function inputGuard_lyra_addCollateral(address market, uint256, uint256) internal view override {
        validateLyraMarket(market);
    }

    /// @inheritdoc Lyra_Options_Base
    function inputGuard_lyra_closePosition(
        address market,
        IOptionMarket.TradeInputParameters memory // params
    ) internal view override {
        validateLyraMarket(market);
    }

    /// @inheritdoc Lyra_Options_Base
    function inputGuard_lyra_forceClosePosition(
        address market,
        IOptionMarket.TradeInputParameters memory // params
    ) internal view override {
        validateLyraMarket(market);
    }
}
