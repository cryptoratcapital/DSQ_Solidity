// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ILBLegacyRouter } from "../../../external/traderjoe_interfaces/ILBLegacyRouter.sol";
import "../../../external/traderjoe_interfaces/ILBLegacyFactory.sol";

/**
 * @title   DSquared TraderJoe Legacy LP Module Interface
 * @notice  Allows adding/removing liquidity via the TraderJoe LBLegacyRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ITraderJoe_Legacy_LP_Module {
    // ---------- Functions ----------

    function traderjoe_legacy_addLiquidity(ILBLegacyRouter.LiquidityParameters calldata liquidityParameters) external;

    function traderjoe_legacy_addLiquidityAVAX(uint256 valueIn, ILBLegacyRouter.LiquidityParameters calldata liquidityParameters) external;

    function traderjoe_legacy_removeLiquidity(
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

    function traderjoe_legacy_removeLiquidityAVAX(
        IERC20 token,
        uint16 binStep,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address payable to,
        uint256 deadline
    ) external;

    function traderjoe_legacy_setApprovalForAll(address tokenX, address tokenY, uint256 binStep) external;

    // ---------- Getters ----------

    function traderjoe_legacy_router() external view returns (ILBLegacyRouter);

    function traderjoe_legacy_factory() external view returns (ILBLegacyFactory);
}
