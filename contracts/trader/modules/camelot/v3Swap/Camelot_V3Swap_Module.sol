// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Camelot_V3Swap_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";
import "../../../external/camelot_interfaces/INonfungiblePositionManager.sol";

/**
 * @title   DSquared Camelot V3 Swap Module
 * @notice  Allows swapping via the OdosRouter contract
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Camelot_V3Swap_Module is Camelot_V3Swap_Base, DSQ_Trader_Storage {
    /**
     * @notice  Sets the address of the Algebra position manager and Odos router
     * @param   _odos_router        Odos router address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _odos_router) Camelot_V3Swap_Base(_odos_router) {}

    // ---------- Input Guards ----------

    /// @inheritdoc Camelot_V3Swap_Base
    function inputGuard_camelot_v3_swap(
        uint256, // valueIn
        IOdosRouter.inputToken[] memory inputs,
        IOdosRouter.outputToken[] memory outputs,
        uint256 valueOutQuote, // valueOutQuote
        uint256, // valueOutMin
        address executor, // executor
        bytes calldata // pathDefinition
    ) internal view override {
        // solhint-disable-next-line reason-string
        require(valueOutQuote == type(uint256).max, "GuardError: Invalid valueOutQuote");
        validateExecutor(executor);
        uint256 len = inputs.length;
        for (uint i; i < len; ) {
            if (inputs[i].receiver != executor) validateReceiver(inputs[i].receiver);
            if (inputs[i].tokenAddress != address(0)) validateToken(inputs[i].tokenAddress);
            unchecked {
                ++i;
            }
        }
        len = outputs.length;
        for (uint i; i < len; ) {
            if (outputs[i].tokenAddress != address(0)) validateToken(outputs[i].tokenAddress);
            require(outputs[i].receiver == address(this), "GuardError: Invalid recipient");
            unchecked {
                ++i;
            }
        }
    }
}
