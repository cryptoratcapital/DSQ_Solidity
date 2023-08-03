// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../trader/diamonds/StrategyDiamond.sol";
import "../trader/trader/ITraderV0.sol";
import "../trader/trader/TraderV0_Cutter.sol";
import "../trader/modules/gmx/glp/GMX_GLP_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 * @title   TestFixture_Strategy_GLPModule
 * @notice  Tests GMX GLP module
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 */
contract TestFixture_Strategy_GLPModule is StrategyDiamond, TraderV0_Cutter, GMX_GLP_Cutter {
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address _glpFacet
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_GMX_GLP(_glpFacet);
    }
}
