// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title   Staking Rewarder
 * @notice  All staking functions must be called from the router
 * @notice  Router contract has pausing functionality so staking can be paused
 * @dev Fork of Synthetix StakingRewards contract, updated to 0.8 Solidity and 0.4.x OpenZeppelin base contracts
 *      https://github.com/Synthetixio/synthetix/blob/develop/contracts/StakingRewards.sol
 *      Modified by: HessianX
 *      HessianX Developers: BowTiedOriole & BowTiedPickle
 *      Reference: https://docs.synthetix.io/contracts/source/contracts/stakingrewards
 */

contract DSQStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /* ========== ADDRESSES ========== */

    address public rewardsDistribution;
    address public router;

    /* ========== STATE VARIABLES ========== */

    IERC20 public immutable rewardsToken;
    IERC20 public immutable stakingToken;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _owner, address _rewardsDistribution, address _rewardsToken, address _stakingToken) {
        require(_owner != address(0) && _rewardsToken != address(0) && _stakingToken != address(0), "DSQStaking: Zero address");
        require(_rewardsToken != _stakingToken, "DSQStaking: Same token");
        _transferOwnership(_owner);
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        rewardsDistribution = _rewardsDistribution;
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / _totalSupply;
    }

    function earned(address account) public view returns (uint256) {
        return (_balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(address account, uint256 amount) external onlyRouter nonReentrant updateReward(account) {
        require(amount > 0, "DSQStaking: Cannot stake 0");
        _totalSupply += amount;
        _balances[account] += amount;
        stakingToken.safeTransferFrom(router, address(this), amount);
        emit Staked(account, amount);
    }

    function withdraw(address account, uint256 amount) public onlyRouter nonReentrant updateReward(account) {
        require(amount > 0, "DSQStaking: Cannot withdraw 0");
        _totalSupply -= amount;
        _balances[account] -= amount;
        stakingToken.safeTransfer(account, amount);
        emit Withdrawn(account, amount);
    }

    function getReward(address account, address recipient) public onlyRouter nonReentrant updateReward(account) returns (uint256) {
        uint256 reward = rewards[account];
        if (reward > 0) {
            rewards[account] = 0;
            rewardsToken.safeTransfer(recipient, reward);
            emit RewardPaid(account, recipient, reward);
        }
        return reward;
    }

    function exit(address account) external onlyRouter {
        withdraw(account, _balances[account]);
        getReward(account, account);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward) external onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = rewardsToken.balanceOf(address(this));
        // solhint-disable-next-line reason-string
        require(rewardRate <= balance / rewardsDuration, "DSQStaking: Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(tokenAddress != address(stakingToken), "DSQStaking: Cannot withdraw the staking token");
        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(
            block.timestamp > periodFinish,
            "DSQStaking: Previous rewards period must be complete before changing the duration for the new period"
        );
        require(_rewardsDuration > 0, "DSQStaking: Zero duration");
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(_rewardsDuration);
    }

    function setRewardsDistribution(address _rewardsDistribution) external onlyOwner {
        require(_rewardsDistribution != address(0), "DSQStaking: Zero address");
        emit NewRewardsDistribution(rewardsDistribution, _rewardsDistribution);
        rewardsDistribution = _rewardsDistribution;
    }

    function setRouter(address _router) external onlyOwner {
        require(router == address(0), "DSQStaking: Router is immutable");
        emit NewRouter(_router);
        router = _router;
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    modifier onlyRewardsDistribution() {
        // solhint-disable-next-line reason-string
        require(msg.sender == rewardsDistribution, "DSQStaking: Caller is not RewardsDistribution contract");
        _;
    }

    modifier onlyRouter() {
        require(msg.sender == router, "DSQStaking: !router");
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, address indexed recipient, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
    event NewRouter(address newRouter);
    event NewRewardsDistribution(address oldRewardsDistribution, address newRewardsDistribution);
}
