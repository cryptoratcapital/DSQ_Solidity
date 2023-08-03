// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/rysk_interfaces/IAlphaOptionHandler.sol";
import "../../../external/rysk_interfaces/IOptionRegistry.sol";
import "../../../external/rysk_interfaces/Types.sol";
import "../../../../interfaces/IERC20Decimals.sol";

/**
 * @title   DSquared Rysk Options Base
 * @notice  Allows executing options via the Rysk AlphaOptionHandler contract
 * @dev     Requires USDC. Any integrating strategy must have USDC in its token mandate.
 * @dev     This contract is ONLY suitable for use with underlying tokens with 18 decimals.
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MAY enforce any criteria on amounts if desired.
 *              2. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Rysk_Options_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    uint256 public constant SCALE_DECIMALS = 18;

    // solhint-disable var-name-mixedcase
    /// @notice Rysk AlphaOptionHandler address
    IAlphaOptionHandler public immutable rysk_alpha_option_handler;

    /**
     * @notice Sets the address of the Rysk AlphaOptionHandler
     * @param  _rysk_alpha_option_handler   Rysk AlphaOptionHandler address
     */
    constructor(address _rysk_alpha_option_handler) {
        // solhint-disable-next-line reason-string
        require(_rysk_alpha_option_handler != address(0), "Rysk_Common_Storage: Zero address");
        rysk_alpha_option_handler = IAlphaOptionHandler(_rysk_alpha_option_handler);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Executes a Rysk order
     * @param   _orderId    Order ID to execute
     */
    function rysk_executeOrder(uint256 _orderId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        rysk_alpha_option_handler.executeOrder(_orderId);
    }

    /**
     * @notice  Executes a Rysk buyback order
     * @param   _orderId    Order ID to execute
     */
    function rysk_executeBuyBackOrder(uint256 _orderId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        Types.Order memory order = rysk_alpha_option_handler.orderStores(_orderId);
        uint256 difference = SCALE_DECIMALS - IERC20Decimals(order.seriesAddress).decimals();
        IERC20Decimals(order.seriesAddress).approve(address(rysk_alpha_option_handler), order.amount / 10 ** difference);

        rysk_alpha_option_handler.executeBuyBackOrder(_orderId);
    }

    /**
     * @notice  Executes a Rysk strangle
     * @param   _orderId1   1st order ID of the strangle
     * @param   _orderId2   2nd order ID of the strangle
     */
    function rysk_executeStrangle(uint256 _orderId1, uint256 _orderId2) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        rysk_alpha_option_handler.executeStrangle(_orderId1, _orderId2);
    }
}
