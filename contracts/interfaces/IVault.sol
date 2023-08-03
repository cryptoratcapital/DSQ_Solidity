// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.13;

struct Epoch {
    uint256 fundingStart;
    uint256 epochStart;
    uint256 epochEnd;
}

interface IVault {
    function custodyFunds() external returns (uint256);

    function returnFunds(uint256 _amount) external;

    function asset() external returns (address);

    function getCurrentEpochInfo() external view returns (Epoch memory);
}
