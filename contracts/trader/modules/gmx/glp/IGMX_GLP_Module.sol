// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/gmx_interfaces/IRewardRouterV2.sol";

/**
 * @title   DSquared GMX GLP Module Interface
 * @notice  Allows depositing, withdrawing, and claiming rewards in the GLP ecosystem
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IGMX_GLP_Module {
    // ---------- Functions ----------
    function gmx_mintAndStakeGlp(address _token, uint256 _amount, uint256 _minUsdg, uint256 _minGlp) external returns (uint256);

    function gmx_mintAndStakeGlpETH(uint256 _valueIn, uint256 _minUsdg, uint256 _minGlp) external payable returns (uint256);

    function gmx_unstakeAndRedeemGlp(address _tokenOut, uint256 _glpAmount, uint256 _minOut, address _receiver) external returns (uint256);

    function gmx_unstakeAndRedeemGlpETH(uint256 _glpAmount, uint256 _minOut, address payable _receiver) external returns (uint256);

    function gmx_claim() external;

    function gmx_compound() external;

    function gmx_handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldConvertWethToEth
    ) external;

    function gmx_unstakeGmx(uint256 _amount) external;

    function gmx_unstakeEsGmx(uint256 _amount) external;

    // ---------- Getters ----------

    function gmx_GLPRewardRouter() external returns (IRewardRouterV2);

    function gmx_GMXRewardRouter() external returns (IRewardRouterV2);
}
