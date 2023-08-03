// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../trader/diamonds/StrategyDiamond.sol";
import "../trader/trader/ITraderV0.sol";
import "../trader/trader/TraderV0_Cutter.sol";
import "../trader/modules/camelot/lp/Camelot_LP_Cutter.sol";
import "../trader/modules/camelot/v3/Camelot_V3_Cutter.sol";
import "../trader/modules/camelot/nftpool/Camelot_NFTPool_Cutter.sol";
import "../trader/modules/camelot/nitropool/Camelot_NitroPool_Cutter.sol";
import "../trader/modules/camelot/swap/Camelot_Swap_Cutter.sol";
import "../trader/modules/camelot/storage/Camelot_Storage_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 * @title   TestFixture_Strategy_Camelot
 * @notice  Tests Camelot module
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 */
contract TestFixture_Strategy_Camelot is
    StrategyDiamond,
    TraderV0_Cutter,
    Camelot_LP_Cutter,
    Camelot_NFTPool_Cutter,
    Camelot_NitroPool_Cutter,
    Camelot_Swap_Cutter,
    Camelot_Storage_Cutter,
    Camelot_V3_Cutter
{
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address _camelotLPFacet,
        address _camelotNFTPoolFacet,
        address _camelotNitroPoolFacet,
        address _camelotSwapFacet,
        address _camelotStorageFacet,
        address _camelotV3LPFacet
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_Camelot_LP(_camelotLPFacet);
        cut_Camelot_NFTPool(_camelotNFTPoolFacet);
        cut_Camelot_NitroPool(_camelotNitroPoolFacet);
        cut_Camelot_Swap(_camelotSwapFacet);
        cut_Camelot_Storage(_camelotStorageFacet);
        cut_Camelot_V3(_camelotV3LPFacet);
    }
}
