// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../diamonds/StrategyDiamond.sol";
import "../trader/ITraderV0.sol";
import "../trader/TraderV0_Cutter.sol";
import "../modules/gmx/swap/GMX_Swap_Cutter.sol";
import "../modules/gmx/position/GMX_PositionRouter_Cutter.sol";
import "../modules/gmx/orderbook/GMX_OrderBook_Cutter.sol";
import "../modules/gmx/glp/GMX_GLP_Cutter.sol";
import "../modules/camelot/lp/Camelot_LP_Cutter.sol";
import "../modules/camelot/nftpool/Camelot_NFTPool_Cutter.sol";
import "../modules/camelot/nitropool/Camelot_NitroPool_Cutter.sol";
import "../modules/camelot/swap/Camelot_Swap_Cutter.sol";
import "../modules/camelot/v3LP/Camelot_V3LP_Cutter.sol";
import "../modules/camelot/v3Swap/Camelot_V3Swap_Cutter.sol";
import "../modules/camelot/storage/Camelot_Storage_Cutter.sol";
import "../modules/lyra/storage/Lyra_Storage_Cutter.sol";
import "../modules/lyra/lp/Lyra_LP_Cutter.sol";
import "../modules/lyra/options/Lyra_Options_Cutter.sol";
import "../modules/lyra/rewards/Lyra_Rewards_Cutter.sol";
import "../modules/aave/Aave_Lending_Cutter.sol";
import "../modules/traderjoe/swap/TraderJoe_Swap_Cutter.sol";
import "../modules/traderjoe/legacy_lp/TraderJoe_Legacy_LP_Cutter.sol";
import "../modules/traderjoe/lp/TraderJoe_LP_Cutter.sol";
import "../modules/inch/swap/Inch_Swap_Cutter.sol";
import "../modules/inch/limitorder/Inch_LimitOrder_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 *
 * @title   ETH++ Strategy
 * @notice  Executes the ETH++ trading strategy
 * @dev     Integrated protocols:
 *          - GMX
 *              - Swaps
 *              - Limit Orders
 *              - Leverage Positions
 *              - GLP
 *          - Camelot
 *              - Swap
 *              - LP
 *          - Lyra
 *              - Options
 *              - LP
 *              - Rewards
 *          - Aave
 *              - Lending and borrowing
 *          - TraderJoe
 *              - Swaps
 *              - LP
 *          - 1inch
 *              - Swaps
 *              - Limit Order
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 * @custom:version      1.0.0
 */
contract Strategy_ETH is
    StrategyDiamond,
    TraderV0_Cutter,
    GMX_Swap_Cutter,
    GMX_PositionRouter_Cutter,
    GMX_OrderBook_Cutter,
    GMX_GLP_Cutter,
    Camelot_LP_Cutter,
    Camelot_NFTPool_Cutter,
    Camelot_NitroPool_Cutter,
    Camelot_Swap_Cutter,
    Camelot_V3LP_Cutter,
    Camelot_V3Swap_Cutter,
    Camelot_Storage_Cutter,
    Lyra_Storage_Cutter,
    Lyra_LP_Cutter,
    Lyra_Options_Cutter,
    Lyra_Rewards_Cutter,
    Aave_Lending_Cutter,
    TraderJoe_Swap_Cutter,
    TraderJoe_Legacy_LP_Cutter,
    TraderJoe_LP_Cutter,
    Inch_Swap_Cutter,
    Inch_LimitOrder_Cutter
{
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address[] memory _facets,
        address[] memory _assets,
        address[] memory _oracles
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_GMX_Swap(_facets[0]);
        cut_GMX_PositionRouter(_facets[1]);
        cut_GMX_OrderBook(_facets[2]);
        cut_GMX_GLP(_facets[3]);
        cut_Camelot_LP(_facets[4]);
        cut_Camelot_NFTPool(_facets[5]);
        cut_Camelot_NitroPool(_facets[6]);
        cut_Camelot_Swap(_facets[7]);
        cut_Camelot_V3LP(_facets[8]);
        cut_Camelot_V3Swap(_facets[9]);
        cut_Camelot_Storage(_facets[10]);
        cut_Lyra_Storage(_facets[11]);
        cut_Lyra_LP(_facets[12]);
        cut_Lyra_Options(_facets[13]);
        cut_Lyra_Rewards(_facets[14]);
        cut_Aave_Lending(_facets[15]);
        cut_TraderJoe_Swap(_facets[16]);
        cut_TraderJoe_Legacy_LP(_facets[17]);
        cut_TraderJoe_LP(_facets[18]);
        cut_Inch_Swap(_facets[19]);
        cut_Inch_LimitOrder(_facets[20], _assets, _oracles);
    }
}
