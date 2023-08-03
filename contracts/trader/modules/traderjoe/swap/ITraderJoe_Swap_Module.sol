// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ILBRouter } from "../../../external/traderjoe_interfaces/ILBRouter.sol";

/**
 * @title   DSquared
 * @notice  Allows direct swapping via the LBRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ITraderJoe_Swap_Module {
    // ---------- Functions ----------

    function traderjoe_swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external;

    function traderjoe_swapExactTokensForNATIVE(
        uint256 amountIn,
        uint256 amountOutMinNATIVE,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) external;

    function traderjoe_swapExactNATIVEForTokens(
        uint256 valueIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external;

    function traderjoe_swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external;

    function traderjoe_swapTokensForExactNATIVE(
        uint256 amountOut,
        uint256 amountInMax,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) external;

    function traderjoe_swapNATIVEForExactTokens(
        uint256 valueIn,
        uint256 amountOut,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external payable;

    function traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external;

    function traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMinNATIVE,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) external;

    function traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(
        uint256 valueIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external payable;

    // ---------- Getters ----------

    function traderjoe_router() external view returns (ILBRouter);
}
