// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface IRouter {
    function approvePlugin(address _plugin) external;

    function denyPlugin(address _plugin) external;

    function directPoolDeposit(address _token, uint256 _amount) external;

    function swap(address[] memory _path, uint256 _amountIn, uint256 _minOut, address _receiver) external;

    function swapETHToTokens(address[] memory _path, uint256 _minOut, address _receiver) external payable;

    function swapTokensToETH(address[] memory _path, uint256 _amountIn, uint256 _minOut, address payable _receiver) external;
}
