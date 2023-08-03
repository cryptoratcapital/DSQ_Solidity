// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/gmx_interfaces/IRouter.sol";
import "../../../external/gmx_interfaces/IOrderBook.sol";

/**
 * @title   DSquared GMX OrderBook Module Interface
 * @notice  Allows limit orders to be opened on the GMX Order Book
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IGMX_OrderBook_Module {
    function init_GMX_OrderBook() external;

    // ---------- Functions ----------

    function gmx_createIncreaseOrder(
        address[] memory _path,
        uint256 _amountIn,
        address _indexToken,
        uint256 _minOut,
        uint256 _sizeDelta,
        address _collateralToken,
        bool _isLong,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold,
        uint256 _executionFee,
        bool _shouldWrap
    ) external payable;

    function gmx_createDecreaseOrder(
        address _indexToken,
        uint256 _sizeDelta,
        address _collateralToken,
        uint256 _collateralDelta,
        bool _isLong,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold,
        uint256 _executionFee
    ) external payable;

    function gmx_createSwapOrder(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _triggerRatio, // tokenB / tokenA
        bool _triggerAboveThreshold,
        uint256 _executionFee,
        bool _shouldWrap,
        bool _shouldUnwrap
    ) external payable;

    function gmx_updateIncreaseOrder(uint256 _orderIndex, uint256 _sizeDelta, uint256 _triggerPrice, bool _triggerAboveThreshold) external;

    function gmx_updateDecreaseOrder(
        uint256 _orderIndex,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold
    ) external;

    function gmx_cancelIncreaseOrder(uint256 _orderIndex) external;

    function gmx_cancelDecreaseOrder(uint256 _orderIndex) external;

    function gmx_cancelSwapOrder(uint256 _orderIndex) external;

    function gmx_cancelMultiple(
        uint256[] memory _swapOrderIndexes,
        uint256[] memory _increaseOrderIndexes,
        uint256[] memory _decreaseOrderIndexes
    ) external;

    // ---------- Getters ----------

    function gmx_router() external view returns (IRouter);

    function gmx_orderBook() external view returns (IOrderBook);
}
