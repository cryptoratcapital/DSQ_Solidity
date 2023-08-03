// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface IesDSQStaking {
    function stake(address _account, uint256 _amount, bool _adminStake) external;

    function unstake(address _account, uint256 _amount) external;

    function notify(address _address) external;

    function claim(address _account, address _recipient) external returns (uint256);

    function emergencyWithdraw(address _account) external;
}
