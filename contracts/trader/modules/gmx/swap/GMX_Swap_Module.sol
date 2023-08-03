// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./GMX_Swap_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared GMX Swap Module
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
contract GMX_Swap_Module is GMX_Swap_Base, DSQ_Trader_Storage {
    /**
     * @notice  Sets the addresses of the GMX router
     * @param   _gmx_router    GMX router address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _gmx_router) GMX_Swap_Base(_gmx_router) {}

    // ----- GMX Swap Module -----

    /// @inheritdoc GMX_Swap_Base
    function inputGuard_gmx_swap(
        address[] memory _path,
        uint256, // _amountIn
        uint256, // _minOut
        address _receiver
    ) internal view virtual override {
        validateSwapPath(_path);
        require(_receiver == address(this), "GuardError: GMX swap recipient");
    }

    /// @inheritdoc GMX_Swap_Base
    function inputGuard_gmx_swapETHToTokens(
        uint256, // _valueIn
        address[] memory _path,
        uint256, // _minOut
        address _receiver
    ) internal view virtual override {
        validateSwapPath(_path);
        require(_receiver == address(this), "GuardError: GMX swap recipient");
    }

    /// @inheritdoc GMX_Swap_Base
    function inputGuard_gmx_swapTokensToETH(
        address[] memory _path,
        uint256, // _amountIn
        uint256, // _minOut
        address payable _receiver
    ) internal view virtual override {
        validateSwapPath(_path);
        require(_receiver == address(this), "GuardError: GMX swap recipient");
    }
}
