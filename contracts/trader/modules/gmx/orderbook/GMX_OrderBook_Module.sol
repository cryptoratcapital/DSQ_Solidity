// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./GMX_OrderBook_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared GMX OrderBook Module
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
contract GMX_OrderBook_Module is GMX_OrderBook_Base, DSQ_Trader_Storage {
    /**
     * @notice Sets the address of the GMX Router and OrderBook
     * @param _gmx_router       GMX Router address
     * @param _gmx_orderBook    GMX OrderBook address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _gmx_router, address _gmx_orderBook) GMX_OrderBook_Base(_gmx_router, _gmx_orderBook) {}

    // ----- GMX OrderBook Module -----

    /// @inheritdoc GMX_OrderBook_Base
    function inputGuard_gmx_createIncreaseOrder(
        address[] memory _path,
        uint256, // _amountIn
        address _indexToken,
        uint256, // _minOut
        uint256, // _sizeDelta
        address _collateralToken,
        bool, // _isLong
        uint256, // _triggerPrice
        bool, // _triggerAboveThreshold
        uint256, // _executionFee
        bool // _shouldWrap
    ) internal view virtual override {
        validateSwapPath(_path);
        validateToken(_indexToken);
        validateToken(_collateralToken);
    }

    /// @inheritdoc GMX_OrderBook_Base
    function inputGuard_gmx_createDecreaseOrder(
        address _indexToken,
        uint256, // _sizeDelta
        address _collateralToken,
        uint256, // _collateralDelta
        bool, // _isLong
        uint256, // _triggerPrice
        bool, // _triggerAboveThreshold
        uint256 // _executionFee
    ) internal view virtual override {
        validateToken(_indexToken);
        validateToken(_collateralToken);
    }

    /// @inheritdoc GMX_OrderBook_Base
    function inputGuard_gmx_createSwapOrder(
        address[] memory _path,
        uint256, // _amountIn
        uint256, // _minOut
        uint256, // _triggerRatio // tokenB / tokenA
        bool, // _triggerAboveThreshold
        uint256, // _executionFee
        bool, // _shouldWrap
        bool // _shouldUnwrap
    ) internal view virtual override {
        validateSwapPath(_path);
    }
}
