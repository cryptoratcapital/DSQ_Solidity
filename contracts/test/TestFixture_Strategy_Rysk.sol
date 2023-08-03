// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../trader/diamonds/StrategyDiamond.sol";
import "../trader/trader/ITraderV0.sol";
import "../trader/trader/TraderV0_Cutter.sol";
import "../trader/modules/rysk/lp/Rysk_LP_Cutter.sol";
import "../trader/modules/rysk/options/Rysk_Options_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 * @title   TestFixture_Strategy_RyskModule
 * @notice  Tests Rysk modules
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 */
contract TestFixture_Strategy_Rysk is StrategyDiamond, TraderV0_Cutter, Rysk_LP_Cutter, Rysk_Options_Cutter {
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address _lpFacet,
        address _optionsFacet
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_Rysk_LP(_lpFacet);
        cut_Rysk_Options(_optionsFacet);
    }
}
