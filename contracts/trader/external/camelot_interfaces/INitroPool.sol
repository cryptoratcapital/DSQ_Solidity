// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface INitroPool {
    event Deposit(address indexed userAddress, uint256 tokenId, uint256 amount);
    event Harvest(address indexed userAddress, IERC20 rewardsToken, uint256 pending);
    event Withdraw(address indexed userAddress, uint256 tokenId, uint256 amount);
    event EmergencyWithdraw(address indexed userAddress, uint256 tokenId, uint256 amount);

    function withdraw(uint256 tokenId) external;

    function emergencyWithdraw(uint256 tokenId) external;

    function harvest() external;

    function factory() external view returns (address);

    function userTokenId(address account, uint256 index) external view returns (uint256);

    function tokenIdOwner(uint256 index) external view returns (uint256);

    function userTokenIdsLength(address account) external view returns (uint256);
}
