// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMultiDistributor {
    struct UserAmounts {
        address user;
        uint256 amount;
    }

    function claim(IERC20[] memory tokens) external;

    function addToClaims(UserAmounts[] memory claimsToAdd, IERC20 tokenAddress, uint256 epochTimestamp, string memory tag) external;
}
