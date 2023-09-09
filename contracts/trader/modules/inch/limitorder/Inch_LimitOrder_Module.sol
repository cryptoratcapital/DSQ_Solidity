// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../../../interfaces/IERC20Decimals.sol";
import "./Inch_LimitOrder_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";
import "../../../external/inch_interfaces/IAggregationExecutor.sol";

/**
 * @title   HessianX Inch LimitOrder Module
 * @notice  Validates inputs from Inch_LimitOrder_Base functions
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Inch_LimitOrder_Module is Inch_LimitOrder_Base, DSQ_Trader_Storage {
    using Math for uint256;

    // solhint-disable var-name-mixedcase, no-empty-blocks

    /**
     * @notice Sets the address of the 1Inch AggregationRouterV5 contract
     * @param _inch_aggregation_router  1Inch AggregationRouterV5 address
     */
    constructor(address _inch_aggregation_router) Inch_LimitOrder_Base(_inch_aggregation_router) {}

    // solhint-enable var-name-mixedcase, no-empty-blocks

    // ---------- Input Guards ----------

    /// @inheritdoc Inch_LimitOrder_Base
    function inputGuard_inch_fillOrder(
        uint256, // valueIn
        OrderLib.Order calldata order,
        bytes calldata, //signature
        bytes calldata, //interaction
        uint256, //makingAmount
        uint256, //takingAmount
        uint256 //skipPermitAndThresholdAmount
    ) internal view override {
        validateToken(order.makerAsset);
        validateToken(order.takerAsset);
        validateLinearOrder(order, IAggregationRouter.DynamicField.GetTakingAmount);
        validateLinearOrder(order, IAggregationRouter.DynamicField.GetMakingAmount);

        (, int256 makerPrice, , , ) = getInchLimitOrderStorage().assetToOracle[order.makerAsset].latestRoundData();
        (, int256 takerPrice, , , ) = getInchLimitOrderStorage().assetToOracle[order.takerAsset].latestRoundData();

        uint256 makingValue = order.makingAmount * uint256(makerPrice);
        uint256 takingValue = order.takingAmount * uint256(takerPrice);
        uint16 makerDecimals = IERC20Decimals(order.makerAsset).decimals();
        uint16 takerDecimals = IERC20Decimals(order.takerAsset).decimals();

        if (makerDecimals > takerDecimals) {
            takingValue = takingValue * 10 ** (makerDecimals - takerDecimals);
        } else if (takerDecimals > makerDecimals) {
            makingValue = makingValue * 10 ** (takerDecimals - makerDecimals);
        }

        // solhint-disable-next-line reason-string
        require(makingValue > (takingValue.mulDiv(SLIPPAGE_PERCENTAGE, 100, Math.Rounding.Up)), "GuardError: Invalid order parameters");
    }

    /// @inheritdoc Inch_LimitOrder_Base
    function inputGuard_inch_addOrder(OrderLib.Order calldata order) internal view override {
        validateToken(order.makerAsset);
        validateToken(order.takerAsset);
        validateLinearOrder(order, IAggregationRouter.DynamicField.GetTakingAmount);
        validateLinearOrder(order, IAggregationRouter.DynamicField.GetMakingAmount);
        require(order.maker == address(this), "GuardError: Invalid maker");
        require(order.receiver == address(0) || order.receiver == address(this), "GuardError: Invalid receiver");

        (, int256 makerPrice, , , ) = getInchLimitOrderStorage().assetToOracle[order.makerAsset].latestRoundData();
        (, int256 takerPrice, , , ) = getInchLimitOrderStorage().assetToOracle[order.takerAsset].latestRoundData();

        uint256 makingValue = order.makingAmount * uint256(makerPrice);
        uint256 takingValue = order.takingAmount * uint256(takerPrice);
        uint16 makerDecimals = IERC20Decimals(order.makerAsset).decimals();
        uint16 takerDecimals = IERC20Decimals(order.takerAsset).decimals();

        if (makerDecimals > takerDecimals) {
            takingValue = takingValue * 10 ** (makerDecimals - takerDecimals);
        } else if (takerDecimals > makerDecimals) {
            makingValue = makingValue * 10 ** (takerDecimals - makerDecimals);
        }
        // solhint-disable-next-line reason-string
        require(takingValue > (makingValue.mulDiv(SLIPPAGE_PERCENTAGE, 100, Math.Rounding.Up)), "GuardError: Invalid order parameters");
    }

    // ---------- Internal ----------

    /**
     * @notice Validates that a limit order uses linear proportion for GetMakingAmount and GetTakingAmount
     * @param   order   Limit order
     * @param   field   Enum value for DynamicField
     */
    function validateLinearOrder(OrderLib.Order calldata order, IAggregationRouter.DynamicField field) internal pure {
        uint256 bitShift = uint256(field) << 5; // field * 32
        bytes memory getter = order.interactions[uint32((order.offsets << 32) >> bitShift):uint32(order.offsets >> bitShift)];
        // solhint-disable-next-line reason-string
        require(getter.length == 0, "GuardError: Only linear proportions accepted");
    }
}
