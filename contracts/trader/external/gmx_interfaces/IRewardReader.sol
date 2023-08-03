// SPDX-License-Identifier: MIT
// solhint-disable-next-line compiler-version
pragma solidity 0.6.12;

interface IRewardReader {
    function getDepositBalances(
        address _account,
        address[] memory _depositTokens,
        address[] memory _rewardTrackers
    ) external view returns (uint256[] memory);

    function getStakingInfo(address _account, address[] memory _rewardTrackers) external view returns (uint256[] memory);

    function getVestingInfoV2(address _account, address[] memory _vesters) external view returns (uint256[] memory);
}
