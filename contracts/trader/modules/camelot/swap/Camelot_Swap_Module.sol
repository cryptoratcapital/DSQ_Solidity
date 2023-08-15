// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Camelot_Swap_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared Camelot Swap Module
 * @notice  Allows direct swapping via the Camelot Router contract
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Camelot_Swap_Module is Camelot_Swap_Base, DSQ_Trader_Storage {
    /**
     * @notice Sets the address of the Camelot router
     * @param _camelot_router   Camelot router address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _camelot_router) Camelot_Swap_Base(_camelot_router) {}

    // ---------- Input Guards ----------

    /// @inheritdoc Camelot_Swap_Base
    function inputGuard_camelot_swapExactTokensForTokens(
        uint, // amountIn
        uint, // amountOutMin
        address[] calldata path,
        address to,
        address, // referrer
        uint // deadline
    ) internal view override {
        validateSwapPath(path);
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc Camelot_Swap_Base
    function inputGuard_camelot_swapExactETHForTokens(
        uint, // amountIn
        uint, // amountOutMin
        address[] calldata path,
        address to,
        address, // referrer
        uint // deadline
    ) internal view override {
        validateSwapPath(path);
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc Camelot_Swap_Base
    function inputGuard_camelot_swapExactTokensForETH(
        uint, // amountIn
        uint, // amountOutMin
        address[] calldata path,
        address to,
        address, // referrer
        uint // deadline
    ) internal view override {
        validateSwapPath(path);
        require(to == address(this), "GuardError: Invalid recipient");
    }
}
