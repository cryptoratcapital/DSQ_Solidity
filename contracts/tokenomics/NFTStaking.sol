// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title   NFT Staking Rewarder
 * @notice  Stake DopexNFT to earn rewards
 * @dev     Based off of Synthetix StakingRewards contract pattern, updated to 0.8 Solidity and 0.4.x OpenZeppelin base contracts
 *          Reference: https://github.com/Synthetixio/synthetix/blob/develop/contracts/StakingRewards.sol
 *          Reference: https://docs.synthetix.io/contracts/source/contracts/stakingrewards
 * @author  HessianX
 * @custom:developer BowTiedPickle
 */

contract NFTStaking is IERC721Receiver, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    /* ========== ADDRESSES ========== */

    address public rewardsDistribution;
    IERC20 public immutable rewardsToken;
    IERC721 public immutable stakingToken1;
    IERC721 public immutable stakingToken2;

    /* ========== STATE VARIABLES ========== */

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(IERC721 => mapping(uint256 => address)) public stakingTokenToIDToDepositor;
    mapping(IERC721 => mapping(uint256 => uint256)) public stakingTokenToIDToWeight;

    // NFT relative values
    // solhint-disable var-name-mixedcase
    uint256 public GENESIS_LEGENDARY_WEIGHT = 6e18;
    uint256 public GENESIS_RARE_WEIGHT = 5e18;
    uint256 public GENESIS_UNCOMMON_WEIGHT = 4e18;
    uint256 public NORMAL_RARE_WEIGHT = 3e18;
    uint256 public NORMAL_UNCOMMON_WEIGHT = 2e18;
    uint256 public NORMAL_COMMON_WEIGHT = 1e18;

    // solhint-enable var-name-mixedcase

    /* ========== CONSTRUCTOR ========== */

    constructor(address _owner, address _rewardsDistribution, address _rewardsToken, address _stakingToken1, address _stakingToken2) {
        require(
            _owner != address(0) && _rewardsToken != address(0) && _stakingToken1 != address(0) && _stakingToken2 != address(0),
            "Zero address"
        );
        require(_stakingToken1 != _stakingToken2, "Same token");
        _transferOwnership(_owner);
        rewardsToken = IERC20(_rewardsToken);
        stakingToken1 = IERC721(_stakingToken1);
        stakingToken2 = IERC721(_stakingToken2);
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

    function getWeightedAmount(uint256 id, bool genesis) public view returns (uint256) {
        uint256 weightedAmount;

        if (genesis) {
            if (id <= 2) {
                weightedAmount = GENESIS_LEGENDARY_WEIGHT;
            } else if (id <= 12) {
                weightedAmount = GENESIS_RARE_WEIGHT;
            } else if (id <= 32) {
                weightedAmount = GENESIS_UNCOMMON_WEIGHT;
            }
        } else {
            if (id <= 10) {
                weightedAmount = NORMAL_RARE_WEIGHT;
            } else if (id <= 190) {
                weightedAmount = NORMAL_UNCOMMON_WEIGHT;
            } else if (id <= 2190) {
                weightedAmount = NORMAL_COMMON_WEIGHT;
            }
        }

        return weightedAmount;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 id, bool genesis) public nonReentrant whenNotPaused updateReward(msg.sender) {
        IERC721 stakingToken = genesis ? stakingToken1 : stakingToken2;
        uint256 amount = getWeightedAmount(id, genesis);

        _totalSupply = _totalSupply + amount;
        _balances[msg.sender] = _balances[msg.sender] + amount;

        stakingTokenToIDToDepositor[stakingToken][id] = msg.sender;
        stakingTokenToIDToWeight[stakingToken][id] = amount;

        stakingToken.transferFrom(msg.sender, address(this), id);
        emit Staked(msg.sender, id, address(stakingToken), amount);
    }

    function stakeMultiple(uint256[] calldata ids, bool[] calldata gens) external {
        uint256 len = ids.length;
        require(len == gens.length, "Array mismatch");

        for (uint256 i; i < len; ) {
            stake(ids[i], gens[i]);
            unchecked {
                ++i;
            }
        }
    }

    function withdraw(uint256 id, bool genesis) public nonReentrant updateReward(msg.sender) {
        IERC721 stakingToken = genesis ? stakingToken1 : stakingToken2;
        require(stakingTokenToIDToDepositor[stakingToken][id] == msg.sender, "Not depositor of that token");

        uint256 amount = stakingTokenToIDToWeight[stakingToken][id];

        _totalSupply = _totalSupply - amount;
        _balances[msg.sender] = _balances[msg.sender] - amount;

        stakingTokenToIDToDepositor[stakingToken][id] = address(0);
        stakingTokenToIDToWeight[stakingToken][id] = 0;

        stakingToken.transferFrom(address(this), msg.sender, id);
        emit Withdrawn(msg.sender, id, address(stakingToken), amount);
    }

    function withdrawMultiple(uint256[] calldata ids, bool[] calldata gens) public {
        uint256 len = ids.length;
        require(len == gens.length, "Array mismatch");

        for (uint256 i; i < len; ) {
            withdraw(ids[i], gens[i]);
            unchecked {
                ++i;
            }
        }
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit(uint256[] calldata ids, bool[] calldata gens) external {
        withdrawMultiple(ids, gens);
        getReward();
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
        require(rewardRate <= balance / rewardsDuration, "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function recoverERC721(address tokenAddress, uint256 tokenId) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(tokenAddress != address(stakingToken1) && tokenAddress != address(stakingToken2), "Cannot withdraw the staking token");
        IERC721(tokenAddress).safeTransferFrom(address(this), owner(), tokenId);
        emit Recovered(tokenAddress, tokenId);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(block.timestamp > periodFinish, "Previous rewards period must be complete before changing the duration for the new period");
        require(_rewardsDuration > 0, "Zero duration");
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(_rewardsDuration);
    }

    function setRewardsDistribution(address _rewardsDistribution) external onlyOwner {
        require(_rewardsDistribution != address(0), "Zero address");
        emit NewRewardsDistribution(rewardsDistribution, _rewardsDistribution);
        rewardsDistribution = _rewardsDistribution;
    }

    function setTokenWeights(uint256[] calldata weights) external onlyOwner {
        require(weights.length == 6, "Length");
        for (uint256 i; i < 5; ) {
            require(weights[i] >= weights[i + 1], "Invalid weight");
            unchecked {
                ++i;
            }
        }
        GENESIS_LEGENDARY_WEIGHT = weights[0];
        GENESIS_RARE_WEIGHT = weights[1];
        GENESIS_UNCOMMON_WEIGHT = weights[2];
        NORMAL_RARE_WEIGHT = weights[3];
        NORMAL_UNCOMMON_WEIGHT = weights[4];
        NORMAL_COMMON_WEIGHT = weights[5];
    }

    function setPaused(bool _paused) external onlyOwner {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
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
        require(msg.sender == rewardsDistribution, "Caller is not RewardsDistribution contract");
        _;
    }

    /* ========== HOOKS ========== */

    function onERC721Received(
        address, // operator
        address, // from
        uint256, // tokenId
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 id, address indexed stakingToken, uint256 amount);
    event Withdrawn(address indexed user, uint256 id, address indexed stakingToken, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
    event NewRewardsDistribution(address oldRewardsDistribution, address newRewardsDistribution);
}
