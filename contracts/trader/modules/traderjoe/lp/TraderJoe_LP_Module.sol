// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TraderJoe_LP_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared TraderJoe LP Module
 * @notice  Allows adding/removing liquidity via the TraderJoe LBRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract TraderJoe_LP_Module is TraderJoe_LP_Base, DSQ_Trader_Storage {
    /**
     * @notice  Sets the addresses of the TraderJoe router & factory
     * @param   _traderjoe_router   TraderJoe router address
     * @param   _traderjoe_factory  TraderJoe factory address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _traderjoe_router, address _traderjoe_factory) TraderJoe_LP_Base(_traderjoe_router, _traderjoe_factory) {}

    // ---------- Input Guards ----------
    /// @inheritdoc TraderJoe_LP_Base
    function inputGuard_traderjoe_addLiquidity(ILBRouter.LiquidityParameters calldata liquidityParameters) internal view override {
        validateToken(address(liquidityParameters.tokenX));
        validateToken(address(liquidityParameters.tokenY));
        require(liquidityParameters.to == address(this), "GuardError: Invalid recipient");
        require(liquidityParameters.refundTo == address(this), "GuardError: Invalid refundTo");
    }

    /// @inheritdoc TraderJoe_LP_Base
    function inputGuard_traderjoe_addLiquidityNATIVE(
        uint256, // valueIn
        ILBRouter.LiquidityParameters calldata liquidityParameters
    ) internal view override {
        validateToken(address(liquidityParameters.tokenX));
        validateToken(address(liquidityParameters.tokenY));
        require(liquidityParameters.to == address(this), "GuardError: Invalid recipient");
        require(liquidityParameters.refundTo == address(this), "GuardError: Invalid refundTo");
    }

    /// @inheritdoc TraderJoe_LP_Base
    function inputGuard_traderjoe_removeLiquidity(
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

    /// @inheritdoc TraderJoe_LP_Base
    function inputGuard_traderjoe_removeLiquidityNATIVE(
        IERC20 token,
        uint16, // binStep
        uint256, // amountTokenMin
        uint256, // amountNATIVEMin
        uint256[] memory, // ids
        uint256[] memory, // amounts
        address payable to,
        uint256 // deadline
    ) internal view override {
        validateToken(address(token));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    // (address tokenX, address tokenY, uint256 binStep)
    /// @inheritdoc TraderJoe_LP_Base
    function inputGuard_traderjoe_approveForAll(address tokenX, address tokenY, uint256) internal view override {
        validateToken(tokenX);
        validateToken(tokenY);
    }
}
