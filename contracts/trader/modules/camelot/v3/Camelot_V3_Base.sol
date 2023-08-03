// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../storage/Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/INonfungiblePositionManager.sol";
import "../../../external/camelot_interfaces/IOdosRouter.sol";

/**
 * @title   DSquared Camelot V3 Base
 * @notice  Allows adding and removing liquidity via the NonfungiblePositionManager contract
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
abstract contract Camelot_V3_Base is AccessControl, ReentrancyGuard, Camelot_Common_Storage {
    // solhint-disable var-name-mixedcase
    using SafeERC20 for IERC20;

    /// @notice Algebra position manager address
    INonfungiblePositionManager public immutable position_manager;
    /// @notice Odos router address
    IOdosRouter public immutable odos_router;

    /**
     * @notice  Sets the address of the Algebra position manager and Odos router
     * @param   _position_manager   Algebra position manager address
     * @param   _odos_router        Odos router address
     */
    constructor(address _position_manager, address _odos_router) {
        // solhint-disable-next-line reason-string
        require(_position_manager != address(0) && _odos_router != address(0), "Camelot_V3_Base: Zero address");
        position_manager = INonfungiblePositionManager(_position_manager);
        odos_router = IOdosRouter(_odos_router);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Performs a swap via the Odos router
     * @dev     This function uses the odos router
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

    /**
     * @notice  Mints a new CamelotV3 liquidity position via the position manager
     * @param   valueIn     Msg.value to send with tx
     * @param   params      Mint params
     */
    function camelot_v3_mint(
        uint256 valueIn,
        INonfungiblePositionManager.MintParams calldata params
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 tokenId) {
        inputGuard_camelot_v3_mint(valueIn, params);
        (tokenId, , , ) = position_manager.mint{ value: valueIn }(params);
        position_manager.refundNativeToken();
    }

    /**
     * @notice  Increases liquidity in CamelotV3 liquidity position
     * @param   valueIn     Msg.value to send with tx
     * @param   params      Increase liquidity params
     */
    function camelot_v3_increaseLiquidity(
        uint256 valueIn,
        INonfungiblePositionManager.IncreaseLiquidityParams calldata params
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_v3_increaseLiquidity(valueIn, params);
        position_manager.increaseLiquidity{ value: valueIn }(params);
        position_manager.refundNativeToken();
    }

    /**
     * @notice  Decreases liquidity in CamelotV3 liquidity position
     * @dev     Input guard is not needed for this function
     * @param   params  Decrease liquidity params
     */
    function camelot_v3_decreaseLiquidity(
        INonfungiblePositionManager.DecreaseLiquidityParams calldata params
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        position_manager.decreaseLiquidity(params);
    }

    /**
     * @notice  Collects outstanding owed tokens from the position manager
     * @param   params  Collect params
     */
    function camelot_v3_collect(INonfungiblePositionManager.CollectParams memory params) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_v3_collect(params);
        position_manager.collect(params);
    }

    /**
     * @notice  Burns a CamelotV3 liquidity position
     * @dev     Input guard is not needed for this function
     * @param   tokenId     Token id to burn
     */
    function camelot_v3_burn(uint256 tokenId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        position_manager.burn(tokenId);
    }

    /**
     * @notice  Helper function to decrease liquidity and collect from position manager
     * @dev     Only collect input guard is used within this function
     * @param   decreaseParams  Decrease liquidity params
     * @param   collectParams   Collect params
     */
    function camelot_v3_decreaseLiquidityAndCollect(
        INonfungiblePositionManager.DecreaseLiquidityParams calldata decreaseParams,
        INonfungiblePositionManager.CollectParams memory collectParams
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_v3_collect(collectParams);
        position_manager.decreaseLiquidity(decreaseParams);
        position_manager.collect(collectParams);
    }

    /**
     * @notice  Helper function to decrease liquidity, collect and burn liquidity position
     * @dev     Only collect input guard is used within this function
     * @param   decreaseParams  Decrease liquidity params
     * @param   collectParams   Collect params
     * @param   tokenId         Token id to burn
     */
    function camelot_v3_decreaseLiquidityCollectAndBurn(
        INonfungiblePositionManager.DecreaseLiquidityParams calldata decreaseParams,
        INonfungiblePositionManager.CollectParams memory collectParams,
        uint256 tokenId
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_v3_collect(collectParams);
        position_manager.decreaseLiquidity(decreaseParams);
        position_manager.collect(collectParams);
        position_manager.burn(tokenId);
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

    /**
     * @notice  Validates inputs for camelot_v3_mint
     * @param   valueIn     Msg.value to send with tx
     * @param   params      Mint params
     */
    function inputGuard_camelot_v3_mint(uint256 valueIn, INonfungiblePositionManager.MintParams calldata params) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_v3_increaseLiquidity
     * @param   valueIn     Msg.value to send with tx
     * @param   params      Increase liquidity params
     */
    function inputGuard_camelot_v3_increaseLiquidity(
        uint256 valueIn,
        INonfungiblePositionManager.IncreaseLiquidityParams calldata params
    ) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_v3_collect
     * @param   params  Collect params
     */
    function inputGuard_camelot_v3_collect(INonfungiblePositionManager.CollectParams memory params) internal virtual {}

    // solhint-enable no-empty-blocks
}
