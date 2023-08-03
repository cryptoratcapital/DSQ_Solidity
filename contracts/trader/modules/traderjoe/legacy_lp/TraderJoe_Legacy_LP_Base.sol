// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/traderjoe_interfaces/ILBLegacyRouter.sol";
import "../../../external/traderjoe_interfaces/ILBLegacyFactory.sol";

/**
 * @title   DSquared TraderJoe Legacy LP Base
 * @notice  Allows adding/removing liquidity via the TraderJoe Legacy LBRouter contract
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the swap path is acceptable.
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract TraderJoe_Legacy_LP_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase, reason-string

    /// @notice TraderJoe legacy router address
    ILBLegacyRouter public immutable traderjoe_legacy_router;
    /// @notice TraderJoe legacy factory address
    ILBLegacyFactory public immutable traderjoe_legacy_factory;

    /**
     * @notice  Sets the addresses of the TraderJoe legacy router & factory
     * @param   _traderjoe_legacy_router    TraderJoe legacy router address
     * @param   _traderjoe_legacy_factory   TraderJoe legacy factory address
     */
    constructor(address _traderjoe_legacy_router, address _traderjoe_legacy_factory) {
        require(
            _traderjoe_legacy_router != address(0) && _traderjoe_legacy_factory != address(0),
            "TraderJoe_Common_Storage: Zero address"
        );
        traderjoe_legacy_router = ILBLegacyRouter(_traderjoe_legacy_router);
        traderjoe_legacy_factory = ILBLegacyFactory(_traderjoe_legacy_factory);
    }

    // solhint-enable var-name-mixedcase, reason-string

    // ---------- Functions ----------

    /**
     * @notice  Adds liquidity to a trader joe legacy pool
     * @param   liquidityParameters     Add liquidity parameters
     */
    function traderjoe_legacy_addLiquidity(
        ILBLegacyRouter.LiquidityParameters calldata liquidityParameters
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_legacy_addLiquidity(liquidityParameters);

        traderjoe_legacy_router.addLiquidity(liquidityParameters);
    }

    /**
     * @notice  Adds liquidity to a trader joe legacy pool using msg.value
     * @param   valueIn                 Value to send with addLiquidityAVAX call
     * @param   liquidityParameters     Add liquidity parameters
     */
    function traderjoe_legacy_addLiquidityAVAX(
        uint256 valueIn,
        ILBLegacyRouter.LiquidityParameters calldata liquidityParameters
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_legacy_addLiquidityAVAX(valueIn, liquidityParameters);

        traderjoe_legacy_router.addLiquidityAVAX{ value: valueIn }(liquidityParameters);
    }

    /**
     * @notice  Removes liquidity from a traderjoe legacy pool
     * @param   tokenX      First token address
     * @param   tokenY      Second token address
     * @param   binStep     Bin step of the LBPair
     * @param   amountXMin  Min amount of tokenX to receive
     * @param   amountYMin  Min amount of tokenY to receive
     * @param   ids         List of IDs to burn
     * @param   amounts     Amount to burn of each id
     * @param   to          Address of recipient
     * @param   deadline    Deadline of the tx
     */
    function traderjoe_legacy_removeLiquidity(
        IERC20 tokenX,
        IERC20 tokenY,
        uint16 binStep,
        uint256 amountXMin,
        uint256 amountYMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_legacy_removeLiquidity(tokenX, tokenY, binStep, amountXMin, amountYMin, ids, amounts, to, deadline);

        traderjoe_legacy_router.removeLiquidity(tokenX, tokenY, binStep, amountXMin, amountYMin, ids, amounts, to, deadline);
    }

    /**
     * @notice  Removes liquidity from a traderjoe legacy pool
     * @param   token           Token address
     * @param   binStep         Bin step of the LBPair
     * @param   amountTokenMin  Min amount of token to receive
     * @param   amountAVAXMin   Min amount of native token to receive
     * @param   ids             List of IDs to burn
     * @param   amounts         Amount to burn of each id
     * @param   to              Address of recipient
     * @param   deadline        Deadline of the tx
     */
    function traderjoe_legacy_removeLiquidityAVAX(
        IERC20 token,
        uint16 binStep,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address payable to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_legacy_removeLiquidityAVAX(token, binStep, amountTokenMin, amountAVAXMin, ids, amounts, to, deadline);

        traderjoe_legacy_router.removeLiquidityAVAX(token, binStep, amountTokenMin, amountAVAXMin, ids, amounts, to, deadline);
    }

    /**
     * @notice  Grants the router permission to transfer all of traders tokens for a pair
     * @param   tokenX      First pair address
     * @param   tokenY      Second pair address
     * @param   binStep     Bin step of the pair
     */
    function traderjoe_legacy_setApprovalForAll(
        address tokenX,
        address tokenY,
        uint256 binStep
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_legacy_setApprovalForAll(tokenX, tokenY, binStep);

        ILBLegacyFactory.LBPairInformation memory pair = traderjoe_legacy_factory.getLBPairInformation(
            IERC20(tokenX),
            IERC20(tokenY),
            binStep
        );
        require(address(pair.LBPair) != address(0), "Invalid pair parameters");
        pair.LBPair.setApprovalForAll(address(traderjoe_legacy_router), true);
    }

    // ---------- Hooks ----------

    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for traderjoe_legacy_addLiquidity
     * @param   liquidityParameters     Add liquidity parameters
     */
    function inputGuard_traderjoe_legacy_addLiquidity(ILBLegacyRouter.LiquidityParameters calldata liquidityParameters) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_legacy_addLiquidityAVAX
     * @param   valueIn                 Value to send with addLiquidityAVAX call
     * @param   liquidityParameters     Add liquidity parameters
     */
    function inputGuard_traderjoe_legacy_addLiquidityAVAX(
        uint256 valueIn,
        ILBLegacyRouter.LiquidityParameters calldata liquidityParameters
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_legacy_removeLiquidity
     * @param   tokenX      First token address
     * @param   tokenY      Second token address
     * @param   binStep     Bin step of the LBPair
     * @param   amountXMin  Min amount of tokenX to receive
     * @param   amountYMin  Min amount of tokenY to receive
     * @param   ids         List of IDs to burn
     * @param   amounts     Amount to burn of each id
     * @param   to          Address of recipient
     * @param   deadline    Deadline of the tx
     */
    function inputGuard_traderjoe_legacy_removeLiquidity(
        IERC20 tokenX,
        IERC20 tokenY,
        uint16 binStep,
        uint256 amountXMin,
        uint256 amountYMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_legacy_removeLiquidityAVAX
     * @param   token           Token address
     * @param   binStep         Bin step of the LBPair
     * @param   amountTokenMin  Min amount of token to receive
     * @param   amountAVAXMin   Min amount of native token to receive
     * @param   ids             List of IDs to burn
     * @param   amounts         Amount to burn of each id
     * @param   to              Address of recipient
     * @param   deadline        Deadline of the tx
     */
    function inputGuard_traderjoe_legacy_removeLiquidityAVAX(
        IERC20 token,
        uint16 binStep,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address payable to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_legacy_setApprovalForAll
     * @param   tokenX      First pair address
     * @param   tokenY      Second pair address
     * @param   binStep     Bin step of the pair
     */
    function inputGuard_traderjoe_legacy_setApprovalForAll(address tokenX, address tokenY, uint256 binStep) internal virtual {}
    // solhint-enable no-empty-blocks
}
