// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../dsq/DSQ_Common_Roles.sol";
import "../../external/aave_interfaces/IPool.sol";

/**
 * @title   DSquared Aave Lending Base
 * @notice  Allows lending and borrowing via the Aave Pool Contract
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the tokens are valid.
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Aave_Lending_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase

    /// @notice Aave lending pool address
    IPool public immutable aave_pool;

    /// @notice Maximum borrow allowed as mantissa fraction of Aave max LTV (100% = 1e18)
    uint256 public constant MAX_LTV_FACTOR = 0.8e18;
    /// @dev Mantissa factor
    uint256 internal constant MANTISSA_FACTOR = 1e18;
    /// @dev Basis factor for Aave LTV conversion (100% = 1e4)
    uint256 internal constant BASIS_FACTOR = 1e4;

    /**
     * @notice Sets the address of the Aave lending pool
     * @param _aave_pool Aave lending pool address
     */
    constructor(address _aave_pool) {
        require(_aave_pool != address(0), "Aave_Lending_Base: Zero address");
        aave_pool = IPool(_aave_pool);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Supplies the given amount of asset into the Aave lending pool
     * @param   asset           Address of asset to supply
     * @param   amount          Amount of asset to supply
     * @param   onBehalfOf      Recipient of supply position
     * @param   referralCode    Aave referral code
     */
    function aave_supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_aave_supply(asset, amount, onBehalfOf, referralCode);

        aave_pool.supply(asset, amount, onBehalfOf, referralCode);
    }

    /**
     * @notice  Withdraws the given amount of asset from the Aave lending pool
     * @param   asset   Address of asset to withdraw
     * @param   amount  Amount of asset to withdraw
     * @param   to      Recipient of withdraw
     */
    function aave_withdraw(address asset, uint256 amount, address to) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_aave_withdraw(asset, amount, to);

        aave_pool.withdraw(asset, amount, to);
    }

    /**
     * @notice  Borrows the given amount of asset from the Aave lending pool
     * @dev     The borrow amount must not cause the total debt to exceed a fraction of Aave's allowable max LTV
     * @param   asset               Address of asset to borrow
     * @param   amount              Amount of asset to borrow
     * @param   interestRateMode    Interest rate mode
     * @param   referralCode        Aave referral code
     * @param   onBehalfOf          Recipient of borrow
     */
    function aave_borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_aave_borrow(asset, amount, interestRateMode, referralCode, onBehalfOf);

        aave_pool.borrow(asset, amount, interestRateMode, referralCode, onBehalfOf);

        (uint256 totalCollateralBase, uint256 totalDebtBase, , , uint256 ltv, ) = aave_pool.getUserAccountData(onBehalfOf);
        uint256 maxDebtBase = (totalCollateralBase * ltv * MAX_LTV_FACTOR) / (BASIS_FACTOR * MANTISSA_FACTOR);
        require(totalDebtBase <= maxDebtBase, "Aave_Lending_Base: Borrow amount exceeds max LTV"); // solhint-disable-line reason-string
    }

    /**
     * @notice  Repays the given amount of asset to the Aave lending pool
     * @param   asset               Address of asset to repay
     * @param   amount              Amount of asset to repay
     * @param   interestRateMode    Interest rate mode
     * @param   onBehalfOf          Repayment recipient
     */
    function aave_repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_aave_repay(asset, amount, interestRateMode, onBehalfOf);

        aave_pool.repay(asset, amount, interestRateMode, onBehalfOf);
    }

    /**
     * @notice  Swaps the borrow rate mode for the given asset
     * @param   asset               Address of asset to swap borrow rate mode
     * @param   interestRateMode    Interest rate mode
     */
    function aave_swapBorrowRateMode(address asset, uint256 interestRateMode) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_aave_swapBorrowRateMode(asset, interestRateMode);

        aave_pool.swapBorrowRateMode(asset, interestRateMode);
    }

    /**
     * @notice  Sets the user's eMode
     * @param   categoryId  Category id
     */
    function aave_setUserEMode(uint8 categoryId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        aave_pool.setUserEMode(categoryId);
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for aave_supply
     * @param   asset           Address of asset to supply
     * @param   amount          Amount of asset to supply
     * @param   onBehalfOf      Recipient of supply position
     * @param   referralCode    Aave referral code
     */
    function inputGuard_aave_supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) internal virtual {}

    /**
     * @notice  Validates inputs for aave_withdraw
     * @param   asset   Address of asset to withdraw
     * @param   amount  Amount of asset to withdraw
     * @param   to      Recipient of withdraw
     */
    function inputGuard_aave_withdraw(address asset, uint256 amount, address to) internal virtual {}

    /**
     * @notice  Validates inputs for aave_borrow
     * @param   asset               Address of asset to borrow
     * @param   amount              Amount of asset to borrow
     * @param   interestRateMode    Interest rate mode
     * @param   referralCode        Aave referral code
     * @param   to                  Recipient of borrow
     */
    function inputGuard_aave_borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address to
    ) internal virtual {}

    /**
     * @notice  Validates inputs for aave_repay
     * @param   asset               Address of asset to repay
     * @param   amount              Amount of asset to repay
     * @param   interestRateMode    Interest rate mode
     * @param   to                  Repayment recipient
     */
    function inputGuard_aave_repay(address asset, uint256 amount, uint256 interestRateMode, address to) internal virtual {}

    /**
     * @notice  Validates inputs for aave_swapBorrowRateMode
     * @param   asset               Address of asset to swap interest rate modes
     * @param   interestRateMode    Interest rate mode
     */
    function inputGuard_aave_swapBorrowRateMode(address asset, uint256 interestRateMode) internal virtual {}

    // solhint-enable no-empty-blocks
}
