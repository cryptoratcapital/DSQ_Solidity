// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/rysk_interfaces/IAlphaOptionHandler.sol";

/**
 * @title   DSquared
 * @notice  Allows executing options via the Rysk AlphaOptionHandler contract
 * @dev     Requires USDC. Any integrating strategy must have USDC in its token mandate.
 * @dev     This contract is ONLY suitable for use with underlying tokens with 18 decimals.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IRysk_Options_Module {
    // ---------- Functions ----------

    function rysk_executeOrder(uint256 _orderId) external;

    function rysk_executeBuyBackOrder(uint256 _orderId) external;

    function rysk_executeStrangle(uint256 _orderId1, uint256 _orderId2) external;

    // ---------- Views ----------

    function rysk_alpha_option_handler() external view returns (IAlphaOptionHandler);
}
