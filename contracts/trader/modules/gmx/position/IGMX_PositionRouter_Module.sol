// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/gmx_interfaces/IRouter.sol";
import "../../../external/gmx_interfaces/IPositionRouter.sol";

/**
 * @title   DSquared GMX PositionRouter Module Interface
 * @notice  Allows leveraged long/short positions to be opened on the GMX Position Router
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IGMX_PositionRouter_Module {
    // ---------- Functions ----------

    function init_GMX_PositionRouter() external;

    /**
     * @dev     Approval must be handled via another function
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
    ) external payable returns (bytes32);

    /**
     * @dev     Note the _valueIn parameter, which does not exist in the direct GMX call
     * @param   _valueIn    Wei of the contract's ETH to transfer as msg.value with the createIncreasePosition call
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
    ) external payable returns (bytes32);

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
    ) external payable returns (bytes32);

    function gmx_cancelIncreasePosition(bytes32 _key, address payable _executionFeeReceiver) external returns (bool);

    function gmx_cancelDecreasePosition(bytes32 _key, address payable _executionFeeReceiver) external returns (bool);

    // ---------- Getters ----------

    function gmx_router() external view returns (IRouter);

    function gmx_positionRouter() external view returns (IPositionRouter);
}
