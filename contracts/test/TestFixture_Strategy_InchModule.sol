// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../trader/diamonds/StrategyDiamond.sol";
import "../trader/trader/ITraderV0.sol";
import "../trader/trader/TraderV0_Cutter.sol";
import "../trader/modules/inch/swap/Inch_Swap_Cutter.sol";
import "../trader/modules/inch/limitorder/Inch_LimitOrder_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 * @title   TestFixture_Strategy_InchModule
 * @notice  Tests Inch module
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedOriole
 * @custom:developer    BowTiedPickle
 */

contract TestFixture_Strategy_InchModule is StrategyDiamond, TraderV0_Cutter, Inch_Swap_Cutter, Inch_LimitOrder_Cutter {
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address _InchSwapFacet,
        address _InchLimitOrderFacet,
        address[] memory _assets,
        address[] memory _oracles
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_Inch_Swap(_InchSwapFacet);
        cut_Inch_LimitOrder(_InchLimitOrderFacet, _assets, _oracles);
    }
}
