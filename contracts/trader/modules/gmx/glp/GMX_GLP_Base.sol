// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/gmx_interfaces/IRewardRouterV2.sol";

/**
 * @title   DSquared GMX GLP Base
 * @notice  Allows depositing, withdrawing, and claiming rewards in the GLP ecosystem
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the input and output tokens are acceptable.
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract GMX_GLP_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase

    /// @notice GMX GLP reward router address
    IRewardRouterV2 public immutable gmx_GLPRewardRouter;
    /// @notice GMX reward router address
    IRewardRouterV2 public immutable gmx_GMXRewardRouter;

    /**
     * @notice Sets the address of the GMX reward router and GMX GLP reward router
     * @param _gmx_GLPRewardRouter  GMX GLP reward router address
     * @param _gmx_GMXRewardRouter  GMX reward router address
     */
    constructor(address _gmx_GLPRewardRouter, address _gmx_GMXRewardRouter) {
        require(_gmx_GLPRewardRouter != address(0) && _gmx_GMXRewardRouter != address(0), "GMX_GLP_Base: Zero address");
        gmx_GLPRewardRouter = IRewardRouterV2(_gmx_GLPRewardRouter);
        gmx_GMXRewardRouter = IRewardRouterV2(_gmx_GMXRewardRouter);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice Mint and stakes GLP
     * @param _token    Token address to stake
     * @param _amount   Amount of token to stake
     * @param _minUsdg  Min Usdg to receive
     * @param _minGlp   Min GLP to receive
     */
    function gmx_mintAndStakeGlp(
        address _token,
        uint256 _amount,
        uint256 _minUsdg,
        uint256 _minGlp
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256) {
        inputGuard_gmx_mintAndStakeGlp(_token, _amount, _minUsdg, _minGlp);

        return gmx_GLPRewardRouter.mintAndStakeGlp(_token, _amount, _minUsdg, _minGlp);
    }

    /**
     * @notice Mint and stakes GLP with native token
     * @param _valueIn  Msg.value to send with tx
     * @param _minUsdg  Min Usdg to receive
     * @param _minGlp   Min GLP to receive
     */
    function gmx_mintAndStakeGlpETH(
        uint256 _valueIn,
        uint256 _minUsdg,
        uint256 _minGlp
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256) {
        inputGuard_gmx_mintAndStakeGlpETH(_valueIn, _minUsdg, _minGlp);

        return gmx_GLPRewardRouter.mintAndStakeGlpETH{ value: _valueIn }(_minUsdg, _minGlp);
    }

    /**
     * @notice Unstakes and redeems GLP
     * @param _tokenOut     Token address to unstake
     * @param _glpAmount    Amount of GLP to unstake
     * @param _minOut       Min amount to receive
     * @param _receiver     Recipient
     */
    function gmx_unstakeAndRedeemGlp(
        address _tokenOut,
        uint256 _glpAmount,
        uint256 _minOut,
        address _receiver
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256) {
        inputGuard_gmx_unstakeAndRedeemGlp(_tokenOut, _glpAmount, _minOut, _receiver);

        return gmx_GLPRewardRouter.unstakeAndRedeemGlp(_tokenOut, _glpAmount, _minOut, _receiver);
    }

    /**
     * @notice Unstakes GMX
     * @param _amount   Amount of GMX to unstake
     */
    function gmx_unstakeGmx(uint256 _amount) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        gmx_GMXRewardRouter.unstakeGmx(_amount);
    }

    /**
     * @notice Unstakes esGMX
     * @param _amount   Amount of esGMX to unstake
     */
    function gmx_unstakeEsGmx(uint256 _amount) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        gmx_GMXRewardRouter.unstakeEsGmx(_amount);
    }

    /**
     * @notice Unstakes and redeems GLP to native token
     * @param _glpAmount    Amount of GLP to unstake
     * @param _minOut       Min amount to receive
     * @param _receiver     Recipient
     */
    function gmx_unstakeAndRedeemGlpETH(
        uint256 _glpAmount,
        uint256 _minOut,
        address payable _receiver
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256) {
        inputGuard_gmx_unstakeAndRedeemGlpETH(_glpAmount, _minOut, _receiver);

        return gmx_GLPRewardRouter.unstakeAndRedeemGlpETH(_glpAmount, _minOut, _receiver);
    }

    /**
     * @notice Claims rewards from GMX reward router
     */
    function gmx_claim() external onlyRole(EXECUTOR_ROLE) nonReentrant {
        gmx_GMXRewardRouter.claim();
    }

    /**
     * @notice Compounds rewards from GMX reward router
     */
    function gmx_compound() external onlyRole(EXECUTOR_ROLE) nonReentrant {
        gmx_GMXRewardRouter.compound();
    }

    /**
     * @notice Handles rewards from GMX reward router
     * @param _shouldClaimGmx               Should claim GMX
     * @param _shouldStakeGmx               Should stake GMX
     * @param _shouldClaimEsGmx             Should claim esGMX
     * @param _shouldStakeEsGmx             Should stake esGMX
     * @param _shouldStakeMultiplierPoints  Should stake multiplier points
     * @param _shouldClaimWeth              Should claim WETH
     * @param _shouldConvertWethToEth       Should convert WETH to ETH
     */
    function gmx_handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldConvertWethToEth
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            _shouldConvertWethToEth
        );

        gmx_GMXRewardRouter.handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            _shouldConvertWethToEth
        );
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice Validates inputs for gmx_mintAndStakeGlp
     * @param _token    Token address to stake
     * @param _amount   Amount of token to stake
     * @param _minUsdg  Min Usdg to receive
     * @param _minGlp   Min GLP to receive
     */
    function inputGuard_gmx_mintAndStakeGlp(address _token, uint256 _amount, uint256 _minUsdg, uint256 _minGlp) internal virtual {}

    /**
     * @notice Validates inputs for gmx_mintAndStakeGlpETH
     * @param _valueIn  Msg.value to send with tx
     * @param _minUsdg  Min Usdg to receive
     * @param _minGlp   Min GLP to receive
     */
    function inputGuard_gmx_mintAndStakeGlpETH(uint256 _valueIn, uint256 _minUsdg, uint256 _minGlp) internal virtual {}

    /**
     * @notice Validates inputs for gmx_unstakeAndRedeemGlp
     * @param _tokenOut     Token address to unstake
     * @param _glpAmount    Amount of GLP to unstake
     * @param _minOut       Min amount to receive
     * @param _receiver     Recipient
     */
    function inputGuard_gmx_unstakeAndRedeemGlp(
        address _tokenOut,
        uint256 _glpAmount,
        uint256 _minOut,
        address _receiver
    ) internal virtual {}

    /**
     * @notice Validates inputs for gmx_unstakeAndRedeemGlpETH
     * @param _glpAmount    Amount of GLP to unstake
     * @param _minOut       Min amount to receive
     * @param _receiver     Recipient
     */
    function inputGuard_gmx_unstakeAndRedeemGlpETH(uint256 _glpAmount, uint256 _minOut, address payable _receiver) internal virtual {}

    /**
     * @notice Validates inputs for gmx_handleRewards
     * @param _shouldClaimGmx               Should claim GMX
     * @param _shouldStakeGmx               Should stake GMX
     * @param _shouldClaimEsGmx             Should claim esGMX
     * @param _shouldStakeEsGmx             Should stake esGMX
     * @param _shouldStakeMultiplierPoints  Should stake multiplier points
     * @param _shouldClaimWeth              Should claim WETH
     * @param _shouldConvertWethToEth       Should convert WETH to ETH
     */
    function inputGuard_gmx_handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldConvertWethToEth
    ) internal virtual {}
    // solhint-enable no-empty-blocks
}
