// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/rysk_interfaces/Rysk_ILiquidityPool.sol";

/**
 * @title   DSquared Rysk LP Module Interface
 * @notice  Allows depositing, redeeming and withdrawing liquidity via the Rysk LiquidityPool Contract
 * @dev     Requires USDC. Any integrating strategy must have USDC in its token mandate.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IRysk_LP_Module {
    // ---------- Functions ----------

    function rysk_deposit(uint256 _amount) external;

    function rysk_redeem(uint256 _shares) external;

    function rysk_initiateWithdraw(uint256 _shares) external;

    function rysk_completeWithdraw() external;

    // ---------- Views ----------

    function rysk_liquidity_pool() external view returns (Rysk_ILiquidityPool);
}
