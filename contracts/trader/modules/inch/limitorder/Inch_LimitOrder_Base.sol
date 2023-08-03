// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../../dsq/DSQ_Common_Roles.sol";
import "../../../external/inch_interfaces/IAggregationRouter.sol";
import "./Inch_LimitOrder_Storage.sol";

/**
 * @title   DSquared Inch LimitOrder Base
 * @notice  Allows filling, creating and cancelling limit orders via the 1Inch AggregationRouter contract
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the tokens are valid.
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Inch_LimitOrder_Base is AccessControl, ReentrancyGuard, Inch_LimitOrder_Storage {
    using Math for uint256;
    // solhint-disable var-name-mixedcase

    /// @notice 1Inch AggregationRouterV5 address
    IAggregationRouter public immutable inch_aggregation_router;

    /// @notice ERC1272 valid signature value
    bytes4 internal constant MAGICVALUE = 0x1626ba7e; // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    /// @notice ERC1272 invalid signature value
    bytes4 internal constant BADVALUE = 0x11111111;

    /// @notice Allowed slippage percentage for limit orders
    /// @dev Prevents trader from executing or adding malicious orders
    uint32 public constant SLIPPAGE_PERCENTAGE = 97;

    /**
     * @notice  Sets the address of the 1Inch AggregationRouterV5 contract
     * @param   _inch_aggregation_router    AggregationRouterV5 address
     */
    constructor(address _inch_aggregation_router) {
        // solhint-disable-next-line reason-string
        require(_inch_aggregation_router != address(0), "Inch_LimitOrder_Base: Zero address");
        inch_aggregation_router = IAggregationRouter(_inch_aggregation_router);
    }

    // ---------- Initialize ----------

    /**
     * @notice  Initializes the assetToOracle mapping
     * @dev     Should ONLY be called through cut_Inch_LimitOrder.
     *          Adding this function selector to the Diamond will result in a CRITICAL vulnerabiilty.
     * @param   _assets     Array of token addresses
     * @param   _oracles    Array of oracle addresses
     */
    function init_Inch_LimitOrder(address[] calldata _assets, address[] calldata _oracles) external {
        // solhint-disable-next-line reason-string
        require(_assets.length == _oracles.length, "Inch_LimitOrder_Base: Invalid input");
        InchLimitOrderStorage storage s = getInchLimitOrderStorage();
        uint len = _assets.length;
        for (uint i; i < len; ) {
            s.assetToOracle[_assets[i]] = IAggregatorV3Interface(_oracles[i]);
            unchecked {
                ++i;
            }
        }
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Fills a 1Inch limit order
     * @dev     Will not fill orders where the asset price is less favorable than the maximum slippage
     * @param   valueIn                         Msg.value to send with function call
     * @param   order                           Limit order to fill
     * @param   signature                       Signature of limit order
     * @param   interaction                     Limit order interaction
     * @param   makingAmount                    Making amount
     * @param   takingAmount                    Taking amount
     * @param   skipPermitAndThresholdAmount    Specifies whether to use permit and threshold amount
     * @return  actualMakingAmount  Actual amount transferred from maker to taker
     * @return  actualTakingAmount  Actual amount transferred from taker to maker
     * @return  orderHash           Hash of the filled order
     */
    function inch_fillOrder(
        uint256 valueIn,
        OrderLib.Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 actualMakingAmount, uint256 actualTakingAmount, bytes32 orderHash) {
        inputGuard_inch_fillOrder(valueIn, order, signature, interaction, makingAmount, takingAmount, skipPermitAndThresholdAmount);

        (actualMakingAmount, actualTakingAmount, orderHash) = inch_aggregation_router.fillOrder{ value: valueIn }(
            order,
            signature,
            interaction,
            makingAmount,
            takingAmount,
            skipPermitAndThresholdAmount
        );

        (, int256 makerPrice, , , ) = getInchLimitOrderStorage().assetToOracle[order.makerAsset].latestRoundData();
        (, int256 takerPrice, , , ) = getInchLimitOrderStorage().assetToOracle[order.takerAsset].latestRoundData();

        uint256 makingValue = actualMakingAmount * uint256(makerPrice);
        uint256 takingValue = actualTakingAmount * uint256(takerPrice);
        // solhint-disable-next-line reason-string
        require(makingValue > (takingValue.mulDiv(SLIPPAGE_PERCENTAGE, 100, Math.Rounding.Up)), "GuardError: Invalid order parameters");
    }

    /**
     * @notice  Cancels a 1Inch limit order
     * @param   order           Limit order to cancel
     * @return  orderRemaining  Actual amount transferred from maker to taker
     * @return  orderHash       Hash of the cancelled order
     */
    function inch_cancelOrder(
        OrderLib.Order calldata order
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (uint256 orderRemaining, bytes32 orderHash) {
        (orderRemaining, orderHash) = inch_aggregation_router.cancelOrder(order);
        removeHash(orderHash);
    }

    /**
     * @notice  Adds a limit order to array of valid orders
     * @param   order   Limit order to add
     */
    function inch_addOrder(OrderLib.Order calldata order) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_inch_addOrder(order);
        bytes32 _hash = inch_aggregation_router.hashOrder(order);
        addHash(_hash);
    }

    /**
     * @notice  Removes a limit order from array of valid orders
     * @param   order   Limit order to remove
     */
    function inch_removeOrder(OrderLib.Order calldata order) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        bytes32 _hash = inch_aggregation_router.hashOrder(order);
        removeHash(_hash);
    }

    // ---------- ERC1271 ----------

    // (bytes32 _hash, bytes memory _signature)
    /**
     * @dev     Returns whether order hash in valid
     * @param   _hash       Hash of the order to be validated
     * @return  magicValue  bytes4 magic value 0x1626ba7e when function passes
     */
    function isValidSignature(bytes32 _hash, bytes memory) public view returns (bytes4 magicValue) {
        return validateHash(_hash) ? MAGICVALUE : BADVALUE;
    }

    // ---------- Hooks ----------

    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for inch_fillOrder
     * @param   valueIn                         Msg.value to send with function call
     * @param   order                           Limit order to fill
     * @param   signature                       Signature of limit order
     * @param   interaction                     Limit order interaction
     * @param   makingAmount                    Making amount
     * @param   takingAmount                    Taking amount
     * @param   skipPermitAndThresholdAmount    Specifies whether to use permit and threshold amount
     */
    function inputGuard_inch_fillOrder(
        uint256 valueIn,
        OrderLib.Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) internal virtual {}

    /**
     * @notice  Validates inputs for inch_addOrder
     * @param   order   Limit order to add
     */
    function inputGuard_inch_addOrder(OrderLib.Order calldata order) internal virtual {}

    // solhint-enable no-empty-blocks
}
