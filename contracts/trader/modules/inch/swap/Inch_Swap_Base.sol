// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/inch_interfaces/IAggregationRouter.sol";
import "../../../external/inch_interfaces/IAggregationExecutor.sol";
import "../../../external/clipper_interfaces/IClipperExchangeInterface.sol";

/**
 * @title   DSquared Inch Swap Base
 * @notice  Allows swapping via the 1Inch AggregationRouter contract
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the tokens are valid
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Inch_Swap_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase

    /// @notice 1Inch AggregationRouterV5 address
    IAggregationRouter public immutable inch_aggregation_router;

    /// @notice ClipperExchange address
    IClipperExchangeInterface public immutable inch_clipper_exchange;

    /**
     * @notice Sets the AggregationRouter and ClipperExchange contract addresses
     * @param _inch_aggregation_router  1Inch AggregationRouterV5 address
     * @param _inch_clipper_exchange    ClipperExchange address
     */
    constructor(address _inch_aggregation_router, address _inch_clipper_exchange) {
        require(_inch_aggregation_router != address(0) && _inch_clipper_exchange != address(0), "Inch_Swap_Base: Zero address");
        inch_aggregation_router = IAggregationRouter(_inch_aggregation_router);
        inch_clipper_exchange = IClipperExchangeInterface(_inch_clipper_exchange);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Performs a 1Inch swap, delgating all calls encoded in 'data' to 'executor'
     * @param   valueIn     Msg.value to send with the swap
     * @param   executor    Aggregation executor that executes calls described in `data`
     * @param   desc        Swap description
     * @param   permit      Permit that can be used in 'IERC20Permit.permit' calls
     * @param   data        Encoded calls that 'caller' should execute in between of swaps
     */
    function inch_swap(
        uint256 valueIn,
        IAggregationExecutor executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 returnAmount, uint256 spentAmount) {
        inputGuard_inch_swap(valueIn, executor, desc, permit, data);

        (returnAmount, spentAmount) = inch_aggregation_router.swap{ value: valueIn }(executor, desc, permit, data);
    }

    /**
     * @notice  Performs a swap using Uniswap V3 exchange
     * @param   valueIn     Msg.value to send with the swap
     * @param   amount      Amount of source tokens to send with swap
     * @param   minReturn   Minimum return amount to make transaction commit
     * @param   pools       Array of pool addresses to use for swap
     */
    function inch_uniswapV3Swap(
        uint256 valueIn,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 returnAmount) {
        inputGuard_inch_uniswapV3Swap(valueIn, amount, minReturn, pools);

        returnAmount = inch_aggregation_router.uniswapV3Swap{ value: valueIn }(amount, minReturn, pools);
    }

    /**
     * @notice  Performs swap using Clipper exchange
     * @param   valueIn             Msg.value to send with the swap
     * @param   clipperExchange     Address for clipper exchange
     * @param   srcToken            Source token
     * @param   dstToken            Destination token
     * @param   inputAmount         Amount of source tokens to swap
     * @param   outputAmount        Amount of destination tokens to receive
     * @param   goodUntil           Timestamp until the swap will be valid
     * @param   r                   Clipper order signature (r part)
     * @param   vs                  Clipper order signature (vs part)
     */
    function inch_clipperSwap(
        uint256 valueIn,
        IClipperExchangeInterface clipperExchange,
        IERC20 srcToken,
        IERC20 dstToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 goodUntil,
        bytes32 r,
        bytes32 vs
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 returnAmount) {
        inputGuard_inch_clipperSwap(valueIn, clipperExchange, srcToken, dstToken, inputAmount, outputAmount, goodUntil, r, vs);

        returnAmount = inch_aggregation_router.clipperSwap{ value: valueIn }(
            clipperExchange,
            srcToken,
            dstToken,
            inputAmount,
            outputAmount,
            goodUntil,
            r,
            vs
        );
    }

    // ---------- Hooks ----------

    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for inch_swap
     * @param   valueIn     Msg.value to send with the swap
     * @param   executor    Aggregation executor that executes calls described in `data`
     * @param   desc        Swap description
     * @param   permit      Permit that can be used in 'IERC20Permit.permit' calls
     * @param   data        Encoded calls that 'caller' should execute in between of swaps
     */
    function inputGuard_inch_swap(
        uint256 valueIn,
        IAggregationExecutor executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) internal virtual {}

    /**
     * @notice  Validates inputs for inch_uniswapV3Swap
     * @param   valueIn     Msg.value to send with the swap
     * @param   amount      Amount of source tokens to send with swap
     * @param   minReturn   Minimum return amount to make transaction commit
     * @param   pools       Array of pool addresses to use for swap
     */
    function inputGuard_inch_uniswapV3Swap(uint256 valueIn, uint256 amount, uint256 minReturn, uint256[] calldata pools) internal virtual {}

    /**
     * @notice  Validates inputs for inch_clipperSwap
     * @param   valueIn             Msg value to send with the swap
     * @param   clipperExchange     Address for clipper exchange
     * @param   srcToken            Source token
     * @param   dstToken            Destination token
     * @param   inputAmount         Amount of source tokens to swap
     * @param   outputAmount        Amount of destination tokens to receive
     * @param   goodUntil           Timestamp until the swap will be valid
     * @param   r                   Clipper order signature (r part)
     * @param   vs                  Clipper order signature (vs part)
     */
    function inputGuard_inch_clipperSwap(
        uint256 valueIn,
        IClipperExchangeInterface clipperExchange,
        IERC20 srcToken,
        IERC20 dstToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 goodUntil,
        bytes32 r,
        bytes32 vs
    ) internal virtual {}
    // solhint-enable no-empty-blocks
}
