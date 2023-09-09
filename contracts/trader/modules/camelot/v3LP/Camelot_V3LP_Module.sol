// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Camelot_V3LP_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";
import "../../../external/camelot_interfaces/INonfungiblePositionManager.sol";

/**
 * @title   DSquared Camelot V3 LP Module
 * @notice  Allows adding and removing liquidity via the NonfungiblePositionManager contract
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Camelot_V3LP_Module is Camelot_V3LP_Base, DSQ_Trader_Storage {
    /**
     * @notice  Sets the address of the Algebra position manager
     * @param   _position_manager   Algebra position manager address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _position_manager) Camelot_V3LP_Base(_position_manager) {}

    // ---------- Input Guards ----------

    /// @inheritdoc Camelot_V3LP_Base
    // (uint256 valueIn, INonfungiblePositionManager.MintParams calldata params)
    function inputGuard_camelot_v3_mint(uint256, INonfungiblePositionManager.MintParams calldata params) internal view override {
        validateToken(params.token0);
        validateToken(params.token1);
        require(params.recipient == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc Camelot_V3LP_Base
    function inputGuard_camelot_v3_increaseLiquidity(
        uint256, // valueIn
        INonfungiblePositionManager.IncreaseLiquidityParams calldata params
    ) internal view override {
        require(position_manager.ownerOf(params.tokenId) == address(this), "GuardError: Invalid tokenId");
    }

    /// @inheritdoc Camelot_V3LP_Base
    function inputGuard_camelot_v3_collect(INonfungiblePositionManager.CollectParams memory params) internal view override {
        require(params.recipient == address(this), "GuardError: Invalid recipient");
    }
}
