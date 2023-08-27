// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/gmx_interfaces/IRouter.sol";
import "../../../external/gmx_interfaces/IPositionRouter.sol";

/**
 * @title   DSquared GMX PositionRouter Base
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
 *          The base contract does not enforce a source of execution fee ETH.
 * @dev     WARNING: This module can leave a strategy with a balance of native ETH.
 *          It MUST be deployed alongside another module capable of withdrawing native ETH or swapping it to a mandate token.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract GMX_PositionRouter_Base is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    // solhint-disable var-name-mixedcase

    /// @notice GMX Router address
    IRouter public immutable gmx_router;
    /// @notice GMX PositionRouter address
    IPositionRouter public immutable gmx_positionRouter;

    /**
     * @notice  Sets the addresses of the GMX Router and PositionRouter
     * @param   _gmx_router             GMX Router address
     * @param   _gmx_positionRouter     GMX PositionRouter address
     */
    constructor(address _gmx_router, address _gmx_positionRouter) {
        // solhint-disable-next-line reason-string
        require(_gmx_router != address(0) && _gmx_positionRouter != address(0), "GMX_PositionRouter_Base: Zero Address");
        gmx_router = IRouter(_gmx_router);
        gmx_positionRouter = IPositionRouter(_gmx_positionRouter);
    }

    // solhint-enable var-name-mixedcase

    /**
     * @notice  Approves the GMX PositionRouter plugin on the GMX Router
     * @dev     This is an initialization function which should not be added to any diamond's selectors
     */
    function init_GMX_PositionRouter() external {
        gmx_router.approvePlugin(address(gmx_positionRouter));
    }

    // ---------- Functions ----------

    /**
     * @notice  Creates a positionRouter increase position
     * @dev     Approval must be handled via another function
     * @param _path             Token path
     * @param _indexToken       Index token
     * @param _amountIn         Amount in
     * @param _minOut           Minimum amount out
     * @param _sizeDelta        Size delta
     * @param _isLong           Is long position
     * @param _acceptablePrice  Acceptable price
     * @param _executionFee     Execution fee
     * @param _referralCode     Referral code
     * @param _callbackTarget   Callback target
     */
    function gmx_createIncreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _acceptablePrice,
        uint256 _executionFee,
        bytes32 _referralCode,
        address _callbackTarget
    ) external payable onlyRole(EXECUTOR_ROLE) nonReentrant returns (bytes32) {
        inputGuard_gmx_createIncreasePosition(
            _path,
            _indexToken,
            _amountIn,
            _minOut,
            _sizeDelta,
            _isLong,
            _acceptablePrice,
            _executionFee,
            _referralCode,
            _callbackTarget
        );

        return
            gmx_positionRouter.createIncreasePosition{ value: _executionFee }(
                _path,
                _indexToken,
                _amountIn,
                _minOut,
                _sizeDelta,
                _isLong,
                _acceptablePrice,
                _executionFee,
                _referralCode,
                _callbackTarget
            );
    }

    /**
     * @notice  Creates a positionRouter increase position with native token
     * @dev     Approval must be handled via another function
     * @dev     Note the _amountIn parameter, which does not exist in the direct GMX call
     * @param _valueIn          Msg.value to send with tx
     * @param _path             Token path
     * @param _indexToken       Index token
     * @param _minOut           Minimum amount out
     * @param _sizeDelta        Size delta
     * @param _isLong           Is long position
     * @param _acceptablePrice  Acceptable price
     * @param _executionFee     Execution fee
     * @param _referralCode     Referral code
     * @param _callbackTarget   Callback target
     */
    function gmx_createIncreasePositionETH(
        uint256 _valueIn,
        address[] memory _path,
        address _indexToken,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _acceptablePrice,
        uint256 _executionFee,
        bytes32 _referralCode,
        address _callbackTarget
    ) external payable onlyRole(EXECUTOR_ROLE) nonReentrant returns (bytes32) {
        inputGuard_gmx_createIncreasePositionETH(
            _valueIn,
            _path,
            _indexToken,
            _minOut,
            _sizeDelta,
            _isLong,
            _acceptablePrice,
            _executionFee,
            _referralCode,
            _callbackTarget
        );

        return
            gmx_positionRouter.createIncreasePositionETH{ value: _valueIn + _executionFee }(
                _path,
                _indexToken,
                _minOut,
                _sizeDelta,
                _isLong,
                _acceptablePrice,
                _executionFee,
                _referralCode,
                _callbackTarget
            );
    }

    /**
     * @notice  Creates a positionRouter decrease position
     * @dev     Approval must be handled via another function
     * @param _path             Path
     * @param _indexToken       Index token address
     * @param _collateralDelta  Collateral delta
     * @param _sizeDelta        Size delta
     * @param _isLong           Is long position
     * @param _receiver         Receiver address
     * @param _acceptablePrice  Acceptable price
     * @param _minOut           Minimum amount out
     * @param _executionFee     Execution fee
     * @param _withdrawETH      Withdraw ETH
     * @param _callbackTarget   Callback target
     */
    function gmx_createDecreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        bool _isLong,
        address _receiver,
        uint256 _acceptablePrice,
        uint256 _minOut,
        uint256 _executionFee,
        bool _withdrawETH,
        address _callbackTarget
    ) external payable onlyRole(EXECUTOR_ROLE) nonReentrant returns (bytes32) {
        inputGuard_gmx_createDecreasePosition(
            _path,
            _indexToken,
            _collateralDelta,
            _sizeDelta,
            _isLong,
            _receiver,
            _acceptablePrice,
            _minOut,
            _executionFee,
            _withdrawETH,
            _callbackTarget
        );

        return
            gmx_positionRouter.createDecreasePosition{ value: _executionFee }(
                _path,
                _indexToken,
                _collateralDelta,
                _sizeDelta,
                _isLong,
                _receiver,
                _acceptablePrice,
                _minOut,
                _executionFee,
                _withdrawETH,
                _callbackTarget
            );
    }

    /**
     * @notice Cancels a PositionRouter increase position
     * @param _key                  Key
     * @param _executionFeeReceiver Execution fee receiver address
     */
    function gmx_cancelIncreasePosition(
        bytes32 _key,
        address payable _executionFeeReceiver
    ) external onlyRole(EXECUTOR_ROLE) returns (bool) {
        inputGuard_gmx_cancelIncreasePosition(_key, _executionFeeReceiver);

        bool result = gmx_positionRouter.cancelIncreasePosition(_key, _executionFeeReceiver);
        return result;
    }

    /**
     * @notice Cancels a PositionRouter decrease position
     * @param _key                  Key
     * @param _executionFeeReceiver Execution fee receiver address
     */
    function gmx_cancelDecreasePosition(
        bytes32 _key,
        address payable _executionFeeReceiver
    ) external onlyRole(EXECUTOR_ROLE) returns (bool) {
        inputGuard_gmx_cancelDecreasePosition(_key, _executionFeeReceiver);

        bool result = gmx_positionRouter.cancelDecreasePosition(_key, _executionFeeReceiver);
        return result;
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for gmx_createIncreasePosition
     * @dev     Override this in the parent strategy to protect against unacceptable input
     * @dev     Must revert on unacceptable input
     * @param _path             Token path
     * @param _indexToken       Index token
     * @param _amountIn         Amount in
     * @param _minOut           Minimum amount out
     * @param _sizeDelta        Size delta
     * @param _isLong           Is long position
     * @param _acceptablePrice  Acceptable price
     * @param _executionFee     Execution fee
     * @param _referralCode     Referral code
     * @param _callbackTarget   Callback target
     */
    function inputGuard_gmx_createIncreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _acceptablePrice,
        uint256 _executionFee,
        bytes32 _referralCode,
        address _callbackTarget
    ) internal virtual {}

    /**
     * @notice  Validates inputs for gmx_createIncreasePositionETH
     * @param _valueIn          Msg.value to send with tx
     * @param _path             Token path
     * @param _indexToken       Index token
     * @param _minOut           Minimum amount out
     * @param _sizeDelta        Size delta
     * @param _isLong           Is long position
     * @param _acceptablePrice  Acceptable price
     * @param _executionFee     Execution fee
     * @param _referralCode     Referral code
     * @param _callbackTarget   Callback target
     */
    function inputGuard_gmx_createIncreasePositionETH(
        uint256 _valueIn,
        address[] memory _path,
        address _indexToken,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _acceptablePrice,
        uint256 _executionFee,
        bytes32 _referralCode,
        address _callbackTarget
    ) internal virtual {}

    /**
     * @notice  Validates inputs for gmx_createDecreasePosition
     * @dev     Override this in the parent strategy to protect against unacceptable input
     * @dev     Must revert on unacceptable input
     * @param _path             Path
     * @param _indexToken       Index token address
     * @param _collateralDelta  Collateral delta
     * @param _sizeDelta        Size delta
     * @param _isLong           Is long position
     * @param _receiver         Receiver address
     * @param _acceptablePrice  Acceptable price
     * @param _minOut           Minimum amount out
     * @param _executionFee     Execution fee
     * @param _withdrawETH      Withdraw ETH
     * @param _callbackTarget   Callback target
     */
    function inputGuard_gmx_createDecreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        bool _isLong,
        address _receiver,
        uint256 _acceptablePrice,
        uint256 _minOut,
        uint256 _executionFee,
        bool _withdrawETH,
        address _callbackTarget
    ) internal virtual {}

    /**
     * @notice Validates inputs for gmx_cancelIncreasePosition
     * @param _key                  Key
     * @param _executionFeeReceiver Execution fee receiver address
     */
    function inputGuard_gmx_cancelIncreasePosition(bytes32 _key, address payable _executionFeeReceiver) internal virtual {}

    /**
     * @notice Validates inputs for gmx_cancelDecreasePosition
     * @param _key                  Key
     * @param _executionFeeReceiver Execution fee receiver address
     */
    function inputGuard_gmx_cancelDecreasePosition(bytes32 _key, address payable _executionFeeReceiver) internal virtual {}
    // solhint-disable no-empty-blocks
}
