// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../storage/Lyra_Common_Storage.sol";
import "../../../external/lyra_interfaces/ILiquidityPool.sol";

/**
 * @title   HessianX Lyra LP Base
 * @notice  Allows depositing and withdrawing liquidity via the Lyra LiquidityPool Contract
 * @dev     All known Lyra pools require USDC. Any integrating strategy must have USDC in its token mandate.
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the pools are valid
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Lyra_LP_Base is AccessControl, ReentrancyGuard, Lyra_Common_Storage {
    // ---------- Functions ----------

    /**
     * @notice  Initiates a deposit to a lyra pool
     * @param   pool            Address of lyra pool to supply
     * @param   beneficiary     Recipient of deposit
     * @param   amountQuote     Amount to deposit
     */
    function lyra_initiateDeposit(address pool, address beneficiary, uint256 amountQuote) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_initiateDeposit(pool, beneficiary, amountQuote);

        LyraCommonStorage storage s = getLyraCommonStorage();
        IERC20(s.lyraPoolToQuoteAsset[pool]).approve(pool, amountQuote);
        ILiquidityPool(pool).initiateDeposit(beneficiary, amountQuote);
    }

    /**
     * @notice  Initiates a withdrawal from a lyra pool
     * @param   pool                    Address of lyra pool to withdraw
     * @param   beneficiary             Recipient of withdrawal
     * @param   amountLiquidityToken    Amount to withdraw
     */
    function lyra_initiateWithdraw(
        address pool,
        address beneficiary,
        uint256 amountLiquidityToken
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_initiateWithdraw(pool, beneficiary, amountLiquidityToken);

        ILiquidityPool(pool).initiateWithdraw(beneficiary, amountLiquidityToken);
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for lyra_initiateDeposit
     * @param   pool            Address of lyra pool to supply
     * @param   beneficiary     Recipient of deposit
     * @param   amountQuote     Amount to deposit
     */
    function inputGuard_lyra_initiateDeposit(address pool, address beneficiary, uint256 amountQuote) internal virtual {}

    /**
     * @notice  Validates inputs for lyra_initiateWithdraw
     * @param   pool                    Address of lyra pool to withdraw
     * @param   beneficiary             Recipient of withdrawal
     * @param   amountLiquidityToken    Amount to withdraw
     */
    function inputGuard_lyra_initiateWithdraw(address pool, address beneficiary, uint256 amountLiquidityToken) internal virtual {}
    // solhint-enable no-empty-blocks
}
