// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

interface IPool {
    function token0() external view returns (address);

    function token1() external view returns (address);
}
