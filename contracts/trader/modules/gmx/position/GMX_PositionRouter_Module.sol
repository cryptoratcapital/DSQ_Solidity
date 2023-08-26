// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./GMX_PositionRouter_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared GMX PositionRouter Module
 * @notice  Allows leveraged long/short positions to be opened on the GMX Position Router
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the swap path and index token are acceptable.
 *              2. Inheritor MAY check size, leverage, and option direction if desired.
 *              3. Inheritor MUST validate the callback target address.
 *              4. Inheritor MUST validate the receiver address.
 *              5. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @dev     Several functions are payable to allow passing an execution fee to the Position Router.
 *          Execution fee ETH may be provided with msg.value or as a general pool in this contract's balance.
 *          This contract does not pass through msg.value or enforce a dedicated fee fund pool.
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract GMX_PositionRouter_Module is GMX_PositionRouter_Base, DSQ_Trader_Storage {
    /**
     * @notice  Sets the addresses of the GMX Router and PositionRouter
     * @param   _gmx_router             GMX Router address
     * @param   _gmx_positionRouter     GMX PositionRouter address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _gmx_router, address _gmx_positionRouter) GMX_PositionRouter_Base(_gmx_router, _gmx_positionRouter) {}

    // ----- GMX PositionRouter Module -----

    /// @inheritdoc GMX_PositionRouter_Base
    function inputGuard_gmx_createIncreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256, // _amountIn
        uint256, // _minOut
        uint256, // _sizeDelta
        bool, // _isLong
        uint256, // _acceptablePrice
        uint256 _executionFee,
        bytes32, // _referralCode
        address _callbackTarget
    ) internal view virtual override {
        validateSwapPath(_path);
        validateToken(_indexToken);
        require(_executionFee == msg.value, "GuardError: GMX execution fee");
        require(_callbackTarget == address(0), "GuardError: GMX callback target");
    }

    /// @inheritdoc GMX_PositionRouter_Base
    function inputGuard_gmx_createIncreasePositionETH(
        uint256, // _valueIn
        address[] memory _path,
        address _indexToken,
        uint256, // _minOut
        uint256, // _sizeDelta
        bool, // _isLong
        uint256, // _acceptablePrice
        uint256 _executionFee,
        bytes32, // _referralCode
        address _callbackTarget
    ) internal view virtual override {
        validateSwapPath(_path);
        validateToken(_indexToken);
        require(_executionFee == msg.value, "GuardError: GMX execution fee");
        require(_callbackTarget == address(0), "GuardError: GMX callback target");
    }

    /// @inheritdoc GMX_PositionRouter_Base
    function inputGuard_gmx_createDecreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256, // _collateralDelta
        uint256, // _sizeDelta
        bool, // _isLong
        address _receiver,
        uint256, // _acceptablePrice
        uint256, // _minOut
        uint256 _executionFee,
        bool, // _withdrawETH
        address _callbackTarget
    ) internal view virtual override {
        validateSwapPath(_path);
        validateToken(_indexToken);
        require(_executionFee == msg.value, "GuardError: GMX execution fee");
        // solhint-disable-next-line reason-string
        require(_receiver == address(this), "GuardError: GMX DecreasePosition recipient");
        require(_callbackTarget == address(0), "GuardError: GMX callback target");
    }

    // bytes32 _key, address payable _executionFeeReceiver
    function inputGuard_gmx_cancelIncreasePosition(bytes32, address payable _executionFeeReceiver) internal view virtual override {
        // solhint-disable-next-line reason-string
        require(
            _hasRole(EXECUTOR_ROLE, _executionFeeReceiver) || _hasRole(DEFAULT_ADMIN_ROLE, _executionFeeReceiver),
            "GuardError: GMX CancelIncreasePosition recipient"
        );
    }

    // bytes32 _key, address payable _executionFeeReceiver
    function inputGuard_gmx_cancelDecreasePosition(bytes32, address payable _executionFeeReceiver) internal view virtual override {
        // solhint-disable-next-line reason-string
        require(
            _hasRole(EXECUTOR_ROLE, _executionFeeReceiver) || _hasRole(DEFAULT_ADMIN_ROLE, _executionFeeReceiver),
            "GuardError: GMX CancelDecreasePosition recipient"
        );
    }
}
