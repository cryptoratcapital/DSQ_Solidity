// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/gmx_interfaces/IOrderBook.sol";
import "../../../external/gmx_interfaces/IRouter.sol";

/**
 * @title   DSquared GMX OrderBook Base
 * @notice  Allows limit orders to be opened on the GMX Order Book
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the swap path, index token, and collateral token are acceptable.
 *              2. Inheritor MAY check position size and direction if desired.
 *              3. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @dev     Several functions are payable to allow passing an execution fee to the Order Book.
 *          Execution fee ETH may be provided with msg.value or as a general pool in this contract's balance.
 *          This contract does not pass through msg.value or enforce a dedicated fee fund pool.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract GMX_OrderBook_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase

    /// @notice GMX Router address
    IRouter public immutable gmx_router;
    /// @notice GMX OrderBook address
    IOrderBook public immutable gmx_orderBook;

    /**
     * @notice Sets the address of the GMX Router and OrderBook
     * @param _gmx_router       GMX Router address
     * @param _gmx_orderBook    GMX OrderBook address
     */
    constructor(address _gmx_router, address _gmx_orderBook) {
        require(_gmx_router != address(0) && _gmx_orderBook != address(0), "GMX_OrderBook_Base: Zero Address");
        gmx_router = IRouter(_gmx_router);
        gmx_orderBook = IOrderBook(_gmx_orderBook);
    }

    // solhint-enable var-name-mixedcase

    /**
     * @notice Approves the GMX Order Book plugin in the GMX router
     */
    function init_GMX_OrderBook() external {
        gmx_router.approvePlugin(address(gmx_orderBook));
    }

    // ---------- Functions ----------

    /**
     * @notice Creates a GMX increase order
     * @param _path                     Token path
     * @param _amountIn                 Amount in
     * @param _indexToken               Index token address
     * @param _minOut                   Minimum output amount
     * @param _sizeDelta                Size delta
     * @param _collateralToken          Collateral token address
     * @param _isLong                   Is long order
     * @param _triggerPrice             Trigger price
     * @param _triggerAboveThreshold    Trigger if above thresold
     * @param _executionFee             Execution fee
     * @param _shouldWrap               Should wrap native token
     */
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
    ) external payable onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_createIncreaseOrder(
            _path,
            _amountIn,
            _indexToken,
            _minOut,
            _sizeDelta,
            _collateralToken,
            _isLong,
            _triggerPrice,
            _triggerAboveThreshold,
            _executionFee,
            _shouldWrap
        );

        uint256 msgValue = _shouldWrap ? _amountIn + _executionFee : _executionFee;

        gmx_orderBook.createIncreaseOrder{ value: msgValue }(
            _path,
            _amountIn,
            _indexToken,
            _minOut,
            _sizeDelta,
            _collateralToken,
            _isLong,
            _triggerPrice,
            _triggerAboveThreshold,
            _executionFee,
            _shouldWrap
        );
    }

    /**
     * @notice Creates a GMX decrease order
     * @param _indexToken               Index token address
     * @param _sizeDelta                Size delta
     * @param _collateralToken          Collateral token address
     * @param _collateralDelta          Collateral delta
     * @param _isLong                   Is long position
     * @param _triggerPrice             Trigger price
     * @param _triggerAboveThreshold    Trigger above threshold
     * @param _executionFee             Execution fee
     */
    function gmx_createDecreaseOrder(
        address _indexToken,
        uint256 _sizeDelta,
        address _collateralToken,
        uint256 _collateralDelta,
        bool _isLong,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold,
        uint256 _executionFee
    ) external payable onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_createDecreaseOrder(
            _indexToken,
            _sizeDelta,
            _collateralToken,
            _collateralDelta,
            _isLong,
            _triggerPrice,
            _triggerAboveThreshold,
            _executionFee
        );

        gmx_orderBook.createDecreaseOrder{ value: _executionFee }(
            _indexToken,
            _sizeDelta,
            _collateralToken,
            _collateralDelta,
            _isLong,
            _triggerPrice,
            _triggerAboveThreshold
        );
    }

    /**
     * @notice Creates a GMX swap order
     * @param _path                     Token path
     * @param _amountIn                 Amount in
     * @param _minOut                   Minimum amount out
     * @param _triggerRatio             Trigger ratio
     * @param _triggerAboveThreshold    Trigger above threshold
     * @param _executionFee             Execution fee
     * @param _shouldWrap               Should wrap native token
     * @param _shouldUnwrap             Should unwrap native token
     */
    function gmx_createSwapOrder(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _triggerRatio, // tokenB / tokenA
        bool _triggerAboveThreshold,
        uint256 _executionFee,
        bool _shouldWrap,
        bool _shouldUnwrap
    ) external payable onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_createSwapOrder(
            _path,
            _amountIn,
            _minOut,
            _triggerRatio,
            _triggerAboveThreshold,
            _executionFee,
            _shouldWrap,
            _shouldUnwrap
        );

        uint256 msgValue = _shouldWrap ? _amountIn + _executionFee : _executionFee;

        gmx_orderBook.createSwapOrder{ value: msgValue }(
            _path,
            _amountIn,
            _minOut,
            _triggerRatio,
            _triggerAboveThreshold,
            _executionFee,
            _shouldWrap,
            _shouldUnwrap
        );
    }

    /**
     * @notice Updates a GMX increase order
     * @param _orderIndex               Order index
     * @param _sizeDelta                Size delta
     * @param _triggerPrice             New trigger price
     * @param _triggerAboveThreshold    New trigger above threshold
     */
    function gmx_updateIncreaseOrder(
        uint256 _orderIndex,
        uint256 _sizeDelta,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_updateIncreaseOrder(_orderIndex, _sizeDelta, _triggerPrice, _triggerAboveThreshold);

        gmx_orderBook.updateIncreaseOrder(_orderIndex, _sizeDelta, _triggerPrice, _triggerAboveThreshold);
    }

    /**
     * @notice Updates a GMX decrease order
     * @param _orderIndex               Order index
     * @param _collateralDelta          Collateral delta
     * @param _sizeDelta                Size delta
     * @param _triggerPrice             New trigger price
     * @param _triggerAboveThreshold    New trigger above threshold
     */
    function gmx_updateDecreaseOrder(
        uint256 _orderIndex,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_updateDecreaseOrder(_orderIndex, _collateralDelta, _sizeDelta, _triggerPrice, _triggerAboveThreshold);

        gmx_orderBook.updateDecreaseOrder(_orderIndex, _collateralDelta, _sizeDelta, _triggerPrice, _triggerAboveThreshold);
    }

    /**
     * @notice Cancels a GMX increase order
     * @param _orderIndex   Order index
     */
    function gmx_cancelIncreaseOrder(uint256 _orderIndex) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_cancelIncreaseOrder(_orderIndex);

        gmx_orderBook.cancelIncreaseOrder(_orderIndex);
    }

    /**
     * @notice Cancels a GMX decrease order
     * @param _orderIndex   Order index
     */
    function gmx_cancelDecreaseOrder(uint256 _orderIndex) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_cancelDecreaseOrder(_orderIndex);

        gmx_orderBook.cancelDecreaseOrder(_orderIndex);
    }

    /**
     * @notice Cancels a GMX swap order
     * @param _orderIndex   Order index
     */
    function gmx_cancelSwapOrder(uint256 _orderIndex) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_cancelSwapOrder(_orderIndex);

        gmx_orderBook.cancelSwapOrder(_orderIndex);
    }

    /**
     * @notice Cancels multiple GMX orders
     * @param _swapOrderIndexes         Array of swap order indexes
     * @param _increaseOrderIndexes     Array of increase order indexes
     * @param _decreaseOrderIndexes     Array of decrease order indexes
     */
    function gmx_cancelMultiple(
        uint256[] memory _swapOrderIndexes,
        uint256[] memory _increaseOrderIndexes,
        uint256[] memory _decreaseOrderIndexes
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_gmx_cancelMultiple(_swapOrderIndexes, _increaseOrderIndexes, _decreaseOrderIndexes);

        gmx_orderBook.cancelMultiple(_swapOrderIndexes, _increaseOrderIndexes, _decreaseOrderIndexes);
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice Validates inputs for gmx_createIncreaseOrder
     * @param _path                     Token path
     * @param _amountIn                 Amount in
     * @param _indexToken               Index token address
     * @param _minOut                   Minimum output amount
     * @param _sizeDelta                Size delta
     * @param _collateralToken          Collateral token address
     * @param _isLong                   Is long order
     * @param _triggerPrice             Trigger price
     * @param _triggerAboveThreshold    Trigger if above thresold
     * @param _executionFee             Execution fee
     * @param _shouldWrap               Should wrap native token
     */
    function inputGuard_gmx_createIncreaseOrder(
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
    ) internal virtual {}

    /**
     * @notice Validates inputs for gmx_createDecreaseOrder
     * @param _indexToken               Index token address
     * @param _sizeDelta                Size delta
     * @param _collateralToken          Collateral token address
     * @param _collateralDelta          Collateral delta
     * @param _isLong                   Is long position
     * @param _triggerPrice             Trigger price
     * @param _triggerAboveThreshold    Trigger above threshold
     * @param _executionFee             Execution fee
     */
    function inputGuard_gmx_createDecreaseOrder(
        address _indexToken,
        uint256 _sizeDelta,
        address _collateralToken,
        uint256 _collateralDelta,
        bool _isLong,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold,
        uint256 _executionFee
    ) internal virtual {}

    /**
     * @notice Validates inputs for gmx_createSwapOrder
     * @param _path                     Token path
     * @param _amountIn                 Amount in
     * @param _minOut                   Minimum amount out
     * @param _triggerRatio             Trigger ratio
     * @param _triggerAboveThreshold    Trigger above threshold
     * @param _executionFee             Execution fee
     * @param _shouldWrap               Should wrap native token
     * @param _shouldUnwrap             Should unwrap native token
     */
    function inputGuard_gmx_createSwapOrder(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _triggerRatio,
        bool _triggerAboveThreshold,
        uint256 _executionFee,
        bool _shouldWrap,
        bool _shouldUnwrap
    ) internal virtual {}

    /**
     * @notice Validates inputs for gmx_updateIncreaseOrder
     * @param _orderIndex               Order index
     * @param _sizeDelta                Size delta
     * @param _triggerPrice             New trigger price
     * @param _triggerAboveThreshold    New trigger above threshold
     */
    function inputGuard_gmx_updateIncreaseOrder(
        uint256 _orderIndex,
        uint256 _sizeDelta,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold
    ) internal virtual {}

    /**
     * @notice Validates inputs for gmx_updateDecreaseOrder
     * @param _orderIndex               Order index
     * @param _collateralDelta          Collateral delta
     * @param _sizeDelta                Size delta
     * @param _triggerPrice             New trigger price
     * @param _triggerAboveThreshold    New trigger above threshold
     */
    function inputGuard_gmx_updateDecreaseOrder(
        uint256 _orderIndex,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold
    ) internal virtual {}

    /**
     * @notice Validates inputs for gmx_cancelIncreaseOrder
     * @param _orderIndex   Order index
     */
    function inputGuard_gmx_cancelIncreaseOrder(uint256 _orderIndex) internal virtual {}

    /**
     * @notice Validates inputs for gmx_cancelDecreaseOrder
     * @param _orderIndex   Order index
     */
    function inputGuard_gmx_cancelDecreaseOrder(uint256 _orderIndex) internal virtual {}

    /**
     * @notice Validates inputs for gmx_cancelSwapOrder
     * @param _orderIndex   Order index
     */
    function inputGuard_gmx_cancelSwapOrder(uint256 _orderIndex) internal virtual {}

    /**
     * @notice Validates inputs for gmx_cancelMultiple
     * @param _swapOrderIndexes         Array of swap order indexes
     * @param _increaseOrderIndexes     Array of increase order indexes
     * @param _decreaseOrderIndexes     Array of decrease order indexes
     */
    function inputGuard_gmx_cancelMultiple(
        uint256[] memory _swapOrderIndexes,
        uint256[] memory _increaseOrderIndexes,
        uint256[] memory _decreaseOrderIndexes
    ) internal virtual {}
    // solhint-enable no-empty-blocks
}
