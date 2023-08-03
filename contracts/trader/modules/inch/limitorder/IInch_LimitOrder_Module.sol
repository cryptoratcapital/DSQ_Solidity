// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/inch_interfaces/IAggregationRouter.sol";

/**
 * @title   HessianX Inch LimitOrder Module Interface
 * @notice  Allows filling, creating and cancelling limit orders via the 1Inch AggregationRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IInch_LimitOrder_Module {
    // ---------- Functions ----------

    function inch_fillOrder(
        uint256 valueIn,
        OrderLib.Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external;

    function inch_cancelOrder(OrderLib.Order calldata order) external;

    function inch_addOrder(OrderLib.Order calldata order) external;

    function inch_removeOrder(OrderLib.Order calldata order) external;

    function isValidSignature(bytes32 _hash, bytes memory _signature) external view returns (bytes4 magicValue);

    function init_Inch_LimitOrder(address[] memory _assets, address[] memory _oracles) external;

    // ---------- Getters ----------

    function inch_aggregation_router() external view returns (IAggregationRouter);

    function SLIPPAGE_PERCENTAGE() external view returns (uint32);

    function inch_getHashes() external view returns (bytes32[] memory);

    function inch_getOracleForAsset(address asset) external view returns (address);
}
