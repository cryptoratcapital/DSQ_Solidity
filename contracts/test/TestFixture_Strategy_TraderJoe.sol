// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../trader/diamonds/StrategyDiamond.sol";
import "../trader/trader/ITraderV0.sol";
import "../trader/trader/TraderV0_Cutter.sol";
import "../trader/modules/traderjoe/swap/TraderJoe_Swap_Cutter.sol";
import "../trader/modules/traderjoe/legacy_lp/TraderJoe_Legacy_LP_Cutter.sol";
import "../trader/modules/traderjoe/lp/TraderJoe_LP_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 * @title   TestFixture_Strategy_TraderJoeModule
 * @notice  Tests Trader Joe modules
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 */
contract TestFixture_Strategy_TraderJoe is
    StrategyDiamond,
    TraderV0_Cutter,
    TraderJoe_Swap_Cutter,
    TraderJoe_Legacy_LP_Cutter,
    TraderJoe_LP_Cutter
{
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address _TraderJoe_Swap_Facet,
        address _TraderJoe_Legacy_LP_Facet,
        address _TraderJoe_LP_Facet
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_TraderJoe_Swap(_TraderJoe_Swap_Facet);
        cut_TraderJoe_Legacy_LP(_TraderJoe_Legacy_LP_Facet);
        cut_TraderJoe_LP(_TraderJoe_LP_Facet);
    }
}
