// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/gmx_interfaces/IRouter.sol";

/**
 * @title   DSquared GMX Swap Base
 * @notice  Allows direct swapping via the GMX Router contract
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
abstract contract GMX_Swap_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase

    /// @notice GMX router address
    IRouter public immutable gmx_router;

    /**
     * @notice  Sets the addresses of the GMX router
     * @param   _gmx_router    GMX router address
     */
    constructor(address _gmx_router) {
        require(_gmx_router != address(0), "GMX_Swap_Base: Zero Address");
        gmx_router = IRouter(_gmx_router);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Swaps tokens for tokens using GMX router
     * @param   _path       The path of the swap
     * @param   _amountIn   The amount of token to send
     * @param   _minOut     The min amount of token to receive
     * @param   _receiver   The address of the recipient
     */
    function gmx_swap(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _minOut,
        address _receiver
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_swap(_path, _amountIn, _minOut, _receiver);

        gmx_router.swap(_path, _amountIn, _minOut, _receiver);
    }

    /**
     * @notice  Swaps ETH for tokens using GMX router
     * @param   _valueIn    Msg.value to send with tx
     * @param   _path       The path of the swap
     * @param   _minOut     The min amount of token to receive
     * @param   _receiver   The address of the recipient
     */
    function gmx_swapETHToTokens(
        uint256 _valueIn,
        address[] memory _path,
        uint256 _minOut,
        address _receiver
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_swapETHToTokens(_valueIn, _path, _minOut, _receiver);

        gmx_router.swapETHToTokens{ value: _valueIn }(_path, _minOut, _receiver);
    }

    /**
     * @notice  Swaps tokens for ETH using GMX router
     * @param   _path       The path of the swap
     * @param   _amountIn   The amount of ETH to send
     * @param   _minOut     The min amount of token to receive
     * @param   _receiver   The address of the recipient
     */
    function gmx_swapTokensToETH(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _minOut,
        address payable _receiver
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_swapTokensToETH(_path, _amountIn, _minOut, _receiver);

        gmx_router.swapTokensToETH(_path, _amountIn, _minOut, _receiver);
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for gmx_swap
     * @param   _path       The path of the swap
     * @param   _amountIn   The amount of ETH to send
     * @param   _minOut     The min amount of token to receive
     * @param   _receiver   The address of the recipient
     */
    function inputGuard_gmx_swap(address[] memory _path, uint256 _amountIn, uint256 _minOut, address _receiver) internal virtual {}

    /**
     * @notice  Validates inputs for gmx_swapETHToTokens
     * @param   _valueIn    Msg.value to send with tx
     * @param   _path       The path of the swap
     * @param   _minOut     The min amount of token to receive
     * @param   _receiver   The address of the recipient
     */
    function inputGuard_gmx_swapETHToTokens(
        uint256 _valueIn,
        address[] memory _path,
        uint256 _minOut,
        address _receiver
    ) internal virtual {}

    /**
     * @notice  Validates inputs for gmx_swapTokensToETH
     * @param   _path       The path of the swap
     * @param   _amountIn   The amount of ETH to send
     * @param   _minOut     The min amount of token to receive
     * @param   _receiver   The address of the recipient
     */
    function inputGuard_gmx_swapTokensToETH(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _minOut,
        address payable _receiver
    ) internal virtual {}
    // solhint-enable no-empty-blocks
}
