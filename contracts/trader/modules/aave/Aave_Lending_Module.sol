// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Aave_Lending_Base.sol";
import "../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared Aave Lending Module
 * @notice  Validates inputs from Aave Lending Base functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Aave_Lending_Module is Aave_Lending_Base, DSQ_Trader_Storage {
    /**
     * @notice  Sets the address of the Aave lending pool
     * @param   _aave_pool    Aave lending pool address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _aave_pool) Aave_Lending_Base(_aave_pool) {}

    // (address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
    /// @inheritdoc Aave_Lending_Base
    function inputGuard_aave_supply(address asset, uint256, address onBehalfOf, uint16) internal view override {
        validateToken(asset);
        require(onBehalfOf == address(this), "GuardError: Invalid recipient");
    }

    // (address asset, uint256 amount, address to)
    /// @inheritdoc Aave_Lending_Base
    function inputGuard_aave_withdraw(address asset, uint256, address to) internal view override {
        validateToken(asset);
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc Aave_Lending_Base
    function inputGuard_aave_borrow(
        address asset,
        uint256, // amount
        uint256, // interestRateMode
        uint16, // referralCode
        address to
    ) internal view override {
        validateToken(asset);
        require(to == address(this), "GuardError: Invalid recipient");
    }

    // (address asset, uint256 amount, uint256 interestRateMode, address to)
    /// @inheritdoc Aave_Lending_Base
    function inputGuard_aave_repay(address asset, uint256, uint256, address to) internal view override {
        validateToken(asset);
        require(to == address(this), "GuardError: Invalid recipient");
    }

    // (address asset, uint256 interestRateMode)
    /// @inheritdoc Aave_Lending_Base
    function inputGuard_aave_swapBorrowRateMode(address asset, uint256) internal view override {
        validateToken(asset);
    }
}
