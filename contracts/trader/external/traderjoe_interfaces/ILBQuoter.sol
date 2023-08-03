// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { ILBRouter } from "./ILBRouter.sol";

interface ILBQuoter {
    struct Quote {
        address[] route;
        address[] pairs;
        uint256[] binSteps;
        ILBRouter.Version[] versions;
        uint128[] amounts;
        uint128[] virtualAmountsWithoutSlippage;
        uint128[] fees;
    }

    function findBestPathFromAmountIn(address[] calldata router, uint128 amountIn) external view returns (Quote memory quote);

    function findBestPathFromAmountOut(address[] calldata _route, uint128 _amountOut) external view returns (Quote memory quote);
}
