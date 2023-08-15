// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TraderJoe_Legacy_LP_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared TraderJoe Legacy LP Module
 * @notice  Allows adding/removing liquidity via the TraderJoe Legacy LBRouter contract
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract TraderJoe_Legacy_LP_Module is TraderJoe_Legacy_LP_Base, DSQ_Trader_Storage {
    // solhint-disable var-name-mixedcase, no-empty-blocks

    /**
     * @notice  Sets the addresses of the TraderJoe legacy router & factory
     * @param   _traderjoe_legacy_router    TraderJoe legacy router address
     * @param   _traderjoe_legacy_factory   TraderJoe legacy factory address
     */
    constructor(
        address _traderjoe_legacy_router,
        address _traderjoe_legacy_factory
    ) TraderJoe_Legacy_LP_Base(_traderjoe_legacy_router, _traderjoe_legacy_factory) {}

    // solhint-enable var-name-mixedcase, no-empty-blocks

    // ---------- Input Guards ----------

    /// @inheritdoc TraderJoe_Legacy_LP_Base
    function inputGuard_traderjoe_legacy_addLiquidity(
        ILBLegacyRouter.LiquidityParameters calldata liquidityParameters
    ) internal view override {
        validateToken(address(liquidityParameters.tokenX));
        validateToken(address(liquidityParameters.tokenY));
        require(liquidityParameters.to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc TraderJoe_Legacy_LP_Base
    function inputGuard_traderjoe_legacy_addLiquidityAVAX(
        uint256, // valueIn
        ILBLegacyRouter.LiquidityParameters calldata liquidityParameters
    ) internal view override {
        validateToken(address(liquidityParameters.tokenX));
        validateToken(address(liquidityParameters.tokenY));
        require(liquidityParameters.to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc TraderJoe_Legacy_LP_Base
    function inputGuard_traderjoe_legacy_removeLiquidity(
        IERC20 tokenX,
        IERC20 tokenY,
        uint16, // binStep
        uint256, // amountXMin
        uint256, // amountYMin
        uint256[] memory, // ids
        uint256[] memory, // amounts
        address to,
        uint256 // deadline
    ) internal view override {
        validateToken(address(tokenX));
        validateToken(address(tokenY));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// @inheritdoc TraderJoe_Legacy_LP_Base
    function inputGuard_traderjoe_legacy_removeLiquidityAVAX(
        IERC20 token,
        uint16, // binStep
        uint256, // amountTokenMin
        uint256, // amountAVAXMin
        uint256[] memory, // ids
        uint256[] memory, // amounts
        address payable to,
        uint256 // deadline
    ) internal view override {
        validateToken(address(token));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    //(address tokenX, address tokenY, uint256 binStep)
    /// @inheritdoc TraderJoe_Legacy_LP_Base
    function inputGuard_traderjoe_legacy_setApprovalForAll(address tokenX, address tokenY, uint256) internal view override {
        validateToken(tokenX);
        validateToken(tokenY);
    }
}
