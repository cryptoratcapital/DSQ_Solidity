// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/traderjoe_interfaces/ILBRouter.sol";

/**
 * @title   DSquared TraderJoe Swap Base
 * @notice  Allows direct swapping via the LBRouter contract
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
abstract contract TraderJoe_Swap_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    /// @notice TraderJoe router address
    ILBRouter public immutable traderjoe_router; // solhint-disable-line var-name-mixedcase

    /**
     * @notice  Sets the addresses of the TraderJoe router
     * @param   _traderjoe_router    TraderJoe router address
     */
    // solhint-disable-next-line var-name-mixedcase
    constructor(address _traderjoe_router) {
        // solhint-disable-next-line reason-string
        require(_traderjoe_router != address(0), "TraderJoe_Swap_Base: Zero address");
        traderjoe_router = ILBRouter(_traderjoe_router);
    }

    // ---------- Functions ----------

    /**
     * @notice  Swaps exact tokens for tokens using LBRouter
     * @param   amountIn        The amount of token to send
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function traderjoe_swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_traderjoe_swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline);

        traderjoe_router.swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline);
    }

    /**
     * @notice  Swaps exact tokens for NATIVE tokens using LBRouter
     * @param   amountIn              The amount of token to send
     * @param   amountOutMinNATIVE    The min amount of native token to receive
     * @param   path                  The path of the swap
     * @param   to                    The address of the recipient
     * @param   deadline              The deadline of the tx
     */
    function traderjoe_swapExactTokensForNATIVE(
        uint256 amountIn,
        uint256 amountOutMinNATIVE,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 amountOut) {
        inputGuard_traderjoe_swapExactTokensForNATIVE(amountIn, amountOutMinNATIVE, path, to, deadline);

        amountOut = traderjoe_router.swapExactTokensForNATIVE(amountIn, amountOutMinNATIVE, path, to, deadline);
    }

    /**
     * @notice  Swaps exact NATIVE tokens for tokens using LBRouter
     * @param   valueIn       Msg.value to send with the tx
     * @param   amountOutMin  The min amount of token to receive
     * @param   path          The path of the swap
     * @param   to            The address of the recipient
     * @param   deadline      The deadline of the tx
     */
    function traderjoe_swapExactNATIVEForTokens(
        uint256 valueIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 amountOut) {
        inputGuard_traderjoe_swapExactNATIVEForTokens(valueIn, amountOutMin, path, to, deadline);

        amountOut = traderjoe_router.swapExactNATIVEForTokens{ value: valueIn }(amountOutMin, path, to, deadline);
    }

    /**
     * @notice  Swaps token for exact tokens
     * @param   amountOut       The amount of token to receive
     * @param   amountInMax     The max amount of token to input
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function traderjoe_swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256[] memory amountsIn) {
        inputGuard_traderjoe_swapTokensForExactTokens(amountOut, amountInMax, path, to, deadline);

        amountsIn = traderjoe_router.swapTokensForExactTokens(amountOut, amountInMax, path, to, deadline);
    }

    /**
     * @notice  Swaps token for exact native tokens
     * @param   amountOut       The amount of token to receive
     * @param   amountInMax     The max amount of token to input
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function traderjoe_swapTokensForExactNATIVE(
        uint256 amountOut,
        uint256 amountInMax,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256[] memory amountsIn) {
        inputGuard_traderjoe_swapTokensForExactNATIVE(amountOut, amountInMax, path, to, deadline);

        amountsIn = traderjoe_router.swapTokensForExactNATIVE(amountOut, amountInMax, path, to, deadline);
    }

    /**
     * @notice  Swaps native token for exact tokens
     * @param   valueIn     Msg.value to send with the tx
     * @param   amountOut   The amount of token to receive
     * @param   path        The path of the swap
     * @param   to          The address of the recipient
     * @param   deadline    The deadline of the tx
     */
    function traderjoe_swapNATIVEForExactTokens(
        uint256 valueIn,
        uint256 amountOut,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external payable onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256[] memory amountsIn) {
        inputGuard_traderjoe_swapNATIVEForExactTokens(valueIn, amountOut, path, to, deadline);

        amountsIn = traderjoe_router.swapNATIVEForExactTokens{ value: valueIn }(amountOut, path, to, deadline);
    }

    /**
     * @notice  Swaps exact tokens for tokens supporting fee on transfer tokens
     * @param   amountIn        The amount of token to send
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 amountOut) {
        inputGuard_traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, amountOutMin, path, to, deadline);

        amountOut = traderjoe_router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, amountOutMin, path, to, deadline);
    }

    /**
     * @notice  Swaps exact tokens for NATIVE tokens using LBRouter
     * @param   amountIn            The amount of token to send
     * @param   amountOutMinNATIVE  The min amount of native token to receive
     * @param   path                The path of the swap
     * @param   to                  The address of the recipient
     * @param   deadline            The deadline of the tx
     */
    function traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMinNATIVE,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 amountOut) {
        inputGuard_traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(amountIn, amountOutMinNATIVE, path, to, deadline);

        amountOut = traderjoe_router.swapExactTokensForNATIVESupportingFeeOnTransferTokens(
            amountIn,
            amountOutMinNATIVE,
            path,
            to,
            deadline
        );
    }

    /**
     * @notice  Swaps exact NATIVE tokens for tokens using LBRouter
     * @param   valueIn         Msg.value to send with tx
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(
        uint256 valueIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external payable onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 amountOut) {
        inputGuard_traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(valueIn, amountOutMin, path, to, deadline);

        amountOut = traderjoe_router.swapExactNATIVEForTokensSupportingFeeOnTransferTokens{ value: valueIn }(
            amountOutMin,
            path,
            to,
            deadline
        );
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for traderjoe_swapExactTokensForTokens
     * @param   amountIn        The amount of token to send
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_traderjoe_swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_swapExactTokensForNATIVE
     * @param   amountIn            The amount of token to send
     * @param   amountOutMinNATIVE  The min amount of native token to receive
     * @param   path                The path of the swap
     * @param   to                  The address of the recipient
     * @param   deadline            The deadline of the tx
     */
    function inputGuard_traderjoe_swapExactTokensForNATIVE(
        uint256 amountIn,
        uint256 amountOutMinNATIVE,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_swapExactNATIVEForTokens
     * @param   valueIn         Msg.value to send with tx
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_traderjoe_swapExactNATIVEForTokens(
        uint256 valueIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_swapTokensForExactTokens
     * @param   amountOut       The amount of token to receive
     * @param   amountInMax     The max amount of token to input
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_traderjoe_swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_swapTokensForExactNATIVE
     * @param   amountOut       The amount of token to receive
     * @param   amountInMax     The max amount of token to input
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_traderjoe_swapTokensForExactNATIVE(
        uint256 amountOut,
        uint256 amountInMax,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_swapNATIVEForExactTokens
     * @param   valueIn     Msg.value to send with the tx
     * @param   amountOut   The amount of token to receive
     * @param   path        The path of the swap
     * @param   to          The address of the recipient
     * @param   deadline    The deadline of the tx
     */
    function inputGuard_traderjoe_swapNATIVEForExactTokens(
        uint256 valueIn,
        uint256 amountOut,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens
     * @param   amountIn        The amount of token to send
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens
     * @param   amountIn            The amount of token to send
     * @param   amountOutMinNATIVE  The min amount of native token to receive
     * @param   path                The path of the swap
     * @param   to                  The address of the recipient
     * @param   deadline            The deadline of the tx
     */
    function inputGuard_traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMinNATIVE,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens
     * @param   valueIn         Msg.value to send with tx
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(
        uint256 valueIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) internal virtual {}

    // solhint-enable no-empty-blocks
}
