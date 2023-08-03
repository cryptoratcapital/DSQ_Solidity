// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/traderjoe_interfaces/ILBRouter.sol";
import "../../../external/traderjoe_interfaces/ILBFactory.sol";

/**
 * @title   DSquared TraderJoe LP Base
 * @dev     Allows adding/removing liquidity via the TraderJoe LBRouter contract
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
abstract contract TraderJoe_LP_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase

    /// @notice TraderJoe router address
    ILBRouter public immutable traderjoe_router;
    /// @notice TraderJoe factory address
    ILBFactory public immutable traderjoe_factory;

    /**
     * @notice  Sets the addresses of the TraderJoe router & factory
     * @param   _traderjoe_router   TraderJoe router address
     * @param   _traderjoe_factory  TraderJoe factory address
     */
    constructor(address _traderjoe_router, address _traderjoe_factory) {
        // solhint-disable-next-line reason-string
        require(_traderjoe_router != address(0) && _traderjoe_factory != address(0), "TraderJoe_Common_Storage: Zero address");
        traderjoe_router = ILBRouter(_traderjoe_router);
        traderjoe_factory = ILBFactory(_traderjoe_factory);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Adds liquidity to a trader joe pool
     * @param   liquidityParameters     Add liquidity parameters
     */
    function traderjoe_addLiquidity(
        ILBRouter.LiquidityParameters calldata liquidityParameters
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_addLiquidity(liquidityParameters);

        traderjoe_router.addLiquidity(liquidityParameters);
    }

    /**
     * @notice  Adds liquidity to a trader joe pool using msg.value
     * @param   valueIn                 Value to send with addLiquidityNATIVE call
     * @param   liquidityParameters     Add liquidity parameters
     */
    function traderjoe_addLiquidityNATIVE(
        uint256 valueIn,
        ILBRouter.LiquidityParameters calldata liquidityParameters
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_addLiquidityNATIVE(valueIn, liquidityParameters);

        traderjoe_router.addLiquidityNATIVE{ value: valueIn }(liquidityParameters);
    }

    /**
     * @notice  Removes liquidity from a traderjoe pool
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
    function traderjoe_removeLiquidity(
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
        inputGuard_traderjoe_removeLiquidity(tokenX, tokenY, binStep, amountXMin, amountYMin, ids, amounts, to, deadline);

        traderjoe_router.removeLiquidity(tokenX, tokenY, binStep, amountXMin, amountYMin, ids, amounts, to, deadline);
    }

    /**
     * @notice  Removes liquidity from a traderjoe pool
     * @param   token               Token address
     * @param   binStep             Bin step of the LBPair
     * @param   amountTokenMin      Min amount of token to receive
     * @param   amountNATIVEMin     Min amount of native token to receive
     * @param   ids                 List of IDs to burn
     * @param   amounts             Amount to burn of each id
     * @param   to                  Address of recipient
     * @param   deadline            Deadline of the tx
     */
    function traderjoe_removeLiquidityNATIVE(
        IERC20 token,
        uint16 binStep,
        uint256 amountTokenMin,
        uint256 amountNATIVEMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address payable to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_removeLiquidityNATIVE(token, binStep, amountTokenMin, amountNATIVEMin, ids, amounts, to, deadline);

        traderjoe_router.removeLiquidityNATIVE(token, binStep, amountTokenMin, amountNATIVEMin, ids, amounts, to, deadline);
    }

    /**
     * @notice  Grants the router permission to transfer all of traders tokens for a pair
     * @param   tokenX      First pair address
     * @param   tokenY      Second pair address
     * @param   binStep     Bin step of the pair
     */
    function traderjoe_approveForAll(address tokenX, address tokenY, uint256 binStep) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_approveForAll(tokenX, tokenY, binStep);

        ILBFactory.LBPairInformation memory pair = traderjoe_factory.getLBPairInformation(IERC20(tokenX), IERC20(tokenY), binStep);
        require(address(pair.LBPair) != address(0), "Invalid pair parameters");
        pair.LBPair.approveForAll(address(traderjoe_router), true);
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for traderjoe_addLiquidity
     * @param   liquidityParameters     Add liquidity parameters
     */
    function inputGuard_traderjoe_addLiquidity(ILBRouter.LiquidityParameters calldata liquidityParameters) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_addLiquidityNATIVE
     * @param   valueIn                 Value to send with addLiquidityNATIVE call
     * @param   liquidityParameters     Add liquidity parameters
     */
    function inputGuard_traderjoe_addLiquidityNATIVE(
        uint256 valueIn,
        ILBRouter.LiquidityParameters calldata liquidityParameters
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_removeLiquidity
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
    function inputGuard_traderjoe_removeLiquidity(
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
     * @notice  Validates inputs for traderjoe_removeLiquidityNATIVE
     * @param   token               Token address
     * @param   binStep             Bin step of the LBPair
     * @param   amountTokenMin      Min amount of token to receive
     * @param   amountNATIVEMin     Min amount of native token to receive
     * @param   ids                 List of IDs to burn
     * @param   amounts             Amount to burn of each id
     * @param   to                  Address of recipient
     * @param   deadline            Deadline of the tx
     */
    function inputGuard_traderjoe_removeLiquidityNATIVE(
        IERC20 token,
        uint16 binStep,
        uint256 amountTokenMin,
        uint256 amountNATIVEMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address payable to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_approveForAll
     * @param   tokenX      First pair address
     * @param   tokenY      Second pair address
     * @param   binStep     Bin step of the pair
     */
    function inputGuard_traderjoe_approveForAll(address tokenX, address tokenY, uint256 binStep) internal virtual {}
    // solhint-enable no-empty-blocks
}
