// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../trader/diamonds/StrategyDiamond.sol";
import "../trader/trader/ITraderV0.sol";
import "../trader/trader/TraderV0_Cutter.sol";
import "../trader/modules/aave/Aave_Lending_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 * @title   TestFixture_Strategy_AaveModule
 * @notice  Tests Aave module
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 */
contract TestFixture_Strategy_AaveModule is StrategyDiamond, TraderV0_Cutter, Aave_Lending_Cutter {
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address _AaveFacet
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_Aave_Lending(_AaveFacet);
    }
}
