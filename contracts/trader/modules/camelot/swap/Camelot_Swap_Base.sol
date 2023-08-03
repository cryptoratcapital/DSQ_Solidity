// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../storage/Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/ICamelotRouter.sol";

/**
 * @title   DSquared Camelot Swap Base
 * @notice  Allows direct swapping via the CamelotRouter contract
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
abstract contract Camelot_Swap_Base is AccessControl, ReentrancyGuard, Camelot_Common_Storage {
    // solhint-disable var-name-mixedcase

    /// @notice Camelot router address
    address public immutable camelot_router;

    /**
     * @notice Sets the address of the Camelot router
     * @param _camelot_router   Camelot router address
     */
    constructor(address _camelot_router) {
        require(_camelot_router != address(0), "Camelot_Swap_Base: Zero address");
        camelot_router = _camelot_router;
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Swaps exact tokens for tokens using CamelotRouter
     * @param   amountIn        The amount of token to send
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   referrer        Referrer address
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function camelot_swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        address referrer,
        uint deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_swapExactTokensForTokens(amountIn, amountOutMin, path, to, referrer, deadline);

        ICamelotRouter(camelot_router).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMin,
            path,
            to,
            referrer,
            deadline
        );
    }

    /**
     * @notice  Swaps exact ETH for tokens using CamelotRouter
     * @param   valueIn         Msg.value to send with tx
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   referrer        Referrer address
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function camelot_swapExactETHForTokens(
        uint valueIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        address referrer,
        uint deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_swapExactETHForTokens(valueIn, amountOutMin, path, to, referrer, deadline);

        ICamelotRouter(camelot_router).swapExactETHForTokensSupportingFeeOnTransferTokens{ value: valueIn }(
            amountOutMin,
            path,
            to,
            referrer,
            deadline
        );
    }

    /**
     * @notice  Swaps exact tokens for ETH using CamelotRouter
     * @param   amountIn        The amount of tokens to send
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   referrer        Referrer address
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function camelot_swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        address referrer,
        uint deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_swapExactTokensForETH(amountIn, amountOutMin, path, to, referrer, deadline);

        ICamelotRouter(camelot_router).swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMin,
            path,
            to,
            referrer,
            deadline
        );
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for camelot_swapExactTokensForTokens
     * @param   amountIn        The amount of token to send
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   referrer        Referrer address
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_camelot_swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        address referrer,
        uint deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_swapExactETHForTokens
     * @param   valueIn         Msg.value to send with tx
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   referrer        Referrer address
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_camelot_swapExactETHForTokens(
        uint valueIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        address referrer,
        uint deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_swapExactTokensForETH
     * @param   amountIn        The amount of tokens to send
     * @param   amountOutMin    The min amount of token to receive
     * @param   path            The path of the swap
     * @param   referrer        Referrer address
     * @param   to              The address of the recipient
     * @param   deadline        The deadline of the tx
     */
    function inputGuard_camelot_swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        address referrer,
        uint deadline
    ) internal virtual {}
    // solhint-enable no-empty-blocks
}
