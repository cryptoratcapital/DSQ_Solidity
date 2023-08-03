// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

interface IOdosRouter {
    /// @dev Contains all information needed to describe an input token being swapped from
    struct inputToken {
        address tokenAddress;
        uint256 amountIn;
        address receiver;
        bytes permit;
    }
    /// @dev Contains all information needed to describe an output token being swapped to
    struct outputToken {
        address tokenAddress;
        uint256 relativeValue;
        address receiver;
    }

    function swap(
        inputToken[] memory inputs,
        outputToken[] memory outputs,
        uint256 valueOutQuote,
        uint256 valueOutMin,
        address executor,
        bytes calldata pathDefinition
    ) external payable returns (uint256[] memory amountsOut, uint256 gasLeft);
}
