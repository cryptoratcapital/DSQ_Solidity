// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Inch_Swap_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";
import "../../../external/inch_interfaces/IAggregationExecutor.sol";
import "../../../external/inch_interfaces/IPool.sol";

/**
 * @title   DSquared Inch Swap Module
 * @notice  Allows adding and removing liquidity via the 1Inch AggregationRouter contract
 * @dev     "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" MUST be an allowed token in the strategy mandate
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Inch_Swap_Module is Inch_Swap_Base, DSQ_Trader_Storage {
    /// @notice 1Inch constant to check uniswap parameters
    uint256 private constant _ONE_FOR_ZERO_MASK = 1 << 255;

    // solhint-disable var-name-mixedcase, no-empty-blocks
    /**
     * @notice Sets the AggregationRouter and ClipperExchange contract addresses
     * @param _inch_aggregation_router  1Inch AggregationRouterV5 address
     * @param _inch_clipper_exchange    ClipperExchange address
     */
    constructor(
        address _inch_aggregation_router,
        address _inch_clipper_exchange
    ) Inch_Swap_Base(_inch_aggregation_router, _inch_clipper_exchange) {}

    // solhint-enable var-name-mixedcase, no-empty-blocks

    // ---------- Input Guards ----------

    /// @inheritdoc Inch_Swap_Base
    function inputGuard_inch_swap(
        uint256, // valueIn
        IAggregationExecutor, // executor
        SwapDescription calldata desc,
        bytes calldata, // permit
        bytes calldata // data
    ) internal view override {
        validateToken(address(desc.srcToken));
        validateToken(address(desc.dstToken));
        require(desc.dstReceiver == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc Inch_Swap_Base
    function inputGuard_inch_uniswapV3Swap(
        uint256, // valueIn
        uint256, // amount
        uint256, // minReturn
        uint256[] calldata pools
    ) internal view override {
        uint len = pools.length;
        if (len == 1) {
            IPool pool = IPool(address(uint160(pools[0])));
            validateToken(pool.token0());
            validateToken(pool.token1());
        } else {
            // Validate start token
            bool zeroForOne = pools[0] & _ONE_FOR_ZERO_MASK == 0;
            IPool pool = IPool(address(uint160(pools[0])));
            zeroForOne ? validateToken(pool.token0()) : validateToken(pool.token1());

            // Validate end token
            zeroForOne = pools[len - 1] & _ONE_FOR_ZERO_MASK == 0;
            pool = IPool(address(uint160(pools[len - 1])));
            zeroForOne ? validateToken(pool.token1()) : validateToken(pool.token0());
        }
    }

    /// @inheritdoc Inch_Swap_Base
    function inputGuard_inch_clipperSwap(
        uint256, // valueIn
        IClipperExchangeInterface clipperExchange,
        IERC20 srcToken,
        IERC20 dstToken,
        uint256, // inputAmount
        uint256, // outputAmount
        uint256, // goodUntil
        bytes32, // r
        bytes32 // vs
    ) internal view override {
        require(clipperExchange == inch_clipper_exchange, "Invalid clipper exchange");
        if (address(srcToken) != address(0)) {
            validateToken(address(srcToken));
        }
        validateToken(address(dstToken));
    }
}
