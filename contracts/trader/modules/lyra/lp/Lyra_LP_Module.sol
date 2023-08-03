// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Lyra_LP_Base.sol";

/**
 * @title   DSquared Lyra LP Module
 * @notice  Allows depositing and withdrawing via the Lyra LiquidityPool Contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Lyra_LP_Module is Lyra_LP_Base {
    /**
     * @notice  Sets the address of the USDC token
     * @param   _usdc    USDC token address
     */
    // solhint-disable-next-line no-empty-blocks
    constructor(address _usdc) Lyra_LP_Base(_usdc) {}

    // (address pool, address beneficiary, uint256 amount)
    /// @inheritdoc Lyra_LP_Base
    function inputGuard_lyra_initiateDeposit(address pool, address beneficiary, uint256) internal view override {
        validateLyraPool(pool);
        require(beneficiary == address(this), "GuardError: Invalid recipient");
    }

    // (address pool, address beneficiary, uint256 amount)
    /// @inheritdoc Lyra_LP_Base
    function inputGuard_lyra_initiateWithdraw(address pool, address beneficiary, uint256) internal view override {
        validateLyraPool(pool);
        require(beneficiary == address(this), "GuardError: Invalid recipient");
    }
}
