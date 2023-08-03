// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/rysk_interfaces/Rysk_ILiquidityPool.sol";

/**
 * @title   DSquared Rysk LP Base
 * @notice  Allows depositing, redeeming and withdrawing liquidity via the Rysk LiquidityPool Contract
 * @dev     Requires USDC. Any integrating strategy must have USDC in its token mandate.
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MAY enforce any criteria on amounts if desired.
 *              2. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Rysk_LP_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase

    /// @notice Rysk liquidity pool address
    Rysk_ILiquidityPool public immutable rysk_liquidity_pool;

    /**
     * @notice  Sets the address of the Rysk liquidity pool
     * @param   _rysk_liquidity_pool    Rysk liquidity pool address
     */
    constructor(address _rysk_liquidity_pool) {
        // solhint-disable-next-line reason-string
        require(_rysk_liquidity_pool != address(0), "Rysk_Common_Storage: Zero address");
        rysk_liquidity_pool = Rysk_ILiquidityPool(_rysk_liquidity_pool);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Deposits into the Rysk liquidity pool
     * @param   _amount     Amount to deposit
     */
    function rysk_deposit(uint256 _amount) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        rysk_liquidity_pool.deposit(_amount);
    }

    /**
     * @notice  Redeems from the Rysk liquidity pool
     * @param   _shares     Amount to redeem
     */
    function rysk_redeem(uint256 _shares) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        rysk_liquidity_pool.redeem(_shares);
    }

    /**
     * @notice  Initiates a withdrawal from the Rysk liquidity pool
     * @param   _shares     Amount to withdraw
     */
    function rysk_initiateWithdraw(uint256 _shares) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        rysk_liquidity_pool.initiateWithdraw(_shares);
    }

    /**
     * @notice  Completes a withdrawal from the Rysk liquidity pool
     */
    function rysk_completeWithdraw() external onlyRole(EXECUTOR_ROLE) nonReentrant {
        rysk_liquidity_pool.completeWithdraw();
    }
}
