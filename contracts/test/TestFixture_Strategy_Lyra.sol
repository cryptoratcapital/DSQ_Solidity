// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "../trader/diamonds/StrategyDiamond.sol";
import "../trader/trader/ITraderV0.sol";
import "../trader/trader/TraderV0_Cutter.sol";
import "../trader/modules/lyra/storage/Lyra_Storage_Cutter.sol";
import "../trader/modules/lyra/lp/Lyra_LP_Cutter.sol";
import "../trader/modules/lyra/options/Lyra_Options_Cutter.sol";
import "../trader/modules/lyra/rewards/Lyra_Rewards_Cutter.sol";

/**
 * DSquared Finance https://www.dsquared.finance/
 * @title   TestFixture_Strategy_LyraModule
 * @notice  Tests Lyra module
 * @dev     Employs a non-upgradeable version of the EIP-2535 Diamonds pattern
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 */
contract TestFixture_Strategy_Lyra is
    StrategyDiamond,
    TraderV0_Cutter,
    Lyra_Storage_Cutter,
    Lyra_LP_Cutter,
    Lyra_Options_Cutter,
    Lyra_Rewards_Cutter
{
    constructor(
        address _admin,
        address _traderFacet,
        TraderV0InitializerParams memory _traderV0Params,
        address _storageFacet,
        address _lpFacet,
        address _optionsFacet,
        address _rewardsFacet
    ) StrategyDiamond(_admin) {
        cut_TraderV0(_traderFacet, _traderV0Params);
        cut_Lyra_Storage(_storageFacet);
        cut_Lyra_LP(_lpFacet);
        cut_Lyra_Options(_optionsFacet);
        cut_Lyra_Rewards(_rewardsFacet);
    }
}
