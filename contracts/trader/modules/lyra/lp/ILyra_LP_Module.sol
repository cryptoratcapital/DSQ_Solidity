// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title   DSquared Lyra LP Module Interface
 * @notice  Allows depositing and withdrawing liquidity via the Lyra LiquidityPool Contract
 * @dev     Requires USDC. Any integrating strategy must have USDC in its token mandate.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ILyra_LP_Module {
    // ---------- Functions ----------

    function lyra_initiateDeposit(address pool, address beneficiary, uint256 amountQuote) external;

    function lyra_initiateWithdraw(address pool, address beneficiary, uint256 amountLiquidityToken) external;

    // ---------- Views ----------

    function usdc() external view returns (IERC20);
}
