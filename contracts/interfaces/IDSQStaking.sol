// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface IDSQStaking {
    function balanceOf(address account) external view returns (uint256);

    function stake(address account, uint256 amount) external;

    function withdraw(address account, uint256 amount) external;

    function exit(address account) external;

    function getReward(address account, address recipient) external returns (uint256);
}
