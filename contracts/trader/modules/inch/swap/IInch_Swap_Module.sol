// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/inch_interfaces/IAggregationRouter.sol";
import "../../../external/inch_interfaces/IAggregationExecutor.sol";
import "../../../external/clipper_interfaces/IClipperExchangeInterface.sol";

/**
 * @title   DSquared Inch Swap Module Interface
 * @notice  Allows swapping via the 1Inch AggregationRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IInch_Swap_Module {
    // ---------- Functions ----------

    function inch_swap(
        uint256 valueIn,
        IAggregationExecutor executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external returns (uint256 returnAmount, uint256 spentAmount);

    function inch_uniswapV3Swap(
        uint256 valueIn,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external returns (uint256 returnAmount);

    function inch_clipperSwap(
        uint256 valueIn,
        IClipperExchangeInterface clipperExchange,
        IERC20 srcToken,
        IERC20 dstToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 goodUntil,
        bytes32 r,
        bytes32 vs
    ) external returns (uint256 returnAmount);

    // ---------- Getters ----------

    function inch_aggregation_router() external view returns (IAggregationRouter);

    function inch_clipper_exchange() external view returns (IClipperExchangeInterface);
}
