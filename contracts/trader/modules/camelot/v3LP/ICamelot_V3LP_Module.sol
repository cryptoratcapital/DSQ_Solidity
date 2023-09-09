// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../storage/Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/INonfungiblePositionManager.sol";
import "../../../external/camelot_interfaces/IOdosRouter.sol";

/**
 * @title   DSquared Camelot V3 LP Module Interface
 * @notice  Allows adding and removing liquidity via the NonfungiblePositionManager contract
 * @notice  Allows swapping via the OdosRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ICamelot_V3LP_Module {
    // ---------- Functions ----------

    function camelot_v3_mint(uint256 valueIn, INonfungiblePositionManager.MintParams calldata params) external returns (uint256);

    function camelot_v3_burn(uint256 tokenId) external;

    function camelot_v3_collect(INonfungiblePositionManager.CollectParams memory params) external;

    function camelot_v3_increaseLiquidity(uint256 valueIn, INonfungiblePositionManager.IncreaseLiquidityParams calldata params) external;

    function camelot_v3_decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams calldata params) external;

    function camelot_v3_decreaseLiquidityAndCollect(
        INonfungiblePositionManager.DecreaseLiquidityParams calldata decreaseParams,
        INonfungiblePositionManager.CollectParams memory collectParams
    ) external;

    function camelot_v3_decreaseLiquidityCollectAndBurn(
        INonfungiblePositionManager.DecreaseLiquidityParams calldata decreaseParams,
        INonfungiblePositionManager.CollectParams memory collectParams,
        uint256 tokenId
    ) external;
}
