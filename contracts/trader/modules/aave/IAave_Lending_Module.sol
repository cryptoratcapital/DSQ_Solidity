// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../external/aave_interfaces/IPool.sol";

/**
 * @title   DSquared Aave Lending Module Interface
 * @notice  Allows lending and borrowing via the Aave Pool Contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IAave_Lending_Module {
    // ---------- Functions ----------

    function aave_supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    function aave_withdraw(address asset, uint256 amount, address to) external;

    function aave_borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address to) external;

    function aave_repay(address asset, uint256 amount, uint256 interestRateMode, address to) external;

    function aave_swapBorrowRateMode(address asset, uint256 interestRateMode) external;

    function aave_setUserEMode(uint8 categoryId) external;

    // ---------- Getters ----------

    function aave_pool() external view returns (IPool);
}
