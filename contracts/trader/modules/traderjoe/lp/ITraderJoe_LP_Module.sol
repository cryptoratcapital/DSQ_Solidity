// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ILBRouter } from "../../../external/traderjoe_interfaces/ILBRouter.sol";
import "../../../external/traderjoe_interfaces/ILBFactory.sol";

/**
 * @title   DSquared
 * @notice  Allows adding/removing liquidity via the TraderJoe LBRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ITraderJoe_LP_Module {
    // ---------- Functions ----------

    function traderjoe_addLiquidity(ILBRouter.LiquidityParameters calldata liquidityParameters) external;

    function traderjoe_addLiquidityNATIVE(uint256 valueIn, ILBRouter.LiquidityParameters calldata liquidityParameters) external;

    function traderjoe_removeLiquidity(
        IERC20 tokenX,
        IERC20 tokenY,
        uint16 binStep,
        uint256 amountXMin,
        uint256 amountYMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address to,
        uint256 deadline
    ) external;

    function traderjoe_removeLiquidityNATIVE(
        IERC20 token,
        uint16 binStep,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address payable to,
        uint256 deadline
    ) external;

    function traderjoe_approveForAll(address tokenX, address tokenY, uint256 binStep) external;

    // ---------- Getters ----------

    function traderjoe_router() external view returns (ILBRouter);

    function traderjoe_factory() external view returns (ILBFactory);
}
