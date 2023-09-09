// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../storage/Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/INonfungiblePositionManager.sol";
import "../../../external/camelot_interfaces/IOdosRouter.sol";

/**
 * @title   DSquared Camelot V3 Swap Module Interface
 * @notice  Allows swapping via the OdosRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ICamelot_V3Swap_Module {
    // ---------- Functions ----------

    function camelot_v3_swap(
        uint256 valueIn,
        IOdosRouter.inputToken[] memory inputs,
        IOdosRouter.outputToken[] memory outputs,
        uint256 valueOutQuote,
        uint256 valueOutMin,
        address executor,
        bytes calldata pathDefinition
    ) external;
}
