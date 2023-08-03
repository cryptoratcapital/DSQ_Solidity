// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../diamonds/StrategyDiamond.sol";
import "../trader/ITraderV0.sol";
import "../trader/TraderV0_Cutter.sol";
import "../modules/gmx/swap/GMX_Swap_Cutter.sol";
import "../modules/gmx/position/GMX_PositionRouter_Cutter.sol";
import "../modules/gmx/orderbook/GMX_OrderBook_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 * @title   GM++ Strategy
 * @notice  Executes the GM++ trading strategy
 * @dev     Integrated protocols:
 *          - GMX
 *              - Swaps
 *              - Limit Orders
 *              - Leverage Positions
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 * @custom:version      1.0.0
 */
contract Strategy_GM is StrategyDiamond, TraderV0_Cutter, GMX_Swap_Cutter, GMX_PositionRouter_Cutter, GMX_OrderBook_Cutter {
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address[] memory _facets
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_GMX_Swap(_facets[0]);
        cut_GMX_PositionRouter(_facets[1]);
        cut_GMX_OrderBook(_facets[2]);
    }
}
