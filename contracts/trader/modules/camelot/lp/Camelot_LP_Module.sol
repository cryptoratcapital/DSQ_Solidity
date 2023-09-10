// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Camelot_LP_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared Camelot LP Module
 * @notice  Allows adding and removing liquidity via the Camelot Router contract
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Camelot_LP_Module is Camelot_LP_Base, DSQ_Trader_Storage {
    /**
     * @notice Sets the address of the Camelot router and Weth token
     * @param _camelot_router   Camelot router address
     * @param _weth             WETH token address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _camelot_router, address _weth) Camelot_LP_Base(_camelot_router, _weth) {}

    // ---------- Input Guards ----------

    /// @inheritdoc Camelot_LP_Base
    function inputGuard_camelot_addLiquidity(
        address tokenA,
        address tokenB,
        uint, // amountADesired
        uint, // amountBDesired
        uint, // amountAMin
        uint, // amountBMin
        address to,
        uint // deadline
    ) internal view override {
        validateToken(tokenA);
        validateToken(tokenB);
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc Camelot_LP_Base
    function inputGuard_camelot_addLiquidityETH(
        uint, // valueIn
        address token,
        uint, // amountTokenDesired
        uint, // amountTokenMin
        uint, // amountETHMin
        address to,
        uint // deadline
    ) internal view override {
        validateToken(token);
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc Camelot_LP_Base
    function inputGuard_camelot_removeLiquidity(
        address tokenA,
        address tokenB,
        uint, // liquidity
        uint, // amountAMin
        uint, // amountBMin
        address to,
        uint // deadline
    ) internal view override {
        validateToken(tokenA);
        validateToken(tokenB);
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc Camelot_LP_Base
    function inputGuard_camelot_removeLiquidityETH(
        address token,
        uint, // liquidity
        uint, // amountTokenMin
        uint, // amountETHMin
        address to,
        uint // deadline
    ) internal view override {
        validateToken(token);
        require(to == address(this), "GuardError: Invalid recipient");
    }
}
