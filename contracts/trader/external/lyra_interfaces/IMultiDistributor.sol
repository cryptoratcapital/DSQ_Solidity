// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMultiDistributor {
    struct UserAmounts {
        address user;
        uint256 amount;
    }

    struct Batch {
        IERC20 token;
        bool approved;
    }

    function batchApprovals(uint _batchId) external view returns (Batch memory);

    function claim(uint[] memory _claimList) external;

    function addToClaims(
        uint[] memory tokenAmounts,
        address[] memory users,
        IERC20 token,
        uint epochTimestamp,
        string memory tag
    ) external;

    function getClaimableAmountForUser(uint[] memory batchIds, address user, IERC20 token)
    external
    view
    returns (uint amount);

    function approveClaims(uint[] memory batchIds, bool approve) external;
}
