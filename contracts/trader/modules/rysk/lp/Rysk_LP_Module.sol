// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Rysk_LP_Base.sol";

/**
 * @title   DSquared Rysk LP Module
 * @notice  Allows depositing, redeeming and withdrawing via the Rysk LiquidityPool Contract
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Rysk_LP_Module is Rysk_LP_Base {
    /**
     * @notice  Sets the address of the Rysk liquidity pool
     * @param   _rysk_liquidity_pool    Rysk liquidity pool address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _rysk_liquidity_pool) Rysk_LP_Base(_rysk_liquidity_pool) {}
}
