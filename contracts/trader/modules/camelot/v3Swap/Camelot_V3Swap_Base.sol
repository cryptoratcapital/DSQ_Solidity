// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../storage/Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/IOdosRouter.sol";

/**
 * @title   DSquared Camelot V3 Swap Base
 * @notice  Allows swapping via the OdosRouter contract
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the tokens are valid
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_V3Swap_Base is AccessControl, ReentrancyGuard, Camelot_Common_Storage {
    // solhint-disable var-name-mixedcase

    /// @notice Odos router address
    IOdosRouter public immutable odos_router;

    /**
     * @notice  Sets the address of the Odos router
     * @param   _odos_router    Odos router address
     */
    constructor(address _odos_router) {
        // solhint-disable-next-line reason-string
        require(_odos_router != address(0), "Camelot_V3Swap_Base: Zero address");
        odos_router = IOdosRouter(_odos_router);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Performs a swap via the Odos router
     * @dev     This function uses the Odos router
     * @param   valueIn         Msg.value to send with the swap
     * @param   inputs          List of input token structs for the path being executed
     * @param   outputs         List of output token structs for the path being executed
     * @param   valueOutQuote   Value of destination tokens quoted for the path
     * @param   valueOutMin     Minimum amount of value out the user will accept
     * @param   executor        Address of contract that will execute the path
     * @param   pathDefinition  Encoded path definition for executor
     */
    function camelot_v3_swap(
        uint256 valueIn,
        IOdosRouter.inputToken[] memory inputs,
        IOdosRouter.outputToken[] memory outputs,
        uint256 valueOutQuote,
        uint256 valueOutMin,
        address executor,
        bytes calldata pathDefinition
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_v3_swap(valueIn, inputs, outputs, valueOutQuote, valueOutMin, executor, pathDefinition);
        odos_router.swap{ value: valueIn }(inputs, outputs, valueOutQuote, valueOutMin, executor, pathDefinition);
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for camelot_v3_swap
     * @param   valueIn         Msg.value to send with the swap
     * @param   inputs          List of input token structs for the path being executed
     * @param   outputs         List of output token structs for the path being executed
     * @param   valueOutQuote   Value of destination tokens quoted for the path
     * @param   valueOutMin     Minimum amount of value out the user will accept
     * @param   executor        Address of contract that will execute the path
     * @param   pathDefinition  Encoded path definition for executor
     */
    function inputGuard_camelot_v3_swap(
        uint256 valueIn,
        IOdosRouter.inputToken[] memory inputs,
        IOdosRouter.outputToken[] memory outputs,
        uint256 valueOutQuote,
        uint256 valueOutMin,
        address executor,
        bytes calldata pathDefinition
    ) internal virtual {}

    // solhint-enable no-empty-blocks
}
