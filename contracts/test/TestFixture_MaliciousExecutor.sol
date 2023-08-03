// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestFixture_MaliciousExecutor {
    IERC20 immutable usdc;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function executePath(bytes calldata data, uint256[] memory inputAmount) external payable {
        usdc.transfer(msg.sender, 1);
    }
}
